import { Team } from '../../types';

export type AdminSectionId =
  | 'dashboard'
  | 'teams'
  | 'handles'
  | 'feeds'
  | 'matches'
  | 'contests'
  | 'draws'
  | 'forum'
  | 'notifications'
  | 'fanspaces'
  | 'growth'
  | 'approvals'
  | 'marketing'
  | 'settings'
  | 'proposal'
  | 'admins';

export const ADMIN_SECTIONS: { id: AdminSectionId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'admins', label: 'Admins & RBAC' },
  { id: 'teams', label: 'Teams' },
  { id: 'handles', label: 'Handles' },
  { id: 'feeds', label: 'Feeds' },
  { id: 'matches', label: 'Matches' },
  { id: 'contests', label: 'Contests' },
  { id: 'draws', label: 'Draws & Winners' },
  { id: 'forum', label: 'Forum' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'fanspaces', label: 'Fan Spaces' },
  { id: 'growth', label: 'Growth' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'marketing', label: 'AI Copy' },
  { id: 'settings', label: 'Settings' },
  { id: 'proposal', label: 'Proposal' },
];

export const isAdminSectionId = (v: unknown): v is AdminSectionId =>
  typeof v === 'string' && ADMIN_SECTIONS.some(s => s.id === v);

export const teamName = (teams: Team[], id?: string | null): string => {
  if (!id) return 'League-wide';
  const t = teams.find(x => x.id === id);
  return t ? t.name : id;
};

export const HANDLE_PLATFORMS = ['X', 'Instagram', 'Threads', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'RSS'] as const;
export const FEED_PLATFORMS = ['X', 'Instagram', 'Threads', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube', 'Web'] as const;
export const PLAYER_ROLES = ['batter', 'bowler', 'allrounder', 'wicketkeeper'] as const;
export const PLAYER_CATEGORIES = ['Icon', 'Platinum', 'Diamond', 'Gold', 'Silver', 'Local', 'Emerging'] as const;
