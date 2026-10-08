export interface SeoConfig {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  /** true for private pages (admin, profile, proposal) */
  noindex?: boolean;
  schema?: Record<string, any>;
}

export interface SeoContext {
  brandName?: string;
  copyrightHolder?: string;
  teamName?: string;
}

const DEFAULT_BRAND = 'ADT10 Fans';
const DEFAULT_HOLDER = 'Azlir Sports';

let currentContext: SeoContext = {};

/** Set brand/copyright once config has loaded; later updatePageSeo calls use it. */
export function setSeoContext(ctx: SeoContext) {
  currentContext = { ...currentContext, ...ctx };
}

export function updatePageSeo(config: SeoConfig) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const brand = currentContext.brandName || DEFAULT_BRAND;
  const holder = currentContext.copyrightHolder || DEFAULT_HOLDER;
  const baseUrl = window.location.origin;
  const canonicalUrl = `${baseUrl}${config.path === '/' ? '/' : config.path}`;

  document.title = config.title;

  const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
    let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  setMeta('name', 'description', config.description);
  setMeta('name', 'author', holder);
  setMeta('name', 'copyright', holder);
  setMeta('name', 'robots', config.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');

  setMeta('property', 'og:site_name', brand);
  setMeta('property', 'og:title', config.title);
  setMeta('property', 'og:description', config.description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:type', config.type || 'website');
  setMeta('property', 'og:locale', 'en_US');

  setMeta('name', 'twitter:card', 'summary');
  setMeta('name', 'twitter:title', config.title);
  setMeta('name', 'twitter:description', config.description);

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  let script = document.getElementById('schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  const schema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}/#website`,
        name: brand,
        url: `${baseUrl}/`,
        inLanguage: 'en',
        publisher: { '@type': 'Organization', name: holder },
        copyrightHolder: { '@type': 'Organization', name: holder },
      },
      {
        '@type': 'WebPage',
        name: config.title,
        description: config.description,
        url: canonicalUrl,
        isPartOf: { '@id': `${baseUrl}/#website` },
        ...(config.schema || {}),
      },
    ],
  };
  script.text = JSON.stringify(schema);
}

const t = (page: string) => `${page} · ${currentContext.brandName || DEFAULT_BRAND}`;

export const ROUTE_SEO: Record<string, (param?: string | null, ctx?: SeoContext) => SeoConfig> = {
  home: () => ({
    title: `${currentContext.brandName || DEFAULT_BRAND} — Abu Dhabi T10 fan hub`,
    description: 'Abu Dhabi T10 fan hub: fixtures, teams, contests, draws and social feeds.',
    path: '/',
  }),
  matches: () => ({
    title: t('Fixtures & results'),
    description: 'Abu Dhabi T10 fixtures, live scores and results.',
    path: '/matches',
  }),
  teams: (teamId, ctx) => {
    if (teamId) {
      const name = ctx?.teamName || 'Team';
      return {
        title: t(`${name} — squad`),
        description: `${name}: squad, key players and official social channels.`,
        path: `/teams/${encodeURIComponent(teamId)}`,
      };
    }
    return {
      title: t('Teams & squads'),
      description: 'Abu Dhabi T10 franchises and their squads.',
      path: '/teams',
    };
  },
  social: () => ({
    title: t('Social feeds'),
    description: 'Posts and videos from official Abu Dhabi T10 team and league channels.',
    path: '/social',
  }),
  contests: () => ({
    title: t('Contests'),
    description: 'Free fan prediction contests and trivia for the Abu Dhabi T10.',
    path: '/contests',
  }),
  draws: () => ({
    title: t('Prize draws'),
    description: 'Free-entry fan prize draws.',
    path: '/draws',
  }),
  leaderboard: () => ({
    title: t('Fan Wars leaderboard'),
    description: 'Fan points leaderboard by franchise and top fans.',
    path: '/leaderboard',
  }),
  forum: () => ({
    title: t('Fan forum'),
    description: 'Fan discussions about matches, teams and tactics.',
    path: '/forum',
  }),
  fanspaces: () => ({
    title: t('Fan spaces'),
    description: 'Places to watch Abu Dhabi T10 matches with other fans.',
    path: '/fanspaces',
  }),
  growth: () => ({
    title: t('Youth & creators'),
    description: 'Youth cricket, creator partners and commentary feeds.',
    path: '/growth',
  }),
  proposal: () => ({
    title: t('League proposal'),
    description: 'Admin only.',
    path: '/proposal',
    noindex: true,
  }),
  profile: () => ({
    title: t('My profile'),
    description: 'Your points, streak and badges.',
    path: '/profile',
    noindex: true,
  }),
  admin: () => ({
    title: t('Admin console'),
    description: 'Admin console.',
    path: '/admin',
    noindex: true,
  }),
};
