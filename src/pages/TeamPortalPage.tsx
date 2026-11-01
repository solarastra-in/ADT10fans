import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Gift, Megaphone, MessageSquare, Radio, Shield, Trophy, UserPlus, Users, Vote } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { Link, navigate, usePageMeta, useRoute } from '../router';
import { Button, Card, EmptyState, ErrorBox, Spinner, StatTile, TeamBadge, cx } from '../components/ui';
import type { Approval, FeedItem, NotificationItem, SocialHandle, Team, TeamPortalOverview } from '../types';
import { TeamsSection } from '../components/admin/TeamsSection';
import { SquadEditorSection } from '../components/admin/SquadEditorSection';
import { HandlesSection } from '../components/admin/HandlesSection';
import { FeedsSection } from '../components/admin/FeedsSection';
import { PrizesSection } from '../components/admin/PrizesSection';
import { PollsSection } from '../components/admin/PollsSection';
import { ForumSection } from '../components/admin/ForumSection';
import { FanWallSection } from '../components/admin/FanWallSection';
import { NotificationsSection } from '../components/admin/NotificationsSection';

/**
 * A franchise's own portal. Team admins (invited by a super admin) manage their team page, squad and
 * player details, official accounts, posts, prizes for their fans, polls, forum, fan wall and
 * messages: their team only. A super admin can open any team's portal to see exactly what its
 * admins see (?team=<id>).
 */
