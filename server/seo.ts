import { AppStore, Match, Player, Team } from './db';

/**
 * Server-rendered SEO for every public page.
 *
 * Each URL gets its own title, description, canonical link, Open Graph/Twitter tags and schema.org
 * JSON-LD, plus a plain-HTML version of the page's main content inside #root. Browsers replace that
 * content with the app as soon as JavaScript runs; crawlers and link previews read it directly.
 * Unknown URLs get a real 404.
 */

export interface RenderedPage {
  status: number;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  image?: string;
  type: 'website' | 'article' | 'profile';
  jsonLd: object[];
  body: string;
}

const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const clip = (s: string, n = 158) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const ROLE: Record<Player['role'], string> = { batter: 'Batter', bowler: 'Bowler', allrounder: 'All-rounder', wicketkeeper: 'Wicketkeeper' };
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' GST';
  } catch {
    return iso;
  }
};

export const INDEXABLE_STATIC = ['/', '/matches', '/teams', '/players', '/social', '/videos', '/news', '/play', '/fantasy', '/games', '/contests', '/prizes', '/leaderboard', '/fans', '/forum', '/fanspaces', '/rules', '/privacy', '/terms'];
const PRIVATE = ['/admin', '/proposal', '/profile'];

function teamName(store: AppStore, id: string) {
  return store.teams.find(t => t.id === id)?.name || id;
}

export function matchTitle(store: AppStore, m: Match) {
  return `${teamName(store, m.teamA)} vs ${teamName(store, m.teamB)}`;
}

/** The URL slug for a match: /matches/<id>. Ids are stable; the team names go in the title. */
export const matchPath = (m: Match) => `/matches/${encodeURIComponent(m.id)}`;
export const teamPath = (t: Team) => `/teams/${encodeURIComponent(t.id)}`;
export const playerPath = (p: Player) => `/players/${encodeURIComponent(p.id)}`;

function nav() {
  const links = [
    ['/', 'Home'], ['/matches', 'Matches'], ['/teams', 'Teams'], ['/players', 'Players'], ['/videos', 'Videos'], ['/social', 'Social'], ['/news', 'News'],
    ['/fantasy', 'Pick XI'], ['/games', 'Daily games'], ['/contests', 'Predictions'], ['/prizes', 'Prizes'], ['/leaderboard', 'Leaderboard'], ['/fans', 'Fan base'], ['/forum', 'Forum'], ['/fanspaces', 'Fan Spaces'],
  ];
  return `<nav aria-label="Site"><ul>${links.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul></nav>`;
}

function shell(h1: string, intro: string, inner: string) {
  return `<div class="seo-ssr">${nav()}<main><h1>${esc(h1)}</h1>${intro ? `<p>${esc(intro)}</p>` : ''}${inner}</main><footer><p><a href="/rules">Rules</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p></footer></div>`;
}

function matchLine(store: AppStore, m: Match) {
  const score = [m.scoreA && `${teamName(store, m.teamA)} ${m.scoreA}`, m.scoreB && `${teamName(store, m.teamB)} ${m.scoreB}`].filter(Boolean).join(', ');
  return `<li><a href="${matchPath(m)}">Match ${m.matchNo}: ${esc(matchTitle(store, m))}</a> · ${esc(fmtDate(m.startsAt))}${m.status === 'completed' && m.result ? ` · ${esc(m.result)}` : score ? ` · ${esc(score)}` : ''}</li>`;
}

function sportsEvent(store: AppStore, m: Match, base: string) {
  const a = store.teams.find(t => t.id === m.teamA);
  const b = store.teams.find(t => t.id === m.teamB);
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: `${matchTitle(store, m)} – ${store.settings.seasonLabel || 'Abu Dhabi T10'}, Match ${m.matchNo}`,
    sport: 'Cricket',
    startDate: m.startsAt,
    eventStatus: m.status === 'abandoned' ? 'https://schema.org/EventCancelled' : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: m.venue || store.settings.venue, address: 'Abu Dhabi, United Arab Emirates' },
    competitor: [a, b].filter(Boolean).map(t => ({ '@type': 'SportsTeam', name: t!.name, url: `${base}${teamPath(t!)}` })),
    url: `${base}${matchPath(m)}`,
  };
}

