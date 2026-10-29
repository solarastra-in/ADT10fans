import React, { useEffect, useSyncExternalStore } from 'react';

/** A small path router: every page has its own URL so it can be shared, indexed and opened directly. */
export type RouteName =
  | 'home' | 'matches' | 'match' | 'teams' | 'team' | 'players' | 'player' | 'social' | 'videos' | 'news'
  | 'play' | 'fantasy' | 'fantasyMatch' | 'games' | 'duel' | 'fanwall' | 'fanPost' | 'contests' | 'prizes' | 'leaderboard' | 'fans'
  | 'forum' | 'thread' | 'fanspaces' | 'growth' | 'profile' | 'rules' | 'privacy' | 'terms' | 'admin' | 'adminFanclub' | 'proposal' | 'notFound';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  path: string;
  query: URLSearchParams;
}

const TABLE: [RegExp, RouteName, string[]][] = [
  [/^\/$/, 'home', []],
  [/^\/matches$/, 'matches', []],
  [/^\/matches\/([^/]+)$/, 'match', ['id']],
  [/^\/teams$/, 'teams', []],
  [/^\/teams\/([^/]+)$/, 'team', ['id']],
  [/^\/players$/, 'players', []],
  [/^\/players\/([^/]+)$/, 'player', ['id']],
  [/^\/social$/, 'social', []],
  [/^\/videos$/, 'videos', []],
  [/^\/news$/, 'news', []],
  [/^\/play$/, 'play', []],
  [/^\/fantasy$/, 'fantasy', []],
  [/^\/fantasy\/([^/]+)$/, 'fantasyMatch', ['id']],
  [/^\/games$/, 'games', []],
  [/^\/games\/duel\/([A-Za-z0-9]{6})$/, 'duel', ['code']],
  [/^\/fanwall$/, 'fanwall', []],
  [/^\/fanwall\/([\w-]{1,40})$/, 'fanPost', ['id']],
  [/^\/contests$/, 'contests', []],
  [/^\/(prizes|draws)$/, 'prizes', ['_']],
  [/^\/leaderboard$/, 'leaderboard', []],
  [/^\/fans$/, 'fans', []],
  [/^\/forum$/, 'forum', []],
  [/^\/forum\/([^/]+)$/, 'thread', ['id']],
  [/^\/fanspaces$/, 'fanspaces', []],
  [/^\/growth$/, 'growth', []],
  [/^\/profile$/, 'profile', []],
  [/^\/rules$/, 'rules', []],
  [/^\/privacy$/, 'privacy', []],
  [/^\/terms$/, 'terms', []],
  [/^\/admin\/fanclub$/, 'adminFanclub', []],
  [/^\/admin(?:\/([a-z-]+))?$/, 'admin', ['section']],
  [/^\/proposal$/, 'proposal', []],
];

export function parseRoute(pathname: string, search = ''): Route {
  const path = (pathname.replace(/\/+$/, '') || '/').replace(/\/{2,}/g, '/');
  for (const [re, name, keys] of TABLE) {
    const m = path.match(re);
    if (m) {
      const params: Record<string, string> = {};
      keys.forEach((k, i) => {
        if (m[i + 1] !== undefined) {
          try {
            params[k] = decodeURIComponent(m[i + 1]);
          } catch {
            params[k] = m[i + 1];
          }
        }
      });
      return { name, params, path, query: new URLSearchParams(search) };
    }
  }
  return { name: 'notFound', params: {}, path, query: new URLSearchParams(search) };
}

const listeners = new Set<() => void>();
let snapshot = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
function emit() {
  snapshot = window.location.pathname + window.location.search;
  listeners.forEach(l => l());
}
if (typeof window !== 'undefined') window.addEventListener('popstate', emit);

export function navigate(to: string, opts: { replace?: boolean; keepScroll?: boolean } = {}) {
  if (typeof window === 'undefined') return;
  if (/^https?:\/\//.test(to)) {
    window.location.href = to;
    return;
  }
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to !== current) {
    if (opts.replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
  }
  emit();
  if (!opts.keepScroll) {
    const hash = to.split('#')[1];
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 60);
    else window.scrollTo({ top: 0 });
  }
}

export function useRoute(): Route {
  const loc = useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => '/',
  );
  const [path, search = ''] = loc.split('?');
  return parseRoute(path, search ? `?${search}` : '');
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean };
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(({ to, replace, onClick, children, ...rest }, ref) => (
  <a
    ref={ref}
    href={to}
    onClick={e => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || rest.target === '_blank') return;
      e.preventDefault();
      navigate(to, { replace });
    }}
    {...rest}
  >
    {children}
  </a>
));
Link.displayName = 'Link';

/** Sets the browser title and description while a page is shown (the server sets them for the first load). */
export function usePageMeta(title: string | null | undefined, description?: string, brand = 'ADT10 Fans') {
  useEffect(() => {
    if (!title) return;
    document.title = title.includes(brand) ? title : `${title} | ${brand}`;
    if (description) {
      let el = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.name = 'description';
        document.head.appendChild(el);
      }
      el.content = description;
    }
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) canonical.href = window.location.origin + window.location.pathname;
  }, [title, description, brand]);
}
