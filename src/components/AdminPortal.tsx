import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Team, SocialHandle, FeedItem, Match, Contest, PrizeDraw, Approval, AgentRun, SystemSettings, NotificationItem, User } from '../types';
import { ADMIN_SECTIONS, AdminSectionId, can, isAdminSectionId, SECTION_PERMISSION } from './admin/shared';
import { DashboardSection } from './admin/DashboardSection';
import { AdminsSection } from './admin/AdminsSection';
import { TeamsSection } from './admin/TeamsSection';
import { HandlesSection } from './admin/HandlesSection';
import { FeedsSection } from './admin/FeedsSection';
import { MatchesSection } from './admin/MatchesSection';
import { ContestsSection } from './admin/ContestsSection';
import { FantasySection } from './admin/FantasySection';
import { PrizesSection } from './admin/PrizesSection';
import { DrawsSection } from './admin/DrawsSection';
import { ForumSection } from './admin/ForumSection';
import { PollsSection } from './admin/PollsSection';
import { FanWallSection } from './admin/FanWallSection';
import { NotificationsSection } from './admin/NotificationsSection';
import { FanSpacesSection } from './admin/FanSpacesSection';
import { FanCheckInPanel } from './admin/FanCheckInPanel';
import { GrowthSection } from './admin/GrowthSection';
import { ApprovalsSection } from './admin/ApprovalsSection';
import { MarketingSection } from './admin/MarketingSection';
import { SettingsSection } from './admin/SettingsSection';
import { ProposalSection } from './admin/ProposalSection';
import { AdminToolsSection } from './admin/AdminToolsSection';
import { EnvVariablesSection } from './admin/EnvVariablesSection';
import { SquadEditorSection } from './admin/SquadEditorSection';
import { FanClubsSection } from './admin/FanClubsSection';

export type { AdminSectionId } from './admin/shared';

