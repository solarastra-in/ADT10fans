export interface RouteState {
  tab: string;
  param: string | null;
  path: string;
}

export function parsePath(pathname: string): RouteState {
  // Normalize path
  const cleanPath = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';

  if (cleanPath === '/' || cleanPath === '/home') {
    return { tab: 'home', param: null, path: '/' };
  }

  const parts = cleanPath.split('/').filter(Boolean);
  const first = parts[0];

  if (first === 'matches') {
    return { tab: 'matches', param: null, path: '/matches' };
  }

  if (first === 'teams') {
    const teamId = parts[1] || null;
    return { 
      tab: 'teams', 
      param: teamId, 
      path: teamId ? `/teams/${teamId}` : '/teams' 
    };
  }

  if (first === 'social') {
    return { tab: 'social', param: null, path: '/social' };
  }

  if (first === 'contests' || first === 'fantasy') {
    return { tab: 'contests', param: null, path: '/contests' };
  }

  if (first === 'draws' || first === 'rewards' || first === 'prizes') {
    return { tab: 'draws', param: null, path: '/draws' };
  }

  if (first === 'leaderboard' || first === 'fanwars') {
    return { tab: 'leaderboard', param: null, path: '/leaderboard' };
  }

  if (first === 'forum' || first === 'discussions') {
    return { tab: 'forum', param: null, path: '/forum' };
  }

  if (first === 'fanspaces' || first === 'fan-spaces') {
    return { tab: 'fanspaces', param: null, path: '/fanspaces' };
  }

  if (first === 'growth' || first === 'youth' || first === 'catalysts') {
    return { tab: 'growth', param: null, path: '/growth' };
  }

  if (first === 'proposal' || first === 'deck') {
    return { tab: 'proposal', param: null, path: '/proposal' };
  }

  if (first === 'profile' || first === 'badges') {
    return { tab: 'profile', param: null, path: '/profile' };
  }

  if (first === 'admin') {
    return { tab: 'admin', param: null, path: '/admin' };
  }

  // Default fallback
  return { tab: 'home', param: null, path: '/' };
}

export function getPathForTab(tab: string, param?: string | null): string {
  switch (tab) {
    case 'home':
      return '/';
    case 'matches':
      return '/matches';
    case 'teams':
      return param ? `/teams/${param}` : '/teams';
    case 'social':
      return '/social';
    case 'contests':
      return '/contests';
    case 'draws':
      return '/draws';
    case 'leaderboard':
      return '/leaderboard';
    case 'forum':
      return '/forum';
    case 'fanspaces':
      return '/fanspaces';
    case 'growth':
      return '/growth';
    case 'proposal':
      return '/proposal';
    case 'profile':
      return '/profile';
    case 'admin':
      return '/admin';
    default:
      return '/';
  }
}
