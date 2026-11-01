import React, { useEffect, useState } from 'react';
import { Copy, Mail, RotateCcw, UserPlus, X } from 'lucide-react';
import { api } from '../../api';
import type { Team, TeamInviteView } from '../../types';
import { Button, Card, Chip, Field, Notice, Select, TextInput, useRunner } from './ui';

/**
 * Super admin: onboard a team admin with their name, email and team. They get an email with a link;
 * once they sign in with that email and accept, they manage that team's portal (/team-portal).
 * Without a mail server the link is shown here, once, to send by hand.
 */
export const TeamInvitesPanel: React.FC<{ teams: Team[] }> = ({ teams }) => {
  const [invites, setInvites] = useState<TeamInviteView[]>([]);
  const [form, setForm] = useState({ name: '', email: '', teamId: '' });
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const { busy, notice, setNotice, run } = useRunner();
  const load = () =>
    api
      .getTeamInvites()
      .then(r => setInvites(r.invites))
      .catch(e => setNotice({ kind: 'err', text: e.message }));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.teamId) return setNotice({ kind: 'err', text: 'Enter a name, an email and a team.' });
    const r = await run('invite', () => api.inviteTeamAdmin({ name: form.name.trim(), email: form.email.trim(), teamId: form.teamId }));
    if (!r) return;
    setNotice({ kind: r.invite?.emailed ? 'ok' : 'err', text: r.message });
    setLink({ email: form.email.trim(), url: r.link });
    setForm({ name: '', email: '', teamId: form.teamId });
    load();
  };
  const resend = async (i: TeamInviteView) => {
    const r = await run(`resend:${i.id}`, () => api.resendTeamInvite(i.id));
    if (!r) return;
    setNotice({ kind: r.invite?.emailed ? 'ok' : 'err', text: r.message });
    setLink({ email: i.email, url: r.link });
    load();
  };
  const revoke = async (i: TeamInviteView) => {
    if (!window.confirm(`Withdraw the invitation for ${i.email}? The link stops working.`)) return;
    if (await run(`revoke:${i.id}`, () => api.revokeTeamInvite(i.id), 'Invitation withdrawn.')) load();
  };
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind: 'ok', text: 'Link copied.' });
    } catch {
      window.prompt('Copy the invitation link:', url);
    }
  };
  const teamName = (id: string) => teams.find(t => t.id === id)?.name || id;
  const tone = (s: TeamInviteView['status']) => (s === 'accepted' ? 'green' : s === 'pending' ? 'amber' : 'slate');

  return (
    <section data-testid="team-invites">
    <Card className="p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="font-black text-white flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-amber-400" /> Onboard a team admin
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          They get an email with a link. When they sign in with that email and accept, they manage only that team in its portal: team page, squad and player details, official accounts, posts,
          prizes for its fans, polls, forum and messages. The link works for 7 days.
        </p>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <form onSubmit={send} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <Field label="Name">
          <TextInput value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} maxLength={80} placeholder="Full name" />
        </Field>
        <Field label="Email">
          <TextInput type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="name@franchise.com" />
        </Field>
        <Field label="Team">
          <Select value={form.teamId} onChange={e => setForm({ ...form, teamId: e.target.value })}>
            <option value="">Choose…</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="primary" loading={busy === 'invite'} icon={<Mail className="w-4 h-4" />}>
          Send invitation
        </Button>
      </form>
      {link && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs space-y-2" data-testid="invite-link">
          <p className="text-slate-300">
            Invitation link for <strong className="text-white">{link.email}</strong> (shown once; it is not stored):
          </p>
          <div className="flex gap-2">
            <input readOnly value={link.url} className="flex-1 min-w-0 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 font-mono text-[11px] text-slate-200" aria-label="Invitation link" />
            <Button size="sm" icon={<Copy className="w-4 h-4" />} onClick={() => copy(link.url)}>
              Copy
            </Button>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <ul className="divide-y divide-slate-800 text-sm">
          {invites.map(i => (
            <li key={i.id} className="py-2.5 flex flex-wrap items-center gap-2">
              <span className="font-bold text-white">{i.name}</span>
              <span className="text-slate-400 break-all">{i.email}</span>
              <Chip>{teamName(i.teamId)}</Chip>
              <Chip tone={tone(i.status)}>{i.status}</Chip>
              {i.status === 'pending' && <span className="text-[11px] text-slate-500">{i.emailed ? 'emailed' : 'not emailed'} · until {new Date(i.expiresAt).toLocaleDateString()}</span>}
              {i.status === 'accepted' && i.acceptedAt && <span className="text-[11px] text-slate-500">{new Date(i.acceptedAt).toLocaleDateString()}</span>}
              {(i.status === 'pending' || i.status === 'expired') && (
                <span className="ms-auto flex gap-2">
                  <Button size="sm" icon={<RotateCcw className="w-4 h-4" />} loading={busy === `resend:${i.id}`} onClick={() => resend(i)} disabled={i.status === 'expired' && false}>
                    {i.status === 'expired' ? 'Send a new link' : 'Resend'}
                  </Button>
                  {i.status === 'pending' && (
                    <Button size="sm" variant="danger" icon={<X className="w-4 h-4" />} loading={busy === `revoke:${i.id}`} onClick={() => revoke(i)}>
                      Withdraw
                    </Button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
    </section>
  );
};
