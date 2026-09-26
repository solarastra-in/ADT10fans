export interface SeoConfig {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article' | 'sports_event';
  teamName?: string;
  schema?: Record<string, any>;
}

export function updatePageSeo(config: SeoConfig) {
  if (typeof document === 'undefined') return;

  const siteName = 'Abu Dhabi T10 Fan Hub · Azlir Sport';
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://adt10.azlirsport.com';
  const canonicalUrl = `${baseUrl}${config.path === '/' ? '' : config.path}`;

  // 1. Update Document Title
  document.title = config.title;

  // 2. Helper to set or create meta tag
  const setMeta = (nameAttr: 'name' | 'property', attrValue: string, content: string) => {
    let element = document.querySelector(`meta[${nameAttr}="${attrValue}"]`) as HTMLMetaElement | null;
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(nameAttr, attrValue);
      document.head.appendChild(element);
    }
    element.content = content;
  };

  // Standard Meta Tags
  setMeta('name', 'description', config.description);
  setMeta('name', 'author', 'Azlir Sport');
  setMeta('name', 'copyright', 'Azlir Sport');
  setMeta('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

  // Open Graph
  setMeta('property', 'og:site_name', siteName);
  setMeta('property', 'og:title', config.title);
  setMeta('property', 'og:description', config.description);
  setMeta('property', 'og:url', canonicalUrl);
  setMeta('property', 'og:type', config.type || 'website');
  setMeta('property', 'og:locale', 'en_US');

  // Twitter
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', config.title);
  setMeta('name', 'twitter:description', config.description);
  setMeta('name', 'twitter:site', '@T10League');
  setMeta('name', 'twitter:creator', '@AzlirSport');

  // Canonical Link
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = canonicalUrl;

  // Schema.org Structured Data (JSON-LD)
  let script = document.getElementById('schema-jsonld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'schema-jsonld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }

  // Base Schema with Copyright by Azlir Sport
  const baseSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': config.title,
    'description': config.description,
    'url': canonicalUrl,
    'inLanguage': 'en-US',
    'publisher': {
      '@type': 'Organization',
      'name': 'Azlir Sport',
      'url': baseUrl,
      'logo': {
        '@type': 'ImageObject',
        'url': `${baseUrl}/logo.png`
      }
    },
    'copyrightHolder': {
      '@type': 'Organization',
      'name': 'Azlir Sport',
      'url': baseUrl
    },
    'copyrightYear': 2026,
    'license': 'Copyright by Azlir Sport. All rights reserved.'
  };

  // Merge with custom schema if provided
  const mergedSchema = config.schema ? { ...baseSchema, ...config.schema } : baseSchema;
  script.text = JSON.stringify(mergedSchema, null, 2);
}