export function renderPage(rawPath: string, store: AppStore, base: string): RenderedPage {
  const path = (rawPath.split('?')[0] || '/').replace(/\/+$/, '') || '/';
  const brand = store.settings.brandName || 'ADT10 Fans';
  const season = store.settings.seasonLabel || 'Abu Dhabi T10 2026';
  const parts = path.split('/').filter(Boolean).map(p => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const page = (p: Partial<RenderedPage> & Pick<RenderedPage, 'title' | 'description' | 'body'>): RenderedPage => ({
    status: 200,
    canonical: `${base}${path === '/' ? '/' : path}`,
    robots: 'index, follow, max-image-preview:large',
    type: 'website',
    jsonLd: [],
    ...p,
    title: p.title.includes(brand) ? p.title : `${p.title} | ${brand}`,
    description: clip(p.description),
  });
  const notFound = () =>
    page({ status: 404, robots: 'noindex', title: 'Page not found', description: `This page does not exist on ${brand}.`, body: shell('Page not found', 'The page you asked for does not exist. Try the links above.', '') });

  const upcoming = [...store.matches].filter(m => m.status === 'upcoming' || m.status === 'live').sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const recent = [...store.matches].filter(m => m.status === 'completed').sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const visibleFeed = store.feedItems.filter(f => f.status !== 'hidden');

  if (PRIVATE.some(p => path === p || path.startsWith(p + '/'))) {
    return page({ robots: 'noindex, nofollow', title: path.startsWith('/profile') ? 'My profile' : 'Admin', description: `${brand}`, body: shell(brand, '', '') });
  }

  switch (parts[0] || '') {
    case '': {
      const teams = store.teams.map(t => `<li><a href="${teamPath(t)}">${esc(t.name)}</a></li>`).join('');
      return page({
        title: `${brand}: ${season} fixtures, squads, Pick XI and fan games`,
        description: `${season} at ${store.settings.venue}: live scores, all six squads, official team videos and posts, Pick XI fantasy, daily games, predictions, prizes and the fan forum.`,
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: `${base}/`, description: store.settings.tagline || 'The Abu Dhabi T10 fan hub' },
          {
            '@context': 'https://schema.org',
            '@type': 'SportsEvent',
            name: season,
            sport: 'Cricket',
            startDate: store.settings.seasonStart,
            endDate: store.settings.seasonEnd,
            location: { '@type': 'Place', name: store.settings.venue, address: 'Abu Dhabi, United Arab Emirates' },
            url: `${base}/`,
          },
        ],
        body: shell(
          `${season} fan hub`,
          `${season} runs from ${store.settings.seasonStart} to ${store.settings.seasonEnd} at ${store.settings.venue}.`,
          `<h2>Teams</h2><ul>${teams}</ul>` +
            (upcoming.length ? `<h2>Next matches</h2><ul>${upcoming.slice(0, 6).map(m => matchLine(store, m)).join('')}</ul>` : '') +
            (recent.length ? `<h2>Results</h2><ul>${recent.slice(0, 6).map(m => matchLine(store, m)).join('')}</ul>` : ''),
        ),
      });
    }
    case 'matches': {
      if (parts[1]) {
        const m = store.matches.find(x => x.id === parts[1]);
        if (!m) return notFound();
        const title = `${matchTitle(store, m)}, Match ${m.matchNo}: ${m.status === 'completed' ? 'result and scorecard' : m.status === 'live' ? 'live score' : 'preview'}`;
        const desc =
          m.status === 'completed'
            ? `${matchTitle(store, m)} (${season}, match ${m.matchNo}): ${m.result || 'result'}. ${[m.scoreA && `${teamName(store, m.teamA)} ${m.scoreA}`, m.scoreB && `${teamName(store, m.teamB)} ${m.scoreB}`].filter(Boolean).join(', ')}. Full scorecard and Pick XI points.`
            : `${matchTitle(store, m)}, ${season} match ${m.matchNo}, ${fmtDate(m.startsAt)} at ${m.venue}. Squads, Pick XI and predictions.`;
        const card = (inn: any) =>
          inn
            ? `<h2>${esc(inn.teamName || teamName(store, inn.teamId))} ${esc(inn.totalRuns)}/${esc(inn.wickets)} (${esc(inn.overs)} ov)</h2><table><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr></thead><tbody>${(inn.batting || []).map((b: any) => `<tr><td>${esc(b.batsman)} <small>${esc(b.dismissal)}</small></td><td>${esc(b.runs)}</td><td>${esc(b.balls)}</td><td>${esc(b.fours)}</td><td>${esc(b.sixes)}</td></tr>`).join('')}</tbody></table>`
            : '';
        return page({
          title,
          description: desc,
          type: 'article',
          jsonLd: [sportsEvent(store, m, base)],
          body: shell(
            `${matchTitle(store, m)} – Match ${m.matchNo}`,
            `${fmtDate(m.startsAt)} · ${m.venue}${m.result ? ` · ${m.result}` : ''}`,
            card(m.scorecard?.innings1) + card(m.scorecard?.innings2) + `<p><a href="/fantasy/${encodeURIComponent(m.id)}">Pick XI for this match</a></p>`,
          ),
        });
      }
      return page({
        title: `${season} fixtures, results and live scores`,
        description: `Every ${season} fixture with start times in UAE time, live scores, results and full scorecards.`,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: [...upcoming, ...recent].slice(0, 50).map((m, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}${matchPath(m)}`, name: matchTitle(store, m) })) }],
        body: shell(
          `${season} matches`,
          store.matches.length ? '' : `Fixtures will be listed here as soon as the league publishes them. The season starts on ${store.settings.seasonStart}.`,
          (upcoming.length ? `<h2>Upcoming and live</h2><ul>${upcoming.map(m => matchLine(store, m)).join('')}</ul>` : '') + (recent.length ? `<h2>Results</h2><ul>${recent.map(m => matchLine(store, m)).join('')}</ul>` : ''),
        ),
      });
    }
    case 'teams': {
      if (parts[1]) {
        const t = store.teams.find(x => x.id === parts[1]);
        if (!t) return notFound();
        const handles = store.handles.filter(h => h.teamId === t.id && h.status === 'verified');
        return page({
          title: `${t.name} squad ${season.match(/\d{4}/)?.[0] || ''}: players, fixtures and official channels`.replace(/\s+/g, ' '),
          description: `${t.name} at the ${season}: full ${t.squad.length}-player squad${t.iconPlayer ? ` led by icon player ${t.iconPlayer}` : ''}${t.headCoach ? `, head coach ${t.headCoach}` : ''}. Fixtures, results, videos and official social accounts.`,
          image: t.logo,
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'SportsTeam',
              name: t.name,
              sport: 'Cricket',
              url: `${base}${teamPath(t)}`,
              memberOf: { '@type': 'SportsOrganization', name: 'Abu Dhabi T10' },
              ...(t.headCoach ? { coach: { '@type': 'Person', name: t.headCoach } } : {}),
              athlete: t.squad.map(p => ({ '@type': 'Person', name: p.name, url: `${base}${playerPath(p)}` })),
              sameAs: [t.website, ...handles.map(h => h.url)].filter(Boolean),
            },
          ],
          body: shell(
            `${t.name} squad`,
            [t.iconPlayer && `Icon player: ${t.iconPlayer}.`, t.headCoach && `Head coach: ${t.headCoach}.`].filter(Boolean).join(' '),
            `<h2>Players</h2><ul>${t.squad.map(p => `<li><a href="${playerPath(p)}">${esc(p.name)}</a> – ${esc(ROLE[p.role])}${p.category ? ` (${esc(p.category)})` : ''}</li>`).join('')}</ul>` +
              (handles.length ? `<h2>Official channels</h2><ul>${handles.map(h => `<li><a href="${esc(h.url)}" rel="noopener">${esc(h.platform)} ${esc(h.handle)}</a></li>`).join('')}</ul>` : '') +
              (() => {
                const teamPosts = visibleFeed.filter(f => f.teamId === t.id && f.category === 'social').slice(0, 5);
                return teamPosts.length ? `<h2>Latest official social posts</h2><ul>${teamPosts.map(p => `<li><strong>${esc(p.platform)} ${esc(p.source)}:</strong> ${esc(p.title)}</li>`).join('')}</ul>` : '';
              })() +
              `<h2>Fixtures</h2><ul>${store.matches.filter(m => m.teamA === t.id || m.teamB === t.id).map(m => matchLine(store, m)).join('') || '<li>Fixtures not published yet.</li>'}</ul>`,
          ),
        });
      }
      return page({
        title: `${season} teams and squads`,
        description: `All six ${season} franchises and their squads: ${store.teams.map(t => t.name).join(', ')}.`,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: store.teams.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}${teamPath(t)}`, name: t.name })) }],
        body: shell(`${season} teams`, '', `<ul>${store.teams.map(t => `<li><a href="${teamPath(t)}">${esc(t.name)}</a> – ${t.squad.length} players${t.iconPlayer ? `, icon ${esc(t.iconPlayer)}` : ''}</li>`).join('')}</ul>`),
      });
    }
    case 'players': {
      if (parts[1]) {
        const team = store.teams.find(t => t.squad.some(p => p.id === parts[1]));
        const p = team?.squad.find(x => x.id === parts[1]);
        if (!team || !p) return notFound();
        return page({
          title: `${p.name} – ${team.name} ${ROLE[p.role].toLowerCase()}`,
          description: `${p.name} plays for ${team.name} at the ${season} as a ${ROLE[p.role].toLowerCase()}${p.category ? ` (${p.category} signing)` : ''}.${p.battingStyle ? ` ${p.battingStyle}.` : ''}${p.bowlingStyle ? ` ${p.bowlingStyle}.` : ''}`,
          type: 'profile',
          image: p.photoUrl,
          jsonLd: [{ '@context': 'https://schema.org', '@type': 'Person', name: p.name, url: `${base}${playerPath(p)}`, memberOf: { '@type': 'SportsTeam', name: team.name, url: `${base}${teamPath(team)}` }, ...(p.cricbuzzProfileUrl ? { sameAs: [p.cricbuzzProfileUrl] } : {}) }],
          body: shell(p.name, `${ROLE[p.role]} for ${team.name}.`, `<p><a href="${teamPath(team)}">${esc(team.name)} squad</a>${p.cricbuzzProfileUrl ? ` · <a href="${esc(p.cricbuzzProfileUrl)}" rel="noopener">Career stats on Cricbuzz</a>` : ''}</p>`),
        });
      }
      const all = store.teams.flatMap(t => t.squad.map(p => ({ p, t })));
      return page({
        title: `${season} players`,
        description: `All ${all.length} players in the ${season} squads, by team and role.`,
        body: shell(`${season} players`, '', store.teams.map(t => `<h2>${esc(t.name)}</h2><ul>${t.squad.map(p => `<li><a href="${playerPath(p)}">${esc(p.name)}</a> – ${esc(ROLE[p.role])}</li>`).join('')}</ul>`).join('')),
      });
    }
    case 'social':
    case 'videos':
    case 'news': {
      if (parts[1]) return notFound();
      const kind = parts[0];
      const items = visibleFeed.filter(f => (kind === 'news' ? f.category === 'news' : kind === 'videos' ? f.platform === 'YouTube' : f.category !== 'news')).slice(0, 30);
      const heading = kind === 'news' ? `${season} news` : kind === 'videos' ? `${season} videos` : 'Official team and league social feeds';
      return page({
        title: heading,
        description:
          kind === 'news'
            ? `Latest ${season} headlines from cricket publishers, linked to the original articles.`
            : kind === 'videos'
              ? `Watch the latest videos from the league's and teams' official YouTube channels, right on the site.`
              : `Posts and videos from the verified accounts of the league and all six franchises, in one place.`,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: heading, url: `${base}/${kind}` }],
        body: shell(heading, items.length ? '' : 'New posts appear here as soon as the official accounts publish them.', `<ul>${items.map(f => `<li><a href="${esc(f.url)}" rel="noopener">${esc(f.title)}</a> – ${esc(f.source)}</li>`).join('')}</ul>`),
      });
    }
    case 'fantasy': {
      if (parts[1]) {
        const m = store.matches.find(x => x.id === parts[1]);
        if (!m) return notFound();
        return page({
          title: `Pick XI: ${matchTitle(store, m)} (match ${m.matchNo})`,
          description: `Pick your Pick XI for ${matchTitle(store, m)}: 11 players, 100 credits, captain scores double. Free to play; points count towards the season leaderboard.`,
          body: shell(`Pick XI: ${matchTitle(store, m)}`, `Lineups lock at ${fmtDate(m.startsAt)}.`, `<p><a href="${matchPath(m)}">Match page</a> · <a href="/rules#dream-xi">Scoring rules</a></p>`),
        });
      }
      return page({
        title: 'Pick XI fantasy cricket for the Abu Dhabi T10',
        description: 'Free fantasy cricket for every match: pick 11 players within 100 credits, choose a captain (2x) and vice-captain (1.5x), and climb the season leaderboard or your private league.',
        body: shell('Pick XI', 'Pick 11 players for each match, within 100 credits and no more than 7 from one team.', `<ul>${upcoming.map(m => `<li><a href="/fantasy/${encodeURIComponent(m.id)}">${esc(matchTitle(store, m))}</a> – locks ${esc(fmtDate(m.startsAt))}</li>`).join('')}</ul><p><a href="/rules#dream-xi">How points are scored</a></p>`),
      });
    }
    case 'play':
    case 'games':
    case 'contests':
    case 'prizes':
    case 'leaderboard':
    case 'fans':
    case 'fanspaces':
    case 'growth':
    case 'rules':
    case 'privacy':
    case 'terms': {
      if (parts[1]) return notFound();
      const meta: Record<string, [string, string, string]> = {
        play: ['Play: Pick XI, daily games and predictions', 'Free games for Abu Dhabi T10 fans: Pick XI fantasy, Guess the Player, Super Over and match predictions. Earn points for your team.', 'Play'],
        games: ['Daily cricket games: Guess the Player and Super Over', 'Two new games every day: guess the mystery Abu Dhabi T10 player in five tries, and bat a Super Over to beat the day\'s target.', 'Daily games'],
        contests: ['Match predictions and quizzes', 'Predict match winners, top scorers and sixes, and take instant T10 quizzes for points.', 'Predictions'],
        prizes: ['Prizes and prize draws', 'Spend your fan points on rewards, and enter free prize draws with a verifiable result.', 'Prizes'],
        leaderboard: ['Fan leaderboard and Fan Wars', 'The top fans of the season and the Fan Wars table: which franchise has the most active supporters.', 'Leaderboard'],
        fans: ['Fan base: supporters of every team', 'How many fans back each Abu Dhabi T10 team, where they are, and the top supporters of each franchise.', 'Fan base'],
        fanspaces: ['Fan Spaces and watch parties', 'Official Abu Dhabi T10 screening venues and watch parties. Book a free pass and check in with your QR code.', 'Fan Spaces'],
        growth: ['Youth cup and creators', 'The schools youth cup, creator partners and commentary feeds.', 'Community programmes'],
        rules: ['Rules and scoring', 'How Pick XI points, predictions, daily games, prize draws and referral rewards work.', 'Rules'],
        privacy: ['Privacy', 'What the site stores about you and why.', 'Privacy'],
        terms: ['Terms of use', 'Terms for using the fan hub, its games and prize draws.', 'Terms'],
      };
      const [title, description, h1] = meta[parts[0]];
      let inner = '';
      if (parts[0] === 'leaderboard' || parts[0] === 'fans') {
        const counts = new Map<string, number>();
        for (const u of store.users) if (u.teamId) counts.set(u.teamId, (counts.get(u.teamId) || 0) + 1);
        inner = `<ul>${store.teams.map(t => `<li><a href="${teamPath(t)}">${esc(t.name)}</a>: ${counts.get(t.id) || 0} fans</li>`).join('')}</ul>`;
      }
      if (parts[0] === 'fanspaces') inner = `<ul>${store.fanSpaces.map(s => `<li>${esc(s.name)}, ${esc(s.city)}</li>`).join('')}</ul>`;
      if (parts[0] === 'prizes') inner = `<ul>${store.prizes.filter(p => p.active).map(p => `<li>${esc(p.title)} – ${p.pointsCost} points</li>`).join('')}${store.draws.map(d => `<li>Draw: ${esc(d.title)} – ${esc(d.prize)}</li>`).join('')}</ul>`;
      if (parts[0] === 'growth' && !store.youthSchools.length && !store.creatorPartners.length && !store.commentaryFeeds.length) {
        return { ...page({ title, description, body: shell(h1, '', '') }), robots: 'noindex, follow' };
      }
      return page({ title, description, body: shell(h1, description, inner) });
    }
    case 'forum': {
      if (parts[1]) {
        const t = store.forumThreads.find(x => x.id === parts[1] && !x.hidden);
        if (!t) return notFound();
        const comments = store.forumComments.filter(c => c.threadId === t.id && !c.hidden).slice(0, 50);
        return page({
          title: t.title,
          description: t.content.replace(/\s+/g, ' '),
          type: 'article',
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'DiscussionForumPosting',
              headline: t.title,
              text: t.content.slice(0, 1000),
              datePublished: t.createdAt,
              author: { '@type': 'Person', name: t.userName },
              url: `${base}/forum/${encodeURIComponent(t.id)}`,
              commentCount: t.commentsCount,
              interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/LikeAction', userInteractionCount: t.upvotes },
            },
          ],
          body: shell(t.title, `${t.userName} · ${fmtDate(t.createdAt)}`, `<article><p>${esc(t.content)}</p></article>${comments.map(c => `<section><h2>${esc(c.userName)}</h2><p>${esc(c.content)}</p></section>`).join('')}`),
        });
      }
      const threads = store.forumThreads.filter(t => !t.hidden).slice(0, 50);
      return page({
        title: 'Fan forum: match talk, tactics and team chat',
        description: 'Talk about every Abu Dhabi T10 match with other fans: matchday threads, team selection, Pick XI tips and Fan Space meet-ups.',
        body: shell('Fan forum', '', `<ul>${threads.map(t => `<li><a href="/forum/${encodeURIComponent(t.id)}">${esc(t.title)}</a> – ${t.commentsCount} replies</li>`).join('')}</ul>`),
      });
    }
    default:
      return notFound();
  }
}

