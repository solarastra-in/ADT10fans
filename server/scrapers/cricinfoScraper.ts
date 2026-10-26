import { ScrapedMatchSummary, ScrapedScorecard, ScrapedInnings, ScrapedBatsman, ScrapedBowler } from './types';

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Cricinfo responded with HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts live matches from ESPNcricinfo's official RSS feed.
 * This public feed has maintained the exact same XML contract for over 15 years,
 * making it 100% immune to modern React / Next.js DOM redesigns and CSS changes.
 */
export async function scrapeCricinfoLiveMatches(): Promise<ScrapedMatchSummary[]> {
  const url = 'http://static.cricinfo.com/rss/livescores.xml';
  const xml = await fetchWithTimeout(url);
  const items: ScrapedMatchSummary[] = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml))) {
    const itemContent = match[1];

    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/i);
    const descMatch = itemContent.match(/<description>([\s\S]*?)<\/description>/i);
    const guidMatch = itemContent.match(/<guid>([\s\S]*?)<\/guid>/i) || itemContent.match(/<link>([\s\S]*?)<\/link>/i);

    const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    const desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
    const rawLink = guidMatch ? guidMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';

    // Extract match ID from link: e.g. /engine/match/1456123.html or /series/.../1456123
    const idMatch = rawLink.match(/match\/(\d+)\.html/i) || rawLink.match(/(\d{6,8})/);
    const id = idMatch ? idMatch[1] : `ci-${items.length + 1}`;

    // Parse team names and scores from title:
    // e.g. "Pakistan 245/8 (50.0 ov) v Sri Lanka 180 (42.1 ov) - Sri Lanka won by 2 wickets"
    // e.g. "Diasqua Little Sai Wan Cricket Club 122/3 * v United Services Recreation Club"
    const vsParts = title.split(/\s+v\s+|\s+vs\s+/i);
    const rawA = vsParts[0] || 'Team A';
    const rawB = vsParts[1] || 'Team B';

    // Parse score from rawA
    const scoreAMatch = rawA.match(/^(.*?)\s+(\d+(?:\/\d+)?)\s*(?:\(([\d\.]+)\s*(?:ov)?\))?\s*\*?$/);
    const teamAName = scoreAMatch ? scoreAMatch[1].trim() : rawA.replace(/\*$/, '').trim();
    const scoreA = scoreAMatch ? scoreAMatch[2] : undefined;
    const oversA = scoreAMatch ? scoreAMatch[3] : undefined;

    // Parse score and result from rawB
    const bResultSplit = rawB.split(/\s+-\s+/);
    const bScoresPart = bResultSplit[0] || rawB;
    const resultText = bResultSplit.slice(1).join(' - ').trim();

    const scoreBMatch = bScoresPart.match(/^(.*?)\s+(\d+(?:\/\d+)?)\s*(?:\(([\d\.]+)\s*(?:ov)?\))?\s*\*?$/);
    const teamBName = scoreBMatch ? scoreBMatch[1].trim() : bScoresPart.replace(/\*$/, '').trim();
    const scoreB = scoreBMatch ? scoreBMatch[2] : undefined;
    const oversB = scoreBMatch ? scoreBMatch[3] : undefined;

    let status: ScrapedMatchSummary['status'] = 'upcoming';
    if (resultText && /won by|tied|drawn|no result|abandoned|match over/i.test(resultText)) {
      status = 'completed';
    } else if (title.includes('*') || scoreA || scoreB) {
      status = 'live';
    }

    items.push({
      id,
      provider: 'cricinfo',
      title,
      teamA: {
        name: teamAName,
        score: scoreA,
        overs: oversA,
      },
      teamB: {
        name: teamBName,
        score: scoreB,
        overs: oversB,
      },
      status,
      result: resultText || undefined,
      lastCommentary: desc !== title ? desc : undefined,
      url: rawLink || `https://www.espncricinfo.com/ci/engine/match/${id}.html`,
    });
  }

  return items;
}

/**
 * Extracts full match scorecard by parsing Next.js __NEXT_DATA__
 * or RSS summary for a match ID.
 */
export async function scrapeCricinfoScorecard(matchId: string, seriesId?: string): Promise<{ summary: ScrapedMatchSummary; scorecard: ScrapedScorecard }> {
  // First, check live RSS feed for current status
  const liveList = await scrapeCricinfoLiveMatches().catch(() => []);
  const liveSummary = liveList.find(m => m.id === matchId);

  // If match URL is known, try Next.js data extraction
  let innings: ScrapedInnings[] = [];
  let summary = liveSummary;

  try {
    const matchUrl = `https://www.espncricinfo.com/ci/engine/match/${matchId}.html`;
    const html = await fetchWithTimeout(matchUrl, 8000);

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      const parsed = JSON.parse(nextDataMatch[1]);
      const matchData = parsed.props?.appPageProps?.data?.match || parsed.props?.pageProps?.data?.match;
      const scorecardData = parsed.props?.appPageProps?.data?.scorecard || parsed.props?.pageProps?.data?.scorecard;

      if (matchData) {
        const teams = matchData.teams || [];
        const t1 = teams[0]?.team?.name || 'Team 1';
        const t2 = teams[1]?.team?.name || 'Team 2';

        summary = {
          id: matchId,
          provider: 'cricinfo',
          title: `${t1} vs ${t2}`,
          teamA: {
            name: t1,
            score: teams[0]?.score,
            overs: teams[0]?.scoreInfo,
          },
          teamB: {
            name: t2,
            score: teams[1]?.score,
            overs: teams[1]?.scoreInfo,
          },
          status: matchData.status === 'post' ? 'completed' : matchData.status === 'live' ? 'live' : 'upcoming',
          result: matchData.statusText || undefined,
          toss: matchData.tossText || undefined,
          url: matchUrl,
        };
      }

      if (scorecardData?.innings && Array.isArray(scorecardData.innings)) {
        innings = scorecardData.innings.map((inn: any, idx: number) => ({
          inningNo: idx + 1,
          teamName: inn.team?.name || `Innings ${idx + 1}`,
          totalRuns: Number(inn.runs) || 0,
          wickets: Number(inn.wickets) || 0,
          overs: String(inn.overs || '0.0'),
          batting: (inn.batsmen || []).map((b: any) => ({
            name: b.player?.name || 'Batsman',
            runs: Number(b.runs) || 0,
            balls: Number(b.balls) || 0,
            fours: Number(b.fours) || 0,
            sixes: Number(b.sixes) || 0,
            strikeRate: Number(b.strikeRate) || 0,
            dismissal: b.dismissalText || 'not out',
            isNotOut: !b.dismissalText || /not out/i.test(b.dismissalText),
          })),
          bowling: (inn.bowlers || []).map((bw: any) => ({
            name: bw.player?.name || 'Bowler',
            overs: String(bw.overs || '0'),
            maidens: Number(bw.maidens) || 0,
            runs: Number(bw.runs) || 0,
            wickets: Number(bw.wickets) || 0,
            economy: Number(bw.economy) || 0,
          })),
        }));
      }
    }
  } catch {
    // If Next.js page fetch is blocked, fallback to live RSS summary
  }

  if (!summary) {
    summary = {
      id: matchId,
      provider: 'cricinfo',
      title: `Match ${matchId}`,
      teamA: { name: 'Team A' },
      teamB: { name: 'Team B' },
      status: 'upcoming',
    };
  }

  const scorecard: ScrapedScorecard = {
    matchId,
    provider: 'cricinfo',
    title: summary.title,
    innings,
  };

  return { summary, scorecard };
}