export const ROUTE_SEO: Record<string, (param?: string | null) => SeoConfig> = {
  home: () => ({
    title: 'Abu Dhabi T10 Fan Hub – Live Scores, Verified Social & Fantasy | Azlir Sport',
    description: 'Official Abu Dhabi T10 League platform: real-time ball-by-ball scorecards, verified franchise social feeds, fantasy 10 predictor, and VIP draws. Copyright by Azlir Sport.',
    path: '/',
    schema: {
      '@type': 'SportsEvent',
      'name': 'Abu Dhabi T10 Cricket League 2026',
      'sport': 'Cricket',
      'location': {
        '@type': 'Place',
        'name': 'Zayed Cricket Stadium',
        'address': {
          '@type': 'PostalAddress',
          'addressLocality': 'Abu Dhabi',
          'addressCountry': 'United Arab Emirates'
        }
      }
    }
  }),
  matches: () => ({
    title: 'Abu Dhabi T10 Match Center – Live Scores, Fixtures & Ball-by-Ball | Azlir Sport',
    description: 'Track Abu Dhabi T10 live scores, match results, tournament points table, and ball-by-ball simulator for Zayed Stadium fixtures. Copyright by Azlir Sport.',
    path: '/matches',
    schema: {
      '@type': 'SportsEvent',
      'name': 'Abu Dhabi T10 Fixtures & Live Matches',
      'sport': 'Cricket'
    }
  }),
  teams: (teamId) => {
    if (teamId) {
      const teamNames: Record<string, string> = {
        aces: 'Arabian Aces',
        bulls: 'UAE Bulls',
        champions: 'Desert Royal Champions',
        tigers: 'United Tigers',
        lions: 'Yas Lions',
        eagles: 'Emirates Eagles'
      };
      const name = teamNames[teamId] || 'Abu Dhabi T10 Franchise';
      return {
        title: `${name} Official Franchise & Squad – Abu Dhabi T10 | Azlir Sport`,
        description: `Official roster, captain, icon player, live verified social feeds, match highlights, and fan war stats for ${name} in the Abu Dhabi T10. Copyright by Azlir Sport.`,
        path: `/teams/${teamId}`,
        teamName: name,
        schema: {
          '@type': 'SportsTeam',
          'name': name,
          'sport': 'Cricket',
          'memberOf': {
            '@type': 'SportsOrganization',
            'name': 'Abu Dhabi T10 League'
          }
        }
      };
    }
    return {
      title: 'Abu Dhabi T10 Franchises & Squads 2026 | Azlir Sport',
      description: 'Explore all 6 official Abu Dhabi T10 teams: Arabian Aces, UAE Bulls, Desert Royal Champions, Yas Lions, United Tigers, and Emirates Eagles. Copyright by Azlir Sport.',
      path: '/teams',
      schema: {
        '@type': 'SportsOrganization',
        'name': 'Abu Dhabi T10 Franchises'
      }
    };
  },
  social: () => ({
    title: 'Live Social Media Hub – Abu Dhabi T10 & Arabian Aces | Azlir Sport',
    description: 'Verified live postings, YouTube match broadcasts, press conferences, and breaking announcements from official T10 teams and league channels. Copyright by Azlir Sport.',
    path: '/social',
    schema: {
      '@type': 'CollectionPage',
      'name': 'Abu Dhabi T10 Live Social Curator'
    }
  }),
  contests: () => ({
    title: 'Fantasy 10 & Match Predictor – Abu Dhabi T10 Fan Arena | Azlir Sport',
    description: 'Play Abu Dhabi T10 Fantasy 10 cricket. Select your 6-star squad, predict boundary counts and match winners, and earn points on the leaderboard. Copyright by Azlir Sport.',
    path: '/contests',
    schema: {
      '@type': 'WebApplication',
      'name': 'Abu Dhabi T10 Fantasy 10 & Predictor',
      'applicationCategory': 'GameApplication'
    }
  }),
  draws: () => ({
    title: 'VIP Hospitality & Prize Draws – Abu Dhabi T10 | Azlir Sport',
    description: 'Enter free prize draws to win VIP President Box passes to the Abu Dhabi T10 Grand Final, signed team jerseys, and hospitality tickets. Copyright by Azlir Sport.',
    path: '/draws',
    schema: {
      '@type': 'SpecialAnnouncement',
      'name': 'Abu Dhabi T10 Fan Prize Draws & VIP Passports'
    }
  }),
  leaderboard: () => ({
    title: 'Franchise Fan Wars & Superfan Leaderboard | Azlir Sport',
    description: 'Compete in Abu Dhabi T10 Fan Wars. Rally behind Arabian Aces, maintain daily check-in streaks, and climb the superfan leaderboard. Copyright by Azlir Sport.',
    path: '/leaderboard',
    schema: {
      '@type': 'SportsOrganization',
      'name': 'Abu Dhabi T10 Fan Wars Leaderboard'
    }
  }),
  forum: () => ({
    title: 'Fan Discussion Forum – Abu Dhabi T10 Match Debates | Azlir Sport',
    description: 'Join passionate cricket discussions, tactical squad debates, player draft reactions, and live match threads across all franchises. Copyright by Azlir Sport.',
    path: '/forum',
    schema: {
      '@type': 'DiscussionForumPosting',
      'headline': 'Abu Dhabi T10 Fan Discussion Commons'
    }
  }),
  fanspaces: () => ({
    title: 'Global Physical Fan Spaces & Clubhouses – Abu Dhabi T10 | Azlir Sport',
    description: 'Experience Abu Dhabi T10 physical clubhouses in Abu Dhabi, Dubai, London, Mumbai, and Toronto. 360° LED screens, VR batting cages, and VIP passes. Copyright by Azlir Sport.',
    path: '/fanspaces',
    schema: {
      '@type': 'Place',
      'name': 'Abu Dhabi T10 Global Fan Spaces & Clubhouses',
      'description': 'Experiential physical fan clubhouses and viewing lounges in Abu Dhabi, Dubai, London, Mumbai, and Toronto.'
    }
  }),
  growth: () => ({
    title: 'Youth Cup & 50+ Creator Streamer Studio – Abu Dhabi T10 | Azlir Sport',
    description: 'Grassroots Youth T10 Tape-Ball Cup with equipment kit grants, verified cricket creator streamer studio, and real-time multilingual audio. Copyright by Azlir Sport.',
    path: '/growth',
    schema: {
      '@type': 'SportsEvent',
      'name': 'Abu Dhabi T10 Youth Cup & Creator Studio',
      'description': 'Grassroots youth cricket tournaments and global creator live watch-alongs.'
    }
  }),
  proposal: () => ({
    title: 'ADT10 League Expansion Proposal & Fan Space Strategy | Azlir Sport',
    description: 'Turnkey board-level expansion strategy for Abu Dhabi T10, featuring physical fan spaces across 5 global cities, USD/AED budgets, and ROI models. Copyright by Azlir Sport.',
    path: '/proposal',
    type: 'article',
    schema: {
      '@type': 'Article',
      'headline': 'Abu Dhabi T10 League Global Fan Base & Fan Spaces Proposal',
      'author': {
        '@type': 'Organization',
        'name': 'Azlir Sport'
      }
    }
  }),
  profile: () => ({
    title: 'Fan Trophy Room & Achievement Badges | Azlir Sport',
    description: 'View your unlocked metallic badges, streak multiplier, contest records, and fantasy cricket stats in the Abu Dhabi T10 Hub. Copyright by Azlir Sport.',
    path: '/profile'
  }),
  admin: () => ({
    title: 'Admin Console & Autonomous AI Agents | Azlir Sport',
    description: 'Control autonomous AI social curation agents, news crawlers, and tournament operations for the Abu Dhabi T10 League. Copyright by Azlir Sport.',
    path: '/admin'
  })
};