/** Injects the rendered page into the HTML template (index.html / dist/_template.html). */
export function injectIntoTemplate(template: string, p: RenderedPage, brand: string): string {
  const jsonLd = p.jsonLd.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n    ');
  const head = [
    `<title>${esc(p.title)}</title>`,
    `<meta name="description" content="${esc(p.description)}" />`,
    `<meta name="robots" content="${esc(p.robots)}" />`,
    `<link rel="canonical" href="${esc(p.canonical)}" />`,
    `<meta property="og:site_name" content="${esc(brand)}" />`,
    `<meta property="og:type" content="${p.type}" />`,
    `<meta property="og:title" content="${esc(p.title)}" />`,
    `<meta property="og:description" content="${esc(p.description)}" />`,
    `<meta property="og:url" content="${esc(p.canonical)}" />`,
    p.image ? `<meta property="og:image" content="${esc(p.image)}" />` : '',
    `<meta name="twitter:card" content="${p.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" />`,
    jsonLd,
  ]
    .filter(Boolean)
    .join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')
    .replace(/<meta\s+name="robots"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>/gi, '')
    .replace(/<script id="schema-jsonld"[\s\S]*?<\/script>/i, '')
    .replace('<!--app-head-->', head)
    .replace('<div id="root"></div>', `<div id="root">${p.body}</div>`);
}

