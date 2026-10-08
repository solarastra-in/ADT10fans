import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Team, SocialHandle, FeedItem, Match, Contest, PrizeDraw, Approval, AgentRun, SystemSettings, NotificationItem } from '../types';
import { ADMIN_SECTIONS, AdminSectionId, isAdminSectionId } from './admin/shared';
import { DashboardSection } from './admin/DashboardSection';
import { TeamsSection } from './admin/TeamsSection';
import { HandlesSection } from './admin/HandlesSection';
import { FeedsSection } from './admin/FeedsSection';
import { MatchesSection } from './admin/MatchesSection';
import { ContestsSection } from './admin/ContestsSection';
import { DrawsSection } from './admin/DrawsSection';
import { ForumSection } from './admin/ForumSection';
import { NotificationsSection } from './admin/NotificationsSection';
import { FanSpacesSection } from './admin/FanSpacesSection';
import { GrowthSection } from './admin/GrowthSection';
import { ApprovalsSection } from './admin/ApprovalsSection';
import { MarketingSection } from './admin/MarketingSection';
import { SettingsSection } from './admin/SettingsSection';
import { ProposalSection } from './admin/ProposalSection';

export type { AdminSectionId } from './admin/shared';

interface AdminPortalProps {
  teams: Team[];
  handles: SocialHandle[];
  feedItems: FeedItem[];
  matches: Match[];
  contests: Contest[];
  draws: PrizeDraw[];
  settings: SystemSettings;
  approvals: Approval[];
  agentRuns: AgentRun[];
  notifications?: NotificationItem[];
  onRefreshAll: () => Promise<void>;
  /** Optional: open the console on a specific section (e.g. from a fan-page empty state). */
  initialSection?: AdminSectionId | string;
  /** Optional: notified when the admin switches section. */
  onSectionChange?: (id: AdminSectionId) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  teams = [],
  handles = [],
  feedItems = [],
  matches = [],
  contests = [],
  draws = [],
  settings,
  approvals = [],
  agentRuns = [],
  notifications = [],
  onRefreshAll,
  initialSection,
  onSectionChange,
}) => {
  const [section, setSection] = useState<AdminSectionId>(isAdminSectionId(initialSection) ? initialSection : 'dashboard');

  useEffect(() => {
    if (isAdminSectionId(initialSection)) setSection(initialSection);
  }, [initialSection]);

  const goTo = (id: AdminSectionId) => {
    setSection(id);
    onSectionChange?.(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;
  const pendingHandles = handles.filter(h => h.status === 'pending').length;
  const badge: Partial<Record<AdminSectionId, number>> = {
    approvals: pendingApprovals,
    handles: pendingHandles,
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full overflow-x-hidden">
      <header className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/40">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-wide">
          <ShieldCheck className="w-4 h-4" /> Admin console
        </span>
        <h1 className="mt-2 text-xl sm:text-2xl font-black text-white">{settings?.brandName || 'ADT10 Fans'} admin</h1>
        <p className="text-sm text-slate-300 mt-1">Everything fans see is managed here: teams, fixtures, scores, contests, draws, feeds and settings.</p>
      </header>

      {/* Mobile: native select */}
      <div className="sm:hidden">
        <label htmlFor="admin-section" className="sr-only">
          Admin section
        </label>
        <select
          id="admin-section"
          value={section}
          onChange={e => goTo(e.target.value as AdminSectionId)}
          className="w-full min-h-[44px] px-3 py-2 bg-slate-900 border border-amber-500/40 rounded-xl text-base text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-400/40"
        >
          {ADMIN_SECTIONS.map(s => (
            <option key={s.id} value={s.id}>
              {s.label}
              {badge[s.id] ? ` (${badge[s.id]} pending)` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* sm+: wrapping chip nav */}
      <nav aria-label="Admin sections" className="hidden sm:flex flex-wrap gap-2">
        {ADMIN_SECTIONS.map(s => (
          <button
            key={s.id}
            type="button"
            onClick={() => goTo(s.id)}
            aria-current={section === s.id ? 'page' : undefined}
            className={`min-h-[36px] px-3 rounded-full text-sm font-bold border whitespace-nowrap inline-flex items-center gap-1.5 transition-colors ${
              section === s.id ? 'bg-amber-400 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-slate-500'
            }`}
          >
            {s.label}
            {badge[s.id] ? (
              <span className={`px-1.5 rounded-full text-xs ${section === s.id ? 'bg-slate-950 text-amber-300' : 'bg-amber-400 text-slate-950'}`}>{badge[s.id]}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <main className="min-w-0">
        {section === 'dashboard' && <DashboardSection agentRuns={agentRuns} approvals={approvals} onRefreshAll={onRefreshAll} goTo={goTo} />}
        {section === 'teams' && <TeamsSection teams={teams} onRefreshAll={onRefreshAll} />}
        {section === 'handles' && <HandlesSection handles={handles} teams={teams} approvals={approvals} onRefreshAll={onRefreshAll} />}
        {section === 'feeds' && <FeedsSection feedItems={feedItems} teams={teams} onRefreshAll={onRefreshAll} />}
        {section === 'matches' && <MatchesSection matches={matches} teams={teams} settings={settings} onRefreshAll={onRefreshAll} />}
        {section === 'contests' && <ContestsSection contests={contests} matches={matches} teams={teams} onRefreshAll={onRefreshAll} />}
        {section === 'draws' && <DrawsSection draws={draws} teams={teams} onRefreshAll={onRefreshAll} />}
        {section === 'forum' && <ForumSection teams={teams} />}
        {section === 'notifications' && <NotificationsSection notifications={notifications} teams={teams} matches={matches} contests={contests} />}
        {section === 'fanspaces' && <FanSpacesSection />}
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
