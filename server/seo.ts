import { AppStore, Match, Player, Team } from './db';
import { ogUrl } from './ogImage';
import { LINK_KEYS, LINK_LABELS, linksFor } from './playerLinks';
import { statsFor } from './playerStats';
import { careerFor } from './careerStats';
import { resolvePlayer } from './fantasy';

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
  imageAlt?: string;
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

export const INDEXABLE_STATIC = ['/', '/matches', '/teams', '/players', '/social', '/videos', '/news', '/play', '/fantasy', '/games', '/fanwall', '/contests', '/prizes', '/leaderboard', '/fans', '/forum', '/fanspaces', '/rules', '/privacy', '/terms'];
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
    ['/fantasy', 'Pick XI'], ['/games', 'Daily games'], ['/fanwall', 'Fan wall'], ['/contests', 'Predictions'], ['/prizes', 'Prizes'], ['/leaderboard', 'Leaderboard'], ['/fans', 'Fan base'], ['/forum', 'Forum'], ['/fanspaces', 'Fan Spaces'],
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
    endDate: new Date(+new Date(m.startsAt) + 3 * 3600_000).toISOString(),
    location: { '@type': 'Place', name: m.venue || store.settings.venue, address: { '@type': 'PostalAddress', addressLocality: 'Abu Dhabi', addressCountry: 'AE' } },
    competitor: [a, b].filter(Boolean).map(t => ({ '@type': 'SportsTeam', name: t!.name, url: `${base}${teamPath(t!)}` })),
    ...(a ? { homeTeam: { '@type': 'SportsTeam', name: a.name, url: `${base}${teamPath(a)}` } } : {}),
    ...(b ? { awayTeam: { '@type': 'SportsTeam', name: b.name, url: `${base}${teamPath(b)}` } } : {}),
    organizer: { '@type': 'SportsOrganization', name: 'Abu Dhabi T10', url: 'https://www.abudhabit10.com' },
    image: [ogUrl(base, 'match', m.id)],
    description: m.status === 'completed' && m.result ? m.result : `Match ${m.matchNo} of the ${store.settings.seasonLabel || 'Abu Dhabi T10'}`,
    url: `${base}${matchPath(m)}`,
  };
}

/** schema.org BreadcrumbList: [name, path] pairs from the home page down. */
function breadcrumbs(base: string, trail: [string, string][]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'] as [string, string], ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${base}${path}` })),
  };
}