export function sitemapXml(store: AppStore, base: string) {
  const today = new Date().toISOString().slice(0, 10);
  const urls: { loc: string; lastmod?: string; priority?: string }[] = [];
  for (const p of INDEXABLE_STATIC) urls.push({ loc: p, priority: p === '/' ? '1.0' : '0.7' });
  if (store.youthSchools.length || store.creatorPartners.length || store.commentaryFeeds.length) urls.push({ loc: '/growth' });
  for (const t of store.teams) urls.push({ loc: teamPath(t), lastmod: t.updatedAt?.slice(0, 10), priority: '0.8' });
  for (const t of store.teams) for (const p of t.squad) urls.push({ loc: playerPath(p), lastmod: t.updatedAt?.slice(0, 10), priority: '0.5' });
  for (const m of store.matches) {
    urls.push({ loc: matchPath(m), lastmod: m.updatedAt?.slice(0, 10), priority: '0.8' });
    if (m.status === 'upcoming') urls.push({ loc: `/fantasy/${encodeURIComponent(m.id)}`, lastmod: m.updatedAt?.slice(0, 10), priority: '0.6' });
  }
  for (const t of store.forumThreads.filter(x => !x.hidden).slice(0, 2000)) urls.push({ loc: `/forum/${encodeURIComponent(t.id)}`, lastmod: (t.lastActivityAt || t.createdAt).slice(0, 10), priority: '0.4' });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map(u => `  <url><loc>${esc(base + u.loc)}</loc><lastmod>${u.lastmod || today}</lastmod>${u.priority ? `<priority>${u.priority}</priority>` : ''}</url>`).join('\n') +
    `\n</urlset>\n`
  );
}

export function robotsTxt(base: string) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /proposal\nDisallow: /profile\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml\n`;
}
