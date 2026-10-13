import { Team } from '../../types';

export type AdminSectionId =
  | 'dashboard'
  | 'admins'
  | 'tools'
  | 'env'
  | 'teams'
  | 'squads'
  | 'handles'
  | 'feeds'
  | 'matches'
  | 'contests'
  | 'fantasy'
  | 'prizes'
  | 'polls'
  | 'checkin'
  | 'draws'
  | 'forum'
  | 'notifications'
  | 'fanspaces'
  | 'growth'
  | 'approvals'
  | 'marketing'
  | 'settings'
  | 'proposal';

export const ADMIN_SECTIONS: { id: AdminSectionId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'tools', label: 'Admin Tools' },
  { id: 'env', label: 'Environment' },
  { id: 'admins', label: 'Admins & RBAC' },
  { id: 'teams', label: 'Teams' },
  { id: 'squads', label: 'Squad Editor' },
  { id: 'handles', label: 'Handles' },
  { id: 'feeds', label: 'Feeds' },
  { id: 'matches', label: 'Matches' },
  { id: 'contests', label: 'Predictions' },
  { id: 'fantasy', label: 'Dream XI' },
  { id: 'prizes', label: 'Prizes & claims' },
  { id: 'draws', label: 'Prize draws' },
  { id: 'forum', label: 'Forum & reports' },
  { id: 'polls', label: 'Polls' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'fanspaces', label: 'Fan Spaces' },
  { id: 'checkin', label: 'Door check-in' },
  { id: 'growth', label: 'Growth' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'marketing', label: 'AI Copy' },
  { id: 'settings', label: 'Settings' },
  { id: 'proposal', label: 'Proposal' },
];

/** Mirrors server/auth.ts hasPermission so the console only shows what the server will allow. */
const IMPLIED: Record<string, string[]> = {
  matches: ['leagues'], teams: ['leagues', 'team'], fantasy: ['contests'], games: ['contests'], draws: ['winners', 'prizes'], prizes: ['winners'],
  social: ['feeds'], feeds: ['social'], community: ['social'],
};
export function can(user: { isSuperAdmin?: boolean; adminRole?: string; permissions?: string[] } | null | undefined, perm: string): boolean {
  if (!user) return false;
  if (user.isSuperAdmin || user.adminRole === 'superadmin') return true;
  const perms = user.permissions || [];
  if (perm === 'admins') return false;
  if (perms.includes('all') && user.adminRole !== 'team_official') return true;
  return perms.includes(perm) || (IMPLIED[perm] || []).some(p => perms.includes(p));
}

export const SECTION_PERMISSION: Partial<Record<AdminSectionId, string | 'super'>> = {
  tools: 'teams', env: 'super', admins: 'super', teams: 'teams', squads: 'teams', handles: 'social', feeds: 'social', matches: 'matches',
  contests: 'contests', fantasy: 'fantasy', prizes: 'prizes', draws: 'draws', forum: 'community', polls: 'community', notifications: 'notifications',
  fanspaces: 'fanspaces', checkin: 'fanspaces', growth: 'growth', approvals: 'social', marketing: 'social', settings: 'settings', proposal: 'settings',
};

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
export const BATTING_STYLES = ['Right-hand bat', 'Left-hand bat'] as const;
export const BOWLING_STYLES = [
  'Right-arm fast',
  'Right-arm fast-medium',
  'Right-arm medium',
  'Right-arm offbreak',
  'Right-arm legbreak',
  'Left-arm fast',
  'Left-arm fast-medium',
  'Left-arm orthodox',
  'Left-arm chinaman',
] as const;
