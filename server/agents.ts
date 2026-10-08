import crypto from 'crypto';
import { db, AgentRun, SocialHandle } from './db';
import { geminiConfigured, suggestOfficialHandles, generateMarketingContent } from './gemini';
import { syncYouTube, syncNews } from './feeds';

type Result = { items: number; summary: string; status: AgentRun['status'] };

function record(agent: string, startedAt: string, r: Result): Result {
  const store = db.get();
  store.agentRuns.unshift({
    id: 'run-' + crypto.randomUUID().slice(0, 8),
    agent,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: r.status,
    summary: r.summary,
    items: r.items,
  });
  store.agentRuns = store.agentRuns.slice(0, 100);
  db.save();
  return r;
}

const CORE_PLATFORMS = ['X', 'Instagram', 'Threads', 'Facebook', 'TikTok', 'LinkedIn', 'YouTube'] as const;

/** Suggests missing official handles per team. Suggestions wait in the approval queue. */
export async function runDiscoveryAgent(): Promise<Result> {
  const startedAt = new Date().toISOString();
  const store = db.get();
  if (!geminiConfigured()) {
    return record('Discovery', startedAt, { items: 0, status: 'warning', summary: 'Skipped: GEMINI_API_KEY is not set, so handles cannot be searched. Add handles manually in Handles.' });
  }
  if (store.teams.length === 0) {
    return record('Discovery', startedAt, { items: 0, status: 'warning', summary: 'No teams yet. Seed the official franchises first.' });
  }
  let suggested = 0;
  const notes: string[] = [];
  for (const team of store.teams) {
    const have = new Set(store.handles.filter(h => h.teamId === team.id).map(h => h.platform));
    const missing = CORE_PLATFORMS.filter(p => !have.has(p));
    if (!missing.length) continue;
    try {
      const found = await suggestOfficialHandles(team.name, [...missing]);
      for (const f of found) {
        if (store.handles.some(h => h.url.toLowerCase() === f.url.toLowerCase())) continue;
        const handle: SocialHandle = {
          id: 'h-' + crypto.randomUUID().slice(0, 8),
          teamId: team.id,
          platform: f.platform,
          handle: f.handle,
          url: f.url,
          status: 'pending',
          source: 'ai-suggestion',
          meta: { evidence: f.evidence },
          foundAt: new Date().toISOString(),
        };
        store.handles.push(handle);
        store.approvals.unshift({
          id: 'ap-' + crypto.randomUUID().slice(0, 8),
          kind: 'handle',
          title: `${team.name} · ${f.platform} ${f.handle}`,
          detail: `Suggested by the Discovery agent. Check before approving: ${f.url}${f.evidence ? ` (evidence: ${f.evidence})` : ''}`,
          payload: { handleId: handle.id, teamId: team.id, platform: f.platform, url: f.url },
          status: 'pending',
          createdAt: new Date().toISOString(),
        });
        suggested++;
      }
      notes.push(`${team.short}: ${found.length}`);
    } catch (e: any) {
      notes.push(`${team.short}: error (${e?.message || e})`);
    }
  }
  db.save();
  return record('Discovery', startedAt, {
    items: suggested,
    status: notes.some(n => n.includes('error')) ? 'warning' : 'success',
    summary: `${suggested} handle suggestion(s) added to the approval queue. ${notes.join(', ')}`.trim(),
  });
}

export async function runSocialAgent(): Promise<Result> {
  const startedAt = new Date().toISOString();
  const r = await syncYouTube();
  const status: AgentRun['status'] = r.sources === 0 ? 'warning' : r.errors.length ? (r.errors.length === r.sources ? 'error' : 'warning') : 'success';
  const summary = r.sources === 0
    ? 'No verified YouTube handles yet. Add or approve one in Handles.'
    : `${r.fetched} videos read from ${r.sources} verified channel(s); ${r.added} new.${r.errors.length ? ' Errors: ' + r.errors.join('; ') : ''}`;
  return record('Social', startedAt, { items: r.added, status, summary });
}

export async function runNewsAgent(): Promise<Result> {
  const startedAt = new Date().toISOString();
  const r = await syncNews();
  const status: AgentRun['status'] = r.errors.length ? (r.errors.length === r.sources ? 'error' : 'warning') : 'success';
  return record('News', startedAt, {
    items: r.added,
    status,
    summary: `${r.fetched} articles read from ${r.sources} Google News search(es); ${r.added} new.${r.errors.length ? ' Errors: ' + r.errors.join('; ') : ''}`,
  });
}