interface AdminPortalProps {
  currentUser: User;
  teams: Team[];
  handles: SocialHandle[];
  feedItems: FeedItem[];
  matches: Match[];
  contests: Contest[];
  draws: PrizeDraw[];
  settings: SystemSettings;
  approvals: Approval[];
  agentRuns: AgentRun[];
  notifications: NotificationItem[];
  onRefreshAll: () => Promise<void>;
  initialSection?: string;
  onSectionChange?: (id: AdminSectionId) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = props => {
  const { currentUser, teams, handles, feedItems, matches, contests, draws, settings, approvals, agentRuns, notifications, onRefreshAll, initialSection, onSectionChange } = props;
  const isSuper = Boolean(currentUser.isSuperAdmin || currentUser.adminRole === 'superadmin');
  const isTeamOfficial = currentUser.adminRole === 'team_official';
  const myTeam = isTeamOfficial ? teams.find(t => t.id === currentUser.adminTeamId) || null : null;
  // Team officials only see their own team.
  const scopedTeams = isTeamOfficial ? teams.filter(t => t.id === currentUser.adminTeamId) : teams;

  const canAccess = (id: AdminSectionId): boolean => {
    if (id === 'dashboard') return true;
    if (isTeamOfficial && ['tools', 'approvals', 'marketing', 'growth', 'fanspaces', 'checkin', 'settings', 'proposal', 'matches', 'contests', 'fantasy', 'prizes', 'draws'].includes(id)) return false;
    const perm = SECTION_PERMISSION[id];
    if (!perm) return true;
    if (perm === 'super') return isSuper;
    return can(currentUser, perm);
  };
  const visible = ADMIN_SECTIONS.filter(s => canAccess(s.id));
  const pick = (v?: string): AdminSectionId => (isAdminSectionId(v) && canAccess(v) ? v : 'dashboard');
  const [section, setSection] = useState<AdminSectionId>(pick(initialSection));
  useEffect(() => {
    setSection(pick(initialSection));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  const goTo = (id: AdminSectionId) => {
    setSection(id);
    onSectionChange?.(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const badge: Partial<Record<AdminSectionId, number>> = {
    approvals: approvals.filter(a => a.status === 'pending').length,
    handles: handles.filter(h => h.status === 'pending').length,
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full overflow-x-hidden">
      <header className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4" /> Admin console
            </span>
            <h1 className="mt-2 text-xl sm:text-2xl font-black text-white">{isTeamOfficial ? `${myTeam?.name || 'Team'} console` : `${settings?.brandName || 'ADT10 Fans'} admin`}</h1>
            <p className="text-sm text-slate-300 mt-1">
              {isTeamOfficial ? 'Manage your team page, squad, official channels, posts, polls and messages to your fans.' : 'Fixtures, squads, official channels, games, prizes, moderation and settings.'}
            </p>
          </div>
          <div className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-950/80 border border-amber-400/30 text-end">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Signed in</div>
            <div className="text-xs font-black text-amber-300 break-all">{currentUser.email}</div>
            <div className="text-[10px] font-semibold text-slate-300">{isSuper ? 'Super admin' : (currentUser.adminRole || 'admin').replace('_', ' ')}</div>
          </div>
        </div>
      </header>

      <div className="sm:hidden">
        <label htmlFor="admin-section" className="sr-only">Admin section</label>
        <select id="admin-section" value={section} onChange={e => goTo(e.target.value as AdminSectionId)} className="w-full min-h-[44px] px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-base text-white font-bold">
          {visible.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
              {badge[s.id] ? ` (${badge[s.id]} pending)` : ''}
            </option>
          ))}
        </select>
      </div>
      <nav aria-label="Admin sections" className="hidden sm:flex flex-wrap gap-2">
        {visible.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(s.id)}
            aria-current={section === s.id ? 'page' : undefined}
            className={`min-h-[36px] px-3 rounded-full text-sm font-bold border whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${section === s.id ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-slate-500'}`}
          >
            {s.label}
            {badge[s.id] ? <span className={`px-1.5 rounded-full text-xs ${section === s.id ? 'bg-slate-950 text-amber-300' : 'bg-amber-400 text-slate-950'}`}>{badge[s.id]}</span> : null}
          </button>
        ))}
      </nav>

      <main className="min-w-0">
        {section === 'dashboard' && <DashboardSection agentRuns={agentRuns} approvals={approvals} onRefreshAll={onRefreshAll} goTo={goTo} />}
        {section === 'tools' && <AdminToolsSection teams={teams} onRefreshAll={onRefreshAll} goToSection={goTo} />}
        {section === 'env' && <EnvVariablesSection onRefreshAll={onRefreshAll} />}
        {section === 'admins' && <AdminsSection currentUserEmail={currentUser.email} isCurrentUserSuperAdmin={isSuper} teams={teams} />}
        {section === 'teams' && <TeamsSection teams={scopedTeams} onRefreshAll={onRefreshAll} goToSection={goTo} isTeamOfficial={isTeamOfficial} />}
        {section === 'squads' && <SquadEditorSection teams={scopedTeams} onRefreshAll={onRefreshAll} />}
        {section === 'handles' && <HandlesSection handles={handles} teams={scopedTeams} approvals={approvals} onRefreshAll={onRefreshAll} isTeamOfficial={isTeamOfficial} />}
        {section === 'feeds' && <FeedsSection feedItems={feedItems} teams={scopedTeams} onRefreshAll={onRefreshAll} isTeamOfficial={isTeamOfficial} />}
        {section === 'matches' && <MatchesSection matches={matches} teams={teams} settings={settings} onRefreshAll={onRefreshAll} />}
        {section === 'contests' && <ContestsSection contests={contests} matches={matches} teams={teams} onRefreshAll={onRefreshAll} />}
        {section === 'fantasy' && <FantasySection matches={matches} teams={teams} />}
        {section === 'prizes' && <PrizesSection teams={teams} />}
        {section === 'draws' && <DrawsSection draws={draws} teams={teams} onRefreshAll={onRefreshAll} />}
        {section === 'forum' && <ForumSection teams={scopedTeams} />}
        {section === 'polls' && <PollsSection teams={scopedTeams} matches={matches} isTeamOfficial={isTeamOfficial} />}
        {section === 'fanwall' && <FanWallSection teams={scopedTeams} />}
        {section === 'notifications' && <NotificationsSection notifications={notifications} teams={scopedTeams} matches={matches} contests={contests} isTeamOfficial={isTeamOfficial} />}
        {section === 'fanspaces' && <FanSpacesSection />}
        {section === 'fanclubs' && <FanClubsSection />}
        {section === 'checkin' && <FanCheckInPanel />}
        {section === 'growth' && <GrowthSection />}
        {section === 'approvals' && <ApprovalsSection approvals={approvals} onRefreshAll={onRefreshAll} />}
        {section === 'marketing' && <MarketingSection teams={teams} />}
        {section === 'settings' && <SettingsSection settings={settings} onRefreshAll={onRefreshAll} />}
        {section === 'proposal' && <ProposalSection />}
      </main>
    </div>
  );
};

export default AdminPortal;