const SECTIONS = [
  { id: 'overview', label: 'Overview', Icon: Shield },
  { id: 'page', label: 'Team page', Icon: Trophy },
  { id: 'squad', label: 'Squad & players', Icon: Users },
  { id: 'accounts', label: 'Official accounts', Icon: Radio },
  { id: 'posts', label: 'Posts', Icon: Megaphone },
  { id: 'prizes', label: 'Prizes & claims', Icon: Gift },
  { id: 'polls', label: 'Polls', Icon: Vote },
  { id: 'forum', label: 'Forum', Icon: MessageSquare },
  { id: 'fanwall', label: 'Fan wall', Icon: Camera },
  { id: 'messages', label: 'Messages to fans', Icon: Megaphone },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
const isSection = (v?: string): v is SectionId => SECTIONS.some(s => s.id === v);

interface Data {
  handles: SocialHandle[];
  feedItems: FeedItem[];
  approvals: Approval[];
  notifications: NotificationItem[];
}

export default function TeamPortalPage({ section }: { section?: string }) {
  const { user, teams, matches, openAuth, refreshTeams, refreshMatches, refreshUser } = useApp();
  const route = useRoute();
  usePageMeta('Team portal');
  const isTeamAdmin = user?.adminRole === 'team_official';
  const isSuper = Boolean(user?.isSuperAdmin || user?.adminRole === 'superadmin');
  const teamId = isTeamAdmin ? user?.adminTeamId || '' : route.query.get('team') || '';
  const team = teams.find(t => t.id === teamId) || null;
  const current: SectionId = isSection(section) ? section : 'overview';
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) return;
    try {
      const [dash, handles, feeds, notifs] = await Promise.all([
        api.getAdminDashboard(),
        api.getHandles(),
        api.getFeeds({ limit: 100, teamId }),
        api.getAdminNotifications().catch(() => ({ notifications: [] as NotificationItem[] })),
      ]);
      setData({
        handles: handles.handles.filter(h => h.teamId === teamId),
        feedItems: feeds.items.filter(f => f.teamId === teamId),
        approvals: (dash.pendingApprovals || []).filter((a: Approval) => a.payload?.teamId === teamId),
        notifications: notifs.notifications.filter(n => n.teamId === teamId),
      });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [teamId]);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user?.id, user?.role, load]);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), refreshTeams(), refreshMatches(), refreshUser()]);
  }, [load, refreshTeams, refreshMatches, refreshUser]);

  if (!user) return <EmptyState title="Team portal" body="Sign in with the email your invitation was sent to." action={<Button onClick={() => openAuth()}>Sign in</Button>} />;
  if (user.role !== 'admin' || (!isTeamAdmin && !isSuper)) {
    return <EmptyState title="Team portal" body="This is for team admins. If your franchise has invited you, open the link in your invitation email." />;
  }
  if (isSuper && !teamId) return <TeamPicker teams={teams} />;
  if (!team) return <EmptyState title="Team portal" body={isTeamAdmin ? 'Your account is not linked to a team any more. Ask the league to send a new invitation.' : 'Team not found.'} action={isSuper ? <Link to="/team-portal" className="text-sm font-bold text-amber-400">Choose a team</Link> : undefined} />;

  const go = (id: SectionId) => {
    navigate(`/team-portal${id === 'overview' ? '' : `/${id}`}${isSuper ? `?team=${encodeURIComponent(team.id)}` : ''}`, { keepScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full overflow-x-hidden" data-testid="team-portal">
      <header
        className="relative overflow-hidden rounded-2xl border border-white/10 p-5 text-white"
        style={{ background: `linear-gradient(135deg, ${team.color}d9 0%, ${team.secondaryColor || '#0f172a'}f0 60%, #0f172a 100%)` }}
      >
        <div className="flex items-center gap-4">
          <TeamBadge team={team} size="lg" />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/30 text-[11px] font-black uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" /> Team portal
            </span>
            <h1 className="mt-1 text-2xl font-black truncate">{team.name}</h1>
            <p className="text-xs text-white/80 break-all">
              {user.email} · {isSuper ? 'super admin, viewing as this team' : 'team admin'}
            </p>
          </div>
          {isSuper && (
            <Link to="/team-portal" className="ms-auto self-start text-xs font-bold text-white/90 underline">
              Other teams
            </Link>
          )}
        </div>
      </header>

      <div className="sm:hidden">
        <label htmlFor="team-portal-section" className="sr-only">Section</label>
        <select id="team-portal-section" value={current} onChange={e => go(e.target.value as SectionId)} className="w-full min-h-[44px] px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-base text-white font-bold">
          {SECTIONS.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Team portal sections" className="hidden sm:flex flex-wrap gap-2">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            aria-current={current === s.id ? 'page' : undefined}
            className={cx('min-h-[36px] px-3 rounded-full text-sm font-bold border inline-flex items-center gap-1.5', current === s.id ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white')}
          >
            <s.Icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </nav>

      {error ? (
        <ErrorBox message={error} onRetry={load} />
      ) : !data ? (
        <Spinner />
      ) : (
        <main className="min-w-0">
          {current === 'overview' && <Overview team={team} go={go} />}
          {current === 'page' && <TeamsSection teams={[team]} onRefreshAll={refreshAll} goToSection={() => go('squad')} isTeamOfficial />}
          {current === 'squad' && <SquadEditorSection teams={[team]} onRefreshAll={refreshAll} />}
          {current === 'accounts' && <HandlesSection handles={data.handles} teams={[team]} approvals={data.approvals} onRefreshAll={refreshAll} isTeamOfficial />}
          {current === 'posts' && <FeedsSection feedItems={data.feedItems} teams={[team]} onRefreshAll={refreshAll} isTeamOfficial />}
          {current === 'prizes' && <PrizesSection teams={teams} team={team} />}
          {current === 'polls' && <PollsSection teams={[team]} matches={matches} isTeamOfficial />}
          {current === 'forum' && <ForumSection teams={[team]} />}
          {current === 'fanwall' && <FanWallSection teams={[team]} teamMode />}
          {current === 'messages' && <NotificationsSection notifications={data.notifications} teams={[team]} matches={matches} contests={[]} isTeamOfficial />}
        </main>
      )}
    </div>
  );
}

function TeamPicker({ teams }: { teams: Team[] }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-white">Team portals</h1>
      <p className="text-sm text-slate-400">
        Open a team's portal to see what its admins see. Invite team admins from <Link to="/admin/admins" className="text-amber-400 font-bold">Admin → Admins &amp; RBAC</Link>.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {teams.map(t => (
          <Link key={t.id} to={`/team-portal?team=${encodeURIComponent(t.id)}`} className="block">
            <Card className="p-4 flex items-center gap-3 hover:border-slate-600">
              <TeamBadge team={t} size="md" />
              <span className="font-black text-white">{t.name}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Overview({ team, go }: { team: Team; go: (id: SectionId) => void }) {
  const [o, setO] = useState<TeamPortalOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.getTeamOverview(team.id).then(setO).catch(e => setError(e.message));
  }, [team.id]);
  if (error) return <ErrorBox message={error} />;
  if (!o) return <Spinner />;
  const todo = [
    o.claims.pending > 0 && { text: `${o.claims.pending} prize claim(s) to fulfil`, to: 'prizes' as const },
    o.handles.pending > 0 && { text: `${o.handles.pending} suggested account(s) to check`, to: 'accounts' as const },
    o.playersWithLinks < o.squad && { text: `${o.squad - o.playersWithLinks} player(s) without stats or social links`, to: 'squad' as const },
    o.prizes.active === 0 && { text: 'No prizes for your fans yet', to: 'prizes' as const },
  ].filter(Boolean) as { text: string; to: SectionId }[];
  return (
    <div className="space-y-5" data-testid="team-overview">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label="Fans backing the team" value={o.fans} accent />
        <StatTile label="Players" value={o.squad} />
        <StatTile label="Official accounts" value={o.handles.verified} />
        <StatTile label="Active prizes" value={o.prizes.active} />
      </div>
      <Card className="p-4">
        <h2 className="font-black text-white mb-2">To do</h2>
        {todo.length ? (
          <ul className="space-y-1.5">
            {todo.map(x => (
              <li key={x.text}>
                <button type="button" onClick={() => go(x.to)} className="text-sm text-amber-300 hover:text-amber-200 font-bold text-start">
                  {x.text} →
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">All caught up.</p>
        )}
      </Card>
      <Card className="p-4">
        <h2 className="font-black text-white mb-2 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-amber-400" /> Team admins
        </h2>
        <ul className="text-sm text-slate-300 space-y-1">
          {o.admins.map(a => (
            <li key={a.email}>
              <strong className="text-white">{a.name}</strong> · {a.email}
            </li>
          ))}
          {o.pendingInvites.map(i => (
            <li key={i.email} className="text-slate-400">
              {i.name} · {i.email} · invited, not accepted yet
            </li>
          ))}
          {!o.admins.length && !o.pendingInvites.length && <li className="text-slate-400">None yet.</li>}
        </ul>
        <p className="text-xs text-slate-500 mt-2">To add or remove a team admin, ask the league's super admin.</p>
      </Card>
    </div>
  );
}
