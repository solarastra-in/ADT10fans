import crypto from 'crypto';
import { db, AgentRun, FeedItem, SocialHandle } from './db';
import { geminiConfigured, suggestOfficialHandles, generateMarketingContent, harvestSocialPostsWithSearch } from './gemini';
import { syncYouTube, syncNews, merge } from './feeds';
import { verifyPostLink } from './socialSources';

type Result = { items: number; summary: string; status: AgentRun['status'] };

async function record(agent: string, startedAt: string, r: Result): Promise<Result> {
  await db.mutate(store => {
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
  });
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

/**
 * Social harvester (a built-in alternative to Curator.io).
 *
 * 1. Pulls every verified account that has a real source (YouTube RSS, X public timeline, Instagram
 *    via Meta's Business Discovery API, any account with a feed address). See feeds.ts / socialSources.ts.
 * 2. For X and TikTok, which offer no reliable public feed, asks the AI search for recent post links
 *    from each team's official accounts, then keeps a link only after the platform's oEmbed endpoint
 *    confirms the post exists and was published by that account. Text, thumbnail and date come from
 *    the platform. Links that cannot be confirmed are dropped and counted.
 * Everything kept is stored, so posts stay visible after they leave the platforms' "latest" lists.
 */
export async function runSocialHarvesterAgent(targetTeamId?: string): Promise<Result> {
  const startedAt = new Date().toISOString();
  const snapshot = db.get();
  const groups: { teamId: string | null; name: string }[] = [
    ...(targetTeamId ? [] : [{ teamId: null, name: 'Abu Dhabi T10 league' }]),
    ...snapshot.teams.filter(t => !targetTeamId || t.id === targetTeamId).map(t => ({ teamId: t.id as string | null, name: t.name })),
  ];
  const notes: string[] = [];
  const found: FeedItem[] = [];
  let suggested = 0;
  let rejected = 0;
  const reasons = new Map<string, number>();

  if (!geminiConfigured()) {
    return record('Social Harvester', startedAt, { items: 0, status: 'warning', summary: 'Add a Gemini API key in Admin → Environment to let the harvester look for X and TikTok posts. Feeds with a real source are pulled by the regular feed sync.' });
  }
  // Teams with an X or TikTok account, taken in turn; each run stops after ~30 s (Vercel allows 60 s
  // per request) and the next run carries on from the next team.
  const searchable = groups.filter(g => snapshot.handles.some(h => h.teamId === g.teamId && h.status === 'verified' && (h.platform === 'X' || h.platform === 'TikTok')));
  const start = targetTeamId ? 0 : Number(snapshot.jobLog['harvest:next'] || 0) % Math.max(1, searchable.length);
  const order = [...searchable.slice(start), ...searchable.slice(0, start)];
  const budgetEnds = Date.now() + Number(process.env.HARVEST_BUDGET_MS || 30_000);
  let done = 0;
  for (const g of order) {
    if (done > 0 && Date.now() > budgetEnds) break;
    done++;
    const handles = snapshot.handles.filter(h => h.teamId === g.teamId && h.status === 'verified' && (h.platform === 'X' || h.platform === 'TikTok'));
    const links = await harvestSocialPostsWithSearch(g.name, handles.map(h => ({ platform: h.platform, handle: h.handle, url: h.url })));
    suggested += links.length;
    let kept = 0;
    for (const link of links.slice(0, 15)) {
      const v = await verifyPostLink(link.url, handles);
      if (v.ok) {
        found.push(v.item);
        kept++;
      } else {
        rejected++;
        reasons.set(v.reason.replace(/@\w+/g, '@…'), (reasons.get(v.reason.replace(/@\w+/g, '@…')) || 0) + 1);
      }
    }
    notes.push(`${g.name}: ${kept} of ${links.length} confirmed`);
  }
  const added = await db.mutate(store => {
    if (!targetTeamId && searchable.length) store.jobLog['harvest:next'] = String((start + done) % searchable.length);
    return merge(found, store);
  });
  const why = [...reasons.entries()].map(([r, n]) => `${n}× ${r}`).join('; ');
  const summary = `${added} new post(s) kept, ${found.length} confirmed by the platforms, ${rejected} of ${suggested} search result(s) dropped.${notes.length ? ` ${notes.join(', ')}.` : ' No team has an X or TikTok account to search.'}${done < order.length ? ` ${order.length - done} more team(s) next run.` : ''}${why ? ` Dropped because: ${why}.` : ''}`;
  return record('Social Harvester', startedAt, { items: added, status: suggested && !found.length ? 'warning' : 'success', summary });
}

