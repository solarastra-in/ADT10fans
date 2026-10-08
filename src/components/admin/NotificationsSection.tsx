import React, { useCallback, useEffect, useState } from 'react';
import { Send, RefreshCw, Trophy, Clock } from 'lucide-react';
import { Contest, Match, NotificationItem, Team } from '../../types';
import { api } from '../../api';
import { Button, Card, Chip, EmptyState, Errors, Field, Notice, SectionHeader, Select, TextArea, TextInput, formatDateTime, isHttpsUrl, statusTone, toNumber, useRunner } from './ui';
import { teamName } from './shared';

type Draft = {
  title: string;
  body: string;
  category: NotificationItem['category'];
  targetAudience: NotificationItem['targetAudience'];
  teamId: string;
  url: string;
  priority: 'normal' | 'high';
};

const blank: Draft = { title: '', body: '', category: 'announcement', targetAudience: 'all', teamId: '', url: '', priority: 'normal' };

const AUDIENCE_LABEL: Record<string, string> = { all: 'Everyone', logged_in: 'Signed-in fans', team: 'One team’s fans' };

export const NotificationsSection: React.FC<{
  notifications: NotificationItem[];
  teams: Team[];
  matches: Match[];
  contests: Contest[];
}> = ({ notifications: initial, teams, matches, contests }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [list, setList] = useState<NotificationItem[]>(initial);
  const [tokens, setTokens] = useState<{ totalTokens: number; activeSubscribers: number } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ ...blank });
  const [errors, setErrors] = useState<Errors>({});
  const [matchId, setMatchId] = useState('');
  const [contestId, setContestId] = useState('');
  const [minutes, setMinutes] = useState('15');

  const load = useCallback(async () => {
    const [n, t] = await Promise.allSettled([api.getNotifications(), api.getFCMTokens()]);
    if (n.status === 'fulfilled') setList(n.value.notifications || []);
    if (t.status === 'fulfilled') {
      setTokens({ totalTokens: t.value.totalTokens ?? 0, activeSubscribers: t.value.activeSubscribers ?? 0 });
      setTokenError(null);
    } else {
      setTokenError((t.reason as any)?.message || 'Could not load device tokens');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reportSend = (n: NotificationItem | undefined, message?: string) => {
    if (!n) return;
    const parts: string[] = [];
    parts.push(n.delivery === 'fcm' ? 'Delivered via push (FCM)' : n.delivery === 'in-app' ? 'Stored as in-app notification only (push not configured)' : 'Saved');
    if (typeof n.recipientCount === 'number') parts.push(`${n.recipientCount} recipients`);
    if (typeof n.fcmSuccessCount === 'number' && n.delivery === 'fcm') parts.push(`${n.fcmSuccessCount} push delivered`);
    if (n.fcmFailureCount) parts.push(`${n.fcmFailureCount} failed`);
    setNotice({ kind: n.delivery === 'in-app' ? 'warn' : 'ok', text: parts.join(' · '), details: message ? [message] : undefined });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Errors = {};
    if (!draft.title.trim()) er.title = 'Title is required.';
    if (!draft.body.trim()) er.body = 'Message is required.';
    if (draft.targetAudience === 'team' && !draft.teamId) er.teamId = 'Choose a team.';
    const url = draft.url.trim();
    if (url && !url.startsWith('/') && !isHttpsUrl(url)) er.url = 'Use a site path like /matches or an https:// link.';
    setErrors(er);
    if (Object.keys(er).length) return;
    const audienceText = draft.targetAudience === 'team' ? `${teamName(teams, draft.teamId)} fans` : AUDIENCE_LABEL[draft.targetAudience];
    if (!window.confirm(`Send "${draft.title.trim()}" to ${audienceText}?`)) return;
    const res = await run('send', () =>
      api.sendPushNotification({
        title: draft.title.trim(),
        body: draft.body.trim(),
        category: draft.category,
        targetAudience: draft.targetAudience,
        teamId: draft.targetAudience === 'team' ? draft.teamId : null,
        url: url || undefined,
        priority: draft.priority,
      })
    );
    if (res) {
      reportSend(res.notification, res.message);
      setDraft({ ...blank });
      await load();
    }
  };

  const triggerMatch = async () => {
    if (!matchId) return setNotice({ kind: 'err', text: 'Choose a match first.' });
    const res = await run('match', () => api.triggerMatchResult(matchId));
    if (res) {
      reportSend(res.notification);
      await load();
    }
  };

  const triggerContest = async () => {
    if (!contestId) return setNotice({ kind: 'err', text: 'Choose a contest first.' });
    const res = await run('contest', () => api.triggerContestDeadline(contestId, toNumber(minutes, 15)));
    if (res) {
      reportSend(res.notification);
      await load();
    }
  };

  const completed = matches.filter(m => m.status === 'completed' || m.result);
  const openContests = contests.filter(c => c.status === 'open');

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Notifications"
        description="Send announcements to fans. Counts below come straight from the server."
        actions={
          <Button size="sm" onClick={load} icon={<RefreshCw className="w-4 h-4" />}>
            Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-bold text-slate-400 block">Active push subscribers</span>
          <span className="text-2xl font-black text-white font-mono">{tokens ? tokens.activeSubscribers.toLocaleString() : '—'}</span>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-bold text-slate-400 block">Registered device tokens</span>
          <span className="text-2xl font-black text-white font-mono">{tokens ? tokens.totalTokens.toLocaleString() : '—'}</span>
        </div>
      </div>
      {tokenError && <Notice notice={{ kind: 'err', text: tokenError }} />}

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <Card>
        <h3 className="font-extrabold text-white mb-3">Compose</h3>
        <form onSubmit={send} className="grid grid-cols-1 sm:grid-cols-2 gap-3" noValidate>
          <Field label="Title" required error={errors.title} className="sm:col-span-2">
            <TextInput value={draft.title} maxLength={120} onChange={e => setDraft({ ...draft, title: e.target.value })} error={!!errors.title} />
          </Field>
          <Field label="Message" required error={errors.body} className="sm:col-span-2">
            <TextArea rows={3} maxLength={500} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} error={!!errors.body} />
          </Field>
          <Field label="Category">
            <Select value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as Draft['category'] })}>
              <option value="announcement">Announcement</option>
              <option value="match_result">Match result</option>
              <option value="contest_deadline">Contest deadline</option>
              <option value="perk">Perk</option>
            </Select>
          </Field>
          <Field label="Audience">
            <Select value={draft.targetAudience} onChange={e => setDraft({ ...draft, targetAudience: e.target.value as Draft['targetAudience'] })}>
              <option value="all">Everyone</option>
              <option value="logged_in">Signed-in fans</option>
              <option value="team">One team’s fans</option>
            </Select>
          </Field>
          {draft.targetAudience === 'team' && (
            <Field label="Team" required error={errors.teamId}>
              <Select value={draft.teamId} onChange={e => setDraft({ ...draft, teamId: e.target.value })} error={!!errors.teamId}>
                <option value="">Choose…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Link" error={errors.url} hint="Optional: /matches or https://…">
            <TextInput value={draft.url} placeholder="/" onChange={e => setDraft({ ...draft, url: e.target.value })} error={!!errors.url} />
          </Field>
          <Field label="Priority">
            <Select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Draft['priority'] })}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" loading={busy === 'send'} icon={<Send className="w-4 h-4" />} className="w-full sm:w-auto">
              Send notification
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="space-y-3">
          <h3 className="font-extrabold text-white">Announce a match result</h3>
          <Select value={matchId} onChange={e => setMatchId(e.target.value)} aria-label="Match">
            <option value="">{completed.length ? 'Choose a finished match…' : 'No finished matches yet'}</option>
            {completed.map(m => (
              <option key={m.id} value={m.id}>
                #{m.matchNo} {teamName(teams, m.teamA)} vs {teamName(teams, m.teamB)}
              </option>
            ))}
          </Select>
          <Button onClick={triggerMatch} loading={busy === 'match'} disabled={!matchId} icon={<Trophy className="w-4 h-4" />} className="w-full sm:w-auto">
            Send result
          </Button>
        </Card>
        <Card className="space-y-3">
          <h3 className="font-extrabold text-white">Contest closing reminder</h3>
          <Select value={contestId} onChange={e => setContestId(e.target.value)} aria-label="Contest">
            <option value="">{openContests.length ? 'Choose an open contest…' : 'No open contests'}</option>
            {openContests.map(c => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
          <Field label="Minutes until it locks">
            <TextInput type="number" inputMode="numeric" min={1} value={minutes} onChange={e => setMinutes(e.target.value)} />
          </Field>
          <Button onClick={triggerContest} loading={busy === 'contest'} disabled={!contestId} icon={<Clock className="w-4 h-4" />} className="w-full sm:w-auto">
            Send reminder
          </Button>
        </Card>
      </div>

      <Card>
        <h3 className="font-extrabold text-white mb-3">Sent ({list.length})</h3>
        {list.length === 0 ? (
          <EmptyState title="Nothing sent yet" />
        ) : (
          <ul className="space-y-2">
            {list.map(n => (
              <li key={n.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <Chip>{n.category.replace('_', ' ')}</Chip>
                  {n.delivery && <Chip tone={statusTone(n.delivery)}>{n.delivery === 'fcm' ? 'push' : 'in-app only'}</Chip>}
                  <Chip tone="slate">{n.targetAudience === 'team' ? `${teamName(teams, n.teamId)} fans` : AUDIENCE_LABEL[n.targetAudience] || n.targetAudience}</Chip>
                </div>
                <p className="text-sm font-bold text-white break-words">{n.title}</p>
                <p className="text-sm text-slate-400 break-words">{n.body}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {formatDateTime(n.createdAt)}
                  {typeof n.recipientCount === 'number' ? ` · ${n.recipientCount} recipients` : ''}
                  {n.delivery === 'fcm' && typeof n.fcmSuccessCount === 'number' ? ` · ${n.fcmSuccessCount} delivered` : ''}
                  {n.fcmFailureCount ? ` · ${n.fcmFailureCount} failed` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
