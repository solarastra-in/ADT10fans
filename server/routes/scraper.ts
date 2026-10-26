import { Router } from 'express';
import { requireAdmin } from '../auth';
import { bad, str, wrap } from '../http';
import { scraperService } from '../scrapers/scraperService';
import { db } from '../db';

export const scraperRouter = Router();

/**
 * Public/Fan endpoint: Fetch live cricket matches currently in progress.
 * 100% free, unofficial, no API key required.
 */
scraperRouter.get('/scraper/live', wrap(async (_req, res) => {
  const result = await scraperService.getLiveMatches();
  res.json({
    success: true,
    count: result.matches.length,
    sources: result.sources,
    matches: result.matches,
  });
}));

/**
 * Admin endpoint: Fetch details & scorecard for a match from Cricbuzz or Cricinfo.
 * Admin only: open to everyone, it let any visitor make the server scrape any match id.
 */
scraperRouter.get('/scraper/match/:provider/:id', requireAdmin('matches'), wrap(async (req, res) => {
  const provider = req.params.provider === 'cricinfo' ? 'cricinfo' : 'cricbuzz';
  const id = req.params.id;
  const slug = str(req.query.slug, 120);

  const result = await scraperService.getMatchScorecard(provider, id, slug);
  res.json({ success: true, ...result });
}));

/**
 * Admin endpoint: Sync an Abu Dhabi T10 fixture with live scores from Cricbuzz or Cricinfo.
 */
scraperRouter.post('/scraper/sync/:matchId', requireAdmin, wrap(async (req, res) => {
  const matchId = req.params.matchId;
  const b = req.body || {};
  const provider = b.provider === 'cricinfo' ? 'cricinfo' : 'cricbuzz';
  const externalId = str(b.externalId || b.id, 80);
  const slug = str(b.slug, 120);

  if (!externalId) {
    return bad(res, 'Please specify the external Cricbuzz or Cricinfo Match ID');
  }

  const result = await scraperService.syncMatchFromScraper(matchId, provider, externalId, slug);
  res.json(result);
}));

/**
 * Admin endpoint: Test scraper on any custom Cricbuzz / Cricinfo URL or ID.
 */
scraperRouter.post('/scraper/test', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const target = str(b.url || b.matchId, 250).trim();
  if (!target) return bad(res, 'Target match URL or Match ID is required');

  let provider: 'cricbuzz' | 'cricinfo' = 'cricbuzz';
  let matchId = target;
  let slug = '';

  if (target.includes('cricinfo.com')) {
    provider = 'cricinfo';
    const m = target.match(/match\/(\d+)/i) || target.match(/(\d{6,8})/);
    if (m) matchId = m[1];
  } else if (target.includes('cricbuzz.com')) {
    provider = 'cricbuzz';
    const m = target.match(/(?:scores|scorecard)\/(\d+)\/([a-z0-9-]+)/i);
    if (m) {
      matchId = m[1];
      slug = m[2];
    } else {
      const numMatch = target.match(/(\d{5,8})/);
      if (numMatch) matchId = numMatch[1];
    }
  }

  try {
    const result = await scraperService.getMatchScorecard(provider, matchId, slug);
    res.json({
      success: true,
      provider,
      matchId,
      summary: result.summary,
      inningsCount: result.scorecard.innings.length,
      scorecard: result.scorecard,
    });
  } catch (err: any) {
    return bad(res, `Scraper test failed: ${err.message}`, 400);
  }
}));

/**
 * Admin endpoint: Scrape Abu Dhabi T10 squads from Cricbuzz.
 */
scraperRouter.get('/scraper/squads', requireAdmin, wrap(async (req, res) => {
  const seriesId = str(req.query.seriesId, 30) || '13307';
  const seriesSlug = str(req.query.slug, 80) || 'abu-dhabi-t10-league-2026';
  const squads = await scraperService.getSeriesSquads(seriesId, seriesSlug);
  res.json({ success: true, count: squads.length, squads });
}));
