export interface RouteState {
  tab: string;
  param: string | null;
  path: string;
}

export function parsePath(pathname: string): RouteState {
  // Normalize: remove trailing slash except root
  let clean = pathname.trim();
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }

  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) {
    return { tab: 'home', param: null, path: '/' };
  }

  const first = parts[0].toLowerCase();

  if (first === 'matches') {
    return { tab: 'matches', param: null, path: '/matches' };
  }

  if (first === 'teams') {
    let teamId: string | null = parts[1] || null;
    try {
      teamId = teamId ? decodeURIComponent(teamId) : null;
    } catch {
      teamId = null;
    }
    return { 
      tab: 'teams', 
      param: teamId, 
      path: teamId ? `/teams/${encodeURIComponent(teamId)}` : '/teams' 
    };
  }

  if (first === 'social') {
    return { tab: 'social', param: null, path: '/social' };
  }

  if (first === 'contests') {
    return { tab: 'contests', param: null, path: '/contests' };
  }

  if (first === 'draws') {
    return { tab: 'draws', param: null, path: '/draws' };
  }

  if (first === 'leaderboard') {
    return { tab: 'leaderboard', param: null, path: '/leaderboard' };
  }

  if (first === 'profile' || first === 'trophies') {
    return { tab: 'profile', param: null, path: '/profile' };
  }

  if (first === 'forum' || first === 'commons') {
    return { tab: 'forum', param: null, path: '/forum' };
  }

  if (first === 'fanspaces' || first === 'spaces') {
    return { tab: 'fanspaces', param: null, path: '/fanspaces' };
  }

  if (first === 'growth' || first === 'youth') {
    return { tab: 'growth', param: null, path: '/growth' };
  }

  // Routable, but App.tsx only renders it for admins.
  if (first === 'proposal' || first === 'deck') {
    return { tab: 'proposal', param: null, path: '/proposal' };
  }

  if (first === 'admin' || first === 'portal') {
    return { tab: 'admin', param: null, path: '/admin' };
  }

  return { tab: 'home', param: null, path: '/' };
}

export function getPathForTab(tab: string, param?: string | null): string {
  switch (tab) {
    case 'home':
      return '/';
    case 'matches':
      return '/matches';
    case 'teams':
      return param ? `/teams/${encodeURIComponent(param)}` : '/teams';
    case 'social':
      return '/social';
    case 'contests':
      return '/contests';
    case 'draws':
      return '/draws';
    case 'leaderboard':
      return '/leaderboard';
    case 'profile':
      return '/profile';
    case 'forum':
      return '/forum';
    case 'fanspaces':
      return '/fanspaces';
    case 'growth':
      return '/growth';
    case 'proposal':
      return '/proposal';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}
