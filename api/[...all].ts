import type { Request, Response } from 'express';
import app, { ensureAppInitialized } from '../server.ts';

export default function handler(req: Request, res: Response) {
  try {
    ensureAppInitialized();
  } catch {
    // ignore
  }

  const rawMatched = (req.headers['x-matched-path'] as string) ||
                     (req.headers['x-forwarded-uri'] as string) ||
                     (req.headers['x-invoke-path'] as string) ||
                     '';
  if ((req.url.startsWith('/api/index') || req.url === '/api' || req.url === '/api/') && rawMatched && rawMatched !== '/api/index' && rawMatched !== '/api') {
    const qIndex = req.url.indexOf('?');
    const query = qIndex !== -1 ? req.url.slice(qIndex) : '';
    req.url = rawMatched + (rawMatched.includes('?') ? '' : query);
  }
  return app(req, res);
}