/** There is no licensed live-score feed wired in; this agent flags fixtures that need an admin update. */
export async function runScoresAgent(): Promise<Result> {
  const startedAt = new Date().toISOString();
  const store = db.get();
  const now = Date.now();
  const overdue = store.matches.filter(m => m.status === 'upcoming' && new Date(m.startsAt).getTime() < now - 15 * 60_000);
  const stale = store.matches.filter(m => m.status === 'live' && now - new Date(m.updatedAt).getTime() > 20 * 60_000);
  const parts: string[] = [];
  if (overdue.length) parts.push(`${overdue.length} fixture(s) past start time still marked upcoming (#${overdue.map(m => m.matchNo).join(', #')})`);
  if (stale.length) parts.push(`${stale.length} live match(es) not updated for 20+ minutes (#${stale.map(m => m.matchNo).join(', #')})`);
  return record('Scores', startedAt, {
    items: overdue.length + stale.length,
    status: parts.length ? 'warning' : 'success',
    summary: parts.length ? `Needs attention in Matches: ${parts.join('; ')}.` : 'All fixtures look up to date. Scores are entered by admins in Matches.',
  });
}

/** Drafts a preview post for the next fixture; it waits for approval before fans see it. */
export async function runContentAgent(): Promise<Result> {
  const startedAt = new Date().toISOString();
  const store = db.get();
  if (!geminiConfigured()) {
    return record('Content', startedAt, { items: 0, status: 'warning', summary: 'Skipped: GEMINI_API_KEY is not set.' });
  }
  const next = store.matches
    .filter(m => m.status === 'upcoming')
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  if (!next) return record('Content', startedAt, { items: 0, status: 'success', summary: 'No upcoming fixture to preview.' });
  const a = store.teams.find(t => t.id === next.teamA);
  const b = store.teams.find(t => t.id === next.teamB);
  if (!a || !b) return record('Content', startedAt, { items: 0, status: 'warning', summary: `Fixture #${next.matchNo} references a missing team.` });
  if (store.approvals.some(ap => ap.kind === 'post' && ap.status === 'pending' && ap.payload?.matchId === next.id)) {
    return record('Content', startedAt, { items: 0, status: 'success', summary: `A preview for match #${next.matchNo} is already waiting for approval.` });
  }
  const squadLine = (t: typeof a) => t.squad.map(p => p.name).join(', ') || 'squad not yet published';
  try {
    const { text } = await generateMarketingContent(
      `Write a short (max 90 words) match preview for ${a.name} vs ${b.name} at ${next.venue}. ` +
      `Known players — ${a.name}: ${squadLine(a)}. ${b.name}: ${squadLine(b)}. Use only these facts.`,
      {}
    );
    store.approvals.unshift({
      id: 'ap-' + crypto.randomUUID().slice(0, 8),
      kind: 'post',
      title: `Preview draft: ${a.name} vs ${b.name}`,
      detail: text,
      payload: { matchId: next.id, teamId: a.id, title: `Preview: ${a.name} vs ${b.name}`, summary: text },
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    db.save();
    return record('Content', startedAt, { items: 1, status: 'success', summary: `Drafted a preview for match #${next.matchNo}; it is in the approval queue.` });
  } catch (e: any) {
    return record('Content', startedAt, { items: 0, status: 'error', summary: `Gemini error: ${e?.message || e}` });
  }
}

export async function runOpsAgent(): Promise<Result> {
  const startedAt = new Date().toISOString();
  const s = db.get();
  const issues: string[] = [];
  if (!s.teams.length) issues.push('no teams (seed the official franchises)');
  const teamsWithoutHandles = s.teams.filter(t => !s.handles.some(h => h.teamId === t.id && h.status === 'verified'));
  if (teamsWithoutHandles.length) issues.push(`no verified handles for ${teamsWithoutHandles.map(t => t.short).join(', ')}`);
  const pending = s.approvals.filter(a => a.status === 'pending').length;
  if (pending) issues.push(`${pending} approval(s) waiting`);
  if (!s.matches.length) issues.push('no fixtures published');
  return record('Ops', startedAt, {
    items: issues.length,
    status: issues.length ? 'warning' : 'success',
    summary: issues.length ? `To do: ${issues.join('; ')}.` : 'Everything fans see is configured.',
  });
}