/** Links a scorecard name to the player's page when it matches someone in the two squads. */
function playerName(store: AppStore, m: Match, name: string) {
  const pool = store.teams.filter(t => t.id === m.teamA || t.id === m.teamB).flatMap(t => t.squad);
  const p = resolvePlayer(name, pool);
  return p ? `<a href="${playerPath(p)}">${esc(name)}</a>` : esc(name);
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
    image: ogUrl(base, 'site'),
    imageAlt: `${brand}: ${season}`,
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
          { '@context': 'https://schema.org', '@type': 'WebSite', name: brand, url: `${base}/`, description: store.settings.tagline || 'The Abu Dhabi T10 fan hub', inLanguage: ['en', 'ar', 'hi', 'ur'] },
          {
            '@context': 'https://schema.org',
            '@type': 'SportsOrganization',
            name: 'Abu Dhabi T10',
            sport: 'Cricket',
            url: 'https://www.abudhabit10.com',
            sameAs: store.handles.filter(h => !h.teamId && h.status === 'verified').map(h => h.url),
            member: store.teams.map(t => ({ '@type': 'SportsTeam', name: t.name, url: `${base}${teamPath(t)}` })),
          },
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
            ? `<h2>${esc(inn.teamName || teamName(store, inn.teamId))} ${esc(inn.totalRuns)}/${esc(inn.wickets)} (${esc(inn.overs)} ov)</h2><table><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr></thead><tbody>${(inn.batting || []).map((b: any) => `<tr><td>${playerName(store, m, b.batsman)} <small>${esc(b.dismissal)}</small></td><td>${esc(b.runs)}</td><td>${esc(b.balls)}</td><td>${esc(b.fours)}</td><td>${esc(b.sixes)}</td></tr>`).join('')}</tbody></table>` +
              ((inn.bowling || []).length ? `<table><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead><tbody>${inn.bowling.map((b: any) => `<tr><td>${playerName(store, m, b.bowler)}</td><td>${esc(b.overs)}</td><td>${esc(b.runs)}</td><td>${esc(b.wickets)}</td></tr>`).join('')}</tbody></table>` : '')
            : '';
        const squads = [m.teamA, m.teamB]
          .map(id => store.teams.find(t => t.id === id))
          .filter(Boolean)
          .map(t => `<h2>${esc(t!.name)} squad</h2><ul>${t!.squad.map(p => `<li><a href="${playerPath(p)}">${esc(p.name)}</a> – ${esc(ROLE[p.role])}</li>`).join('')}</ul>`)
          .join('');
        return page({
          title,
          description: desc,
          type: 'article',
          image: ogUrl(base, 'match', m.id),
          imageAlt: `${matchTitle(store, m)}, match ${m.matchNo}`,
          jsonLd: [sportsEvent(store, m, base), breadcrumbs(base, [['Matches', '/matches'], [`Match ${m.matchNo}: ${matchTitle(store, m)}`, matchPath(m)]])],
          body: shell(
            `${matchTitle(store, m)} – Match ${m.matchNo}`,
            `${fmtDate(m.startsAt)} · ${m.venue}${m.result ? ` · ${m.result}` : ''}`,
            card(m.scorecard?.innings1) + card(m.scorecard?.innings2) + `<p><a href="/fantasy/${encodeURIComponent(m.id)}">Pick XI for this match</a></p>` + (m.status === 'upcoming' ? squads : ''),
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
          image: ogUrl(base, 'team', t.id),
          imageAlt: `${t.name} squad`,
          jsonLd: [
            breadcrumbs(base, [['Teams', '/teams'], [t.name, teamPath(t)]]),
            {
              '@context': 'https://schema.org',
              '@type': 'SportsTeam',
              name: t.name,
              sport: 'Cricket',
              url: `${base}${teamPath(t)}`,
              ...(t.logo ? { logo: t.logo.startsWith('http') ? t.logo : `${base}${t.logo}` } : {}),
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
        const role = ROLE[p.role].toLowerCase();
        const links = linksFor(p);
        const sameAs = LINK_KEYS.map(k => links[k]).filter(Boolean) as string[];
        const s = statsFor(store, p.id);
        const seasonLine = s?.matches
          ? [s.innings ? `${s.runs} runs${s.strikeRate ? ` at a strike rate of ${s.strikeRate}` : ''}` : '', s.ballsBowled ? `${s.wickets} wicket(s)${s.economy ? `, economy ${s.economy}` : ''}` : '']
              .filter(Boolean)
              .join(' and ')
          : '';
        const category = p.isIcon || p.category === 'Icon' ? 'icon player' : p.category ? `${p.category} signing` : '';
        const description =
          `${p.name} plays for ${team.name} at the ${season} as ${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}${category ? ` (${category})` : ''}.` +
          (seasonLine ? ` This season: ${seasonLine} in ${s!.matches} match(es).` : '') +
          `${p.battingStyle ? ` ${p.battingStyle}.` : ''}${p.bowlingStyle ? ` ${p.bowlingStyle}.` : ''} Player card, Pick XI points and career stats.`;
        const statRows = s?.matches
          ? `<h2>T10 this season (${esc(season)})</h2><table><tbody>` +
            [
              ['Matches', s.matches],
              ...(s.innings ? [['Runs', s.runs], ['Highest score', `${s.highest}${s.highestNotOut ? '*' : ''}`], ['Strike rate', s.strikeRate ?? '—'], ['Average', s.average ?? '—'], ['Fours / sixes', `${s.fours} / ${s.sixes}`]] : []),
              ...(s.ballsBowled ? [['Wickets', s.wickets], ['Economy', s.economy ?? '—'], ['Best bowling', s.best ? `${s.best.wickets}/${s.best.runs}` : '—']] : []),
              ['Catches', s.catches + s.stumpings],
            ]
              .map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`)
              .join('') +
            `</tbody></table>`
          : `<p>${esc(p.name)} has not played a completed match this season yet.</p>`;
        const career = careerFor(store, p.id);
        const careerRows = career
          ? `<h2>Career record</h2><table><thead><tr><th scope="col">Format</th><th scope="col">Matches</th><th scope="col">Runs</th><th scope="col">Highest</th><th scope="col">Strike rate</th><th scope="col">Wickets</th><th scope="col">Economy</th></tr></thead><tbody>` +
            career.formats
              .map(f => `<tr><th scope="row">${esc(f.label)}</th>${[f.batting?.m || f.bowling?.m, f.batting?.runs, f.batting?.hs, f.batting?.sr, f.bowling?.wkts, f.bowling?.econ].map(v => `<td>${esc(v || '—')}</td>`).join('')}</tr>`)
              .join('') +
            `</tbody></table><p>Career records from CricketData.org.</p>`
          : '';
        return page({
          title: `${p.name}: ${team.name} ${role}, stats and profile`,
          description,
          type: 'profile',
          image: ogUrl(base, 'player', p.id),
          imageAlt: `${p.name}, ${team.name}`,
          jsonLd: [
            breadcrumbs(base, [['Players', '/players'], [team.name, teamPath(team)], [p.name, playerPath(p)]]),
            {
              '@context': 'https://schema.org',
              '@type': 'ProfilePage',
              url: `${base}${playerPath(p)}`,
              ...(p.linksCheckedAt ? { dateModified: p.linksCheckedAt } : {}),
              mainEntity: {
                '@type': 'Person',
                name: p.name,
                url: `${base}${playerPath(p)}`,
                description,
                jobTitle: 'Professional cricketer',
                ...(p.nationality ? { nationality: { '@type': 'Country', name: p.nationality } } : {}),
                memberOf: { '@type': 'SportsTeam', name: team.name, sport: 'Cricket', url: `${base}${teamPath(team)}` },
                ...(p.wikidataId ? { identifier: `https://www.wikidata.org/wiki/${p.wikidataId}` } : {}),
                ...(sameAs.length ? { sameAs } : {}),
              },
            },
          ],
          body: shell(
            p.name,
            `${ROLE[p.role]} for ${team.name}${category ? `, ${category}` : ''}.${p.battingStyle ? ` ${p.battingStyle}.` : ''}${p.bowlingStyle ? ` ${p.bowlingStyle}.` : ''}`,
            statRows +
              careerRows +
              (sameAs.length ? `<h2>Career stats and official accounts</h2><ul>${LINK_KEYS.filter(k => links[k]).map(k => `<li><a href="${esc(links[k])}" rel="noopener">${esc(LINK_LABELS[k])}</a></li>`).join('')}</ul>` : '') +
              `<p><a href="${teamPath(team)}">${esc(team.name)} squad</a> · <a href="/players">All players</a></p>`,
          ),
        });
      }
      const all = store.teams.flatMap(t => t.squad.map(p => ({ p, t })));
      return page({
        title: `${season} players: every squad, roles and stats`,
        description: `All ${all.length} players in the ${season} squads, by team and role, with season stats, Pick XI points and links to career stats.`,
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'ItemList', name: `${season} players`, numberOfItems: all.length, itemListElement: all.map(({ p }, i) => ({ '@type': 'ListItem', position: i + 1, url: `${base}${playerPath(p)}`, name: p.name })) }],
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
        jsonLd: [
          { '@context': 'https://schema.org', '@type': 'CollectionPage', name: heading, url: `${base}/${kind}` },
          ...(kind === 'videos'
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  itemListElement: items
                    .filter(f => f.videoId)
                    .slice(0, 20)
                    .map((f, i) => ({
                      '@type': 'ListItem',
                      position: i + 1,
                      item: {
                        '@type': 'VideoObject',
                        name: f.title,
                        description: f.summary || `${f.title} – ${f.source}`,
                        thumbnailUrl: [f.image || `https://i.ytimg.com/vi/${f.videoId}/hqdefault.jpg`],
                        uploadDate: f.publishedAt,
                        contentUrl: `https://www.youtube.com/watch?v=${f.videoId}`,
                        embedUrl: `https://www.youtube-nocookie.com/embed/${f.videoId}`,
                      },
                    })),
                },
              ]
            : []),
        ],
        body: shell(heading, items.length ? '' : 'New posts appear here as soon as the official accounts publish them.', `<ul>${items.map(f => `<li><a href="${esc(f.url)}" rel="noopener">${esc(f.title)}</a> – ${esc(f.source)}</li>`).join('')}</ul>`),
      });
    }
    case 'fantasy': {
      if (parts[1]) {
        const m = store.matches.find(x => x.id === parts[1]);
        if (!m) return notFound();
        return page({
          image: ogUrl(base, 'match', m.id),
          imageAlt: `${matchTitle(store, m)}, match ${m.matchNo}`,
          jsonLd: [breadcrumbs(base, [['Pick XI', '/fantasy'], [matchTitle(store, m), `/fantasy/${encodeURIComponent(m.id)}`]])],
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
    case 'games': {
      if (parts[1] === 'duel' && parts[2]) {
        // Invite links: shareable (with a preview) but not worth indexing.
        return page({ robots: 'noindex, follow', title: 'Stat Wars duel: can you beat my score?', description: `A 60-second Stat Wars challenge on ${brand}: the same questions for both fans, the higher score wins.`, body: shell('Stat Wars duel', 'Same questions, 60 seconds each. The higher score wins.', '<p><a href="/games">All games</a></p>') });
      }
      if (parts[1]) return notFound();
      return page({
        title: 'Cricket games: Squad Connections, Cricket Grid, Stat Wars',
        description: 'Daily skill games for Abu Dhabi T10 fans: group players in Squad Connections, fill the Cricket Grid, race the clock in Stat Wars and challenge friends to duels. Free, with points for the season leaderboard.',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Daily cricket games',
            itemListElement: ['Squad Connections', 'Cricket Grid', 'Stat Wars', 'Guess the Player', 'Super Over'].map((name, i) => ({ '@type': 'ListItem', position: i + 1, name, url: `${base}/games` })),
          },
        ],
        body: shell(
          'Daily cricket games',
          'New puzzles every day at midnight UAE time. One go at each, points for the season leaderboard.',
          '<h2>Squad Connections</h2><p>Sixteen players, four hidden groups of four: a team, a role, how they bat or bowl, or their signing. Four mistakes allowed.</p>' +
            '<h2>Cricket Grid</h2><p>Three teams down the side, three traits across the top. Name a player for each square; the fewer fans who picked the same player, the more it scores.</p>' +
            '<h2>Stat Wars</h2><p>Sixty seconds of head-to-head questions from this season\'s real scorecards. Challenge a friend to a duel on the same questions.</p>' +
            '<h2>Guess the Player and Super Over</h2><p>Guess the mystery player in five tries, and bat a Super Over to beat the day\'s target.</p>',
        ),
      });
    }
    case 'play':
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
    case 'fanwall': {
      const abs = (u?: string | null) => (u ? (u.startsWith('http') ? u : `${base}${u}`) : undefined);
      if (parts[1]) {
        const fp = store.fanPosts.find(x => x.id === parts[1] && x.status === 'live');
        if (!fp) return notFound();
        const team = store.teams.find(t => t.id === fp.teamId);
        const featured = (fp.featuredOn || []).length > 0;
        const heading = featured ? `${fp.userName}: Fan of the Day` : `${fp.userName} on the fan wall`;
        return page({
          // Fan of the Day posts are worth finding; other posts are shareable but not indexed.
          robots: featured ? 'index, follow, max-image-preview:large' : 'noindex, follow',
          title: heading,
          description: (fp.text || `A photo from ${fp.userName}${team ? `, a ${team.name} fan` : ''}.`).replace(/\s+/g, ' '),
          type: 'article',
          image: abs(fp.photoUrl) || ogUrl(base, 'site'),
          imageAlt: fp.text ? clip(fp.text, 100) : `Photo by ${fp.userName}`,
          jsonLd: [
            breadcrumbs(base, [['Fan wall', '/fanwall'], [heading, `/fanwall/${encodeURIComponent(fp.id)}`]]),
            {
              '@context': 'https://schema.org',
              '@type': 'SocialMediaPosting',
              headline: heading,
              ...(fp.text ? { articleBody: fp.text } : {}),
              ...(fp.photoUrl ? { image: abs(fp.photoUrl) } : {}),
              datePublished: fp.createdAt,
              author: { '@type': 'Person', name: fp.userName },
              url: `${base}/fanwall/${encodeURIComponent(fp.id)}`,
            },
          ],
          body: shell(heading, team ? `${team.name} fan` : '', `${fp.photoUrl ? `<img src="${esc(abs(fp.photoUrl))}" alt="${esc(fp.text || `Photo by ${fp.userName}`)}" width="${fp.photoWidth || ''}" height="${fp.photoHeight || ''}" />` : ''}${fp.text ? `<p>${esc(fp.text)}</p>` : ''}<p><a href="/fanwall">More from the fan wall</a></p>`),
        });
      }
      const live = store.fanPosts.filter(p => p.status === 'live').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const fotd = [...store.fansOfTheDay].sort((a, b) => b.day.localeCompare(a.day))[0];
      const fotdPost = fotd && store.fanPosts.find(p => p.id === fotd.postId && p.status === 'live');
      return page({
        title: 'Fan wall: photos, matchday moments and the Fan of the Day',
        description: `Abu Dhabi T10 fans share their matchday photos, shirts and stadium trips. Every day the organisers pick a Fan of the Day${store.settings.fanOfTheDayPoints ? ` who wins ${store.settings.fanOfTheDayPoints} points` : ''}.`,
        image: abs(fotdPost?.photoUrl) || ogUrl(base, 'site'),
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Fan wall', url: `${base}/fanwall` }],
        body: shell(
          'Fan wall',
          'Show how big a fan you are: post a photo or a matchday moment. The organisers pick a Fan of the Day.',
          (fotdPost ? `<h2>Fan of the Day: ${esc(fotdPost.userName)}</h2><p><a href="/fanwall/${encodeURIComponent(fotdPost.id)}">${esc(fotdPost.text || 'See the post')}</a></p>` : '') +
            `<ul>${live.slice(0, 30).map(p => `<li><strong>${esc(p.userName)}</strong>${p.text ? `: ${esc(clip(p.text, 140))}` : ' shared a photo'}</li>`).join('')}</ul>`,
        ),
      });
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
            breadcrumbs(base, [['Forum', '/forum'], [t.title, `/forum/${encodeURIComponent(t.id)}`]]),
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
    p.image && /\/og\//.test(p.image) ? `<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:type" content="image/png" />` : '',
    p.image && p.imageAlt ? `<meta property="og:image:alt" content="${esc(p.imageAlt)}" />` : '',
    `<meta property="og:locale" content="en_GB" />`,
    `<meta name="twitter:card" content="${p.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(p.title)}" />`,
    `<meta name="twitter:description" content="${esc(p.description)}" />`,
    p.image ? `<meta name="twitter:image" content="${esc(p.image)}" />` : '',
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

/**
 * Sitemap with image entries (the share image of each player, team and match). lastmod is only given
 * when the date is known: claiming every page changed today makes search engines ignore the field.
 */
export function sitemapXml(store: AppStore, base: string) {
  const urls: { loc: string; lastmod?: string; image?: string; imageTitle?: string }[] = [];
  const latestMatch = store.matches.map(m => m.updatedAt).filter(Boolean).sort().pop()?.slice(0, 10);
  const latestFeed = store.feedItems.map(f => f.publishedAt).filter(Boolean).sort().pop()?.slice(0, 10);
  const latestThread = store.forumThreads.filter(t => !t.hidden).map(t => t.lastActivityAt || t.createdAt).sort().pop()?.slice(0, 10);
  const latestFanPost = store.fanPosts.filter(p => p.status === 'live').map(p => p.createdAt).sort().pop()?.slice(0, 10);
  const staticLastmod: Record<string, string | undefined> = { '/fanwall': latestFanPost, '/': latestMatch, '/matches': latestMatch, '/fantasy': latestMatch, '/videos': latestFeed, '/news': latestFeed, '/social': latestFeed, '/forum': latestThread };
  for (const p of INDEXABLE_STATIC) urls.push({ loc: p, lastmod: staticLastmod[p] });
  if (store.youthSchools.length || store.creatorPartners.length || store.commentaryFeeds.length) urls.push({ loc: '/growth' });
  for (const t of store.teams) urls.push({ loc: teamPath(t), lastmod: t.updatedAt?.slice(0, 10), image: ogUrl(base, 'team', t.id), imageTitle: t.name });
  for (const t of store.teams) for (const p of t.squad) urls.push({ loc: playerPath(p), lastmod: (p.linksCheckedAt || t.updatedAt)?.slice(0, 10), image: ogUrl(base, 'player', p.id), imageTitle: `${p.name}, ${t.name}` });
  for (const m of store.matches) {
    urls.push({ loc: matchPath(m), lastmod: m.updatedAt?.slice(0, 10), image: ogUrl(base, 'match', m.id), imageTitle: `${matchTitle(store, m)}, match ${m.matchNo}` });
    if (m.status === 'upcoming') urls.push({ loc: `/fantasy/${encodeURIComponent(m.id)}`, lastmod: m.updatedAt?.slice(0, 10) });
  }
  for (const t of store.forumThreads.filter(x => !x.hidden).slice(0, 2000)) urls.push({ loc: `/forum/${encodeURIComponent(t.id)}`, lastmod: (t.lastActivityAt || t.createdAt).slice(0, 10) });
  for (const p of store.fanPosts.filter(x => x.status === 'live' && (x.featuredOn || []).length)) {
    urls.push({ loc: `/fanwall/${encodeURIComponent(p.id)}`, lastmod: (p.featuredOn || []).slice(-1)[0], ...(p.photoUrl ? { image: p.photoUrl.startsWith('http') ? p.photoUrl : `${base}${p.photoUrl}`, imageTitle: `${p.userName}, Fan of the Day` } : {}) });
  }
  for (const extra of SITEMAP_EXTRA) urls.push(...extra(store, base));
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    urls
      .map(
        u =>
          `  <url><loc>${esc(base + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${u.image ? `<image:image><image:loc>${esc(u.image)}</image:loc>${u.imageTitle ? `<image:title>${esc(u.imageTitle)}</image:title>` : ''}</image:image>` : ''}</url>`,
      )
      .join('\n') +
    `\n</urlset>\n`
  );
}

/** Other modules (the fan wall) add their own URLs to the sitemap. */
export const SITEMAP_EXTRA: ((store: AppStore, base: string) => { loc: string; lastmod?: string; image?: string; imageTitle?: string }[])[] = [];

/**
 * The API is not blocked: search engines render pages with JavaScript, and the app loads its data
 * from /api, so blocking it left crawlers with a page that could not load. API responses carry
 * X-Robots-Tag: noindex instead, so they never show up in results themselves.
 */
export function robotsTxt(base: string) {
  return `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /proposal\nDisallow: /profile\nDisallow: /api/admin/\nDisallow: /api/cron/\n\nSitemap: ${base}/sitemap.xml\n`;
}
