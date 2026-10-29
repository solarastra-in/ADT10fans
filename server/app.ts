import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import './seedOfficial'; // registers the store initializer (teams, checked handles)
import { IS_PROD } from './auth';
import { installStoreSync } from './storeSync';
import { jobsOnTraffic } from './jobs';
import { coreRouter, referralCheckMiddleware } from './routes/core';
import { teamsRouter } from './routes/teams';
import { feedsRouter } from './routes/feeds';
import { matchesRouter } from './routes/matches';
import { playRouter } from './routes/play';
import { prizesRouter } from './routes/prizes';
import { communityRouter } from './routes/community';
import { notificationsRouter } from './routes/notifications';
import { fanSpacesRouter } from './routes/fanspaces';
import { adminRouter } from './routes/admin';
import { scraperRouter } from './routes/scraper';
import { fanWallRouter, serveLocalPhoto } from './routes/fanwall';
import { fanclubRouter } from './routes/fanclub';
import { injectIntoTemplate, renderPage, robotsTxt, sitemapXml } from './seo';
import { ogPng, type OgKind } from './ogImage';

export const app = express();

app.set('trust proxy', true);
app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  if (req.path.startsWith('/api/')) {
    // The API uses bearer tokens (no cookies), so it can be read from any origin without credentials.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    if (req.method === 'OPTIONS') return res.status(204).end();
  }
  next();
});

/**
 * Public data that is the same for every visitor may be cached by the CDN for a few seconds (the
 * client reads these without the sign-in header). During a match every open page polls scores, so
 * this keeps that traffic off the server. Live data is cached briefly; squads and tables longer.
 */
const CDN_CACHE: [RegExp, number][] = [
  [/^\/api\/(matches(\/[^/]+)?|scraper\/live)$/, 5],
  [/^\/api\/(teams|players\/[^/]+|fans|fantasy\/leaderboard|growth-catalysts)$/, 30],
];
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.headers.authorization) {
    const hit = CDN_CACHE.find(([re]) => re.test(req.path));
    if (hit) {
      res.setHeader('Cache-Control', `public, max-age=0, s-maxage=${hit[1]}, stale-while-revalidate=${hit[1] * 6}`);
      res.setHeader('Vary', 'Authorization');
    }
  }
  next();
});

installStoreSync(app);
// Scheduled jobs (reminders, live scores, feed pulls) run after visits when they are due; no cron needed.
app.use((req, res, next) => {
  try {
    jobsOnTraffic(req, res);
  } catch {
    /* never block a request */
  }
  next();
});
app.use('/api', referralCheckMiddleware);
for (const r of [coreRouter, teamsRouter, feedsRouter, matchesRouter, playRouter, prizesRouter, communityRouter, notificationsRouter, fanSpacesRouter, adminRouter, scraperRouter, fanWallRouter, fanclubRouter]) app.use('/api', r);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

function baseUrl(req: Request) {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}
app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsTxt(baseUrl(req))));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(sitemapXml(db.get(), baseUrl(req))));

// Fan wall photos stored on this server's disk (single-server mode; production uses Firebase Storage).
app.get('/uploads/:file', serveLocalPhoto);

// Share images (1200x630) for players, matches, teams and the site.
app.get('/og/:kind(player|match|team|site)/:id.png', (req, res) => {
  const out = ogPng(db.get(), req.params.kind as OgKind, req.params.id);
  if (out === null) return res.status(404).type('text/plain').send('Not found');
  if (out === 'no-renderer') return res.redirect(302, '/logos/adt10.png');
  // Matches change during play; players and teams rarely.
  res.setHeader('Cache-Control', `public, max-age=300, s-maxage=${req.params.kind === 'match' ? 60 : 3600}, stale-while-revalidate=86400`);
  res.type('image/png').send(out);
});

// ---------- pages (server-rendered SEO + the app) ----------
type TemplateLoader = (url: string) => Promise<string>;
let loadTemplate: TemplateLoader | null = null;

function productionTemplate(): TemplateLoader {
  // The Vercel bundle carries the built template inside it (see server/vercelHandler.ts).
  const embedded = (globalThis as any).__ADT10_TEMPLATE__ as string | undefined;
  if (embedded) return async () => embedded;
  const candidates = [
    path.resolve(process.cwd(), 'dist', '_template.html'),
    path.resolve(process.cwd(), 'dist', 'index.html'),
    path.resolve(__dirnameSafe(), '..', 'dist', '_template.html'),
  ];
  const file = candidates.find(f => fs.existsSync(f));
  if (!file) throw new Error('dist/_template.html not found. Run `npm run build` first.');
  const html = fs.readFileSync(file, 'utf-8');
  return async () => html;
}

function __dirnameSafe() {
  try {
    return path.dirname(new URL(import.meta.url).pathname);
  } catch {
    return process.cwd();
  }
}

const isCodeOrAsset = (p: string) =>
  p.startsWith('/@') ||
  p.startsWith('/node_modules/') ||
  p.startsWith('/src/') ||
  p.startsWith('/assets/') ||
  /\.[a-z0-9_-]{2,10}$/i.test(p);

async function servePage(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  if (req.path.startsWith('/api/') || isCodeOrAsset(req.path)) return next();
  const accept = req.headers.accept || '';
  const secDest = (req.headers['sec-fetch-dest'] as string) || '';
  if (secDest === 'script' || secDest === 'style' || secDest === 'image' || (accept && !accept.includes('text/html') && !accept.includes('*/*'))) {
    return next();
  }
  try {
    if (!loadTemplate) loadTemplate = productionTemplate();
    const template = await loadTemplate(req.originalUrl);
    const store = db.get();
    const page = renderPage(req.path, store, baseUrl(req));
    const html = injectIntoTemplate(template, page, store.settings.brandName || 'ADT10 Fans');
    res.status(page.status).setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', !IS_PROD ? 'no-cache, no-store, must-revalidate' : (page.status === 200 && !page.robots.includes('noindex') ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' : 'no-store'));
    res.send(html);
  } catch (e) {
    next(e);
  }
}

/** Dev: Vite serves the client and transforms the template. Prod: static dist/ plus server-rendered pages. */
export async function mountFrontend() {
  // SERVE_BUILD=1 serves the built client from a dev server (used by the browser tests).
  if (!IS_PROD && !process.env.VERCEL && !process.env.SERVE_BUILD) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    loadTemplate = async url => vite.transformIndexHtml(url, fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8'));
  } else {
    const dist = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(dist)) {
      app.use('/assets', express.static(path.join(dist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
      app.use(express.static(dist, { maxAge: '1h', index: false }));
    }
  }
  app.get('*', servePage);
  app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  // JSON errors instead of HTML stack traces
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    if (status >= 500) console.error('[ERROR]', err);
    if (res.headersSent) return;
    res.status(status).json({ error: status === 404 ? 'Not found' : IS_PROD ? 'Something went wrong' : err?.message || 'Server error' });
  });
}

let initPromise: Promise<void> | null = null;
/** Loads the store (and seeds a new one). Safe to call many times. */
export function initialize() {
  if (!initPromise) {
    initPromise = db.ready().catch(e => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}
