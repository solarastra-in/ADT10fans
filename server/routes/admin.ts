import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { Router } from 'express';
import { ALL_PERMISSIONS, AdminPermission, AdminRole, db, defaultSettings, SUPER_ADMIN_EMAIL, TEAM_OFFICIAL_PERMISSIONS } from '../db';
import { adminEmails, IS_PROD, isSuperAdmin, rateLimit, requireAdmin, requireSuperAdmin, requireUser, smtpConfigured, firebaseProjectId, resetSmtpErrorState, smtpConfig, formatFromAddress } from '../auth';
import { bad, newId, num, str, userOf, wrap } from '../http';
import { runDiscoveryAgent, runSocialAgent, runNewsAgent, runScoresAgent, runContentAgent, runOpsAgent } from '../agents';
import { geminiConfigured, chatWithGemini, searchGroundingCricket, generateMarketingContent, transcribeAudioVoice } from '../gemini';
import { getAllEnvVariables, saveEnvOverrides } from '../envConfig';
import { pushServerConfigured } from '../push';
import { liveScoresConfigured } from '../liveScores';
import { ephemeralDiskWarning, FirestoreBackend } from '../storage';
import { firebaseAppConfig } from '../firebaseConfig';
import { getCuratorConfig } from '../feeds';
import { runScheduledJobs, runJobsOnce, lastJobRun } from '../jobs';

export const adminRouter = Router();

function maskedSettings() {
  const s = db.get().settings;
  return { ...s, adminEmails: adminEmails(), curatorApiKey: s.curatorApiKey ? '********' : '', smtp: { ...s.smtp, pass: s.smtp.pass ? '********' : '' }, envOverrides: undefined };
}

let rulesCheck: { at: number; open: boolean } | null = null;
async function firestoreOpenToPublic(): Promise<boolean> {
  if (!(db.backend instanceof FirestoreBackend)) return false;
  if (rulesCheck && Date.now() - rulesCheck.at < 10 * 60_000) return rulesCheck.open;
  const open = await db.backend.publiclyReadable(firebaseAppConfig().apiKey || '');
  rulesCheck = { at: Date.now(), open };
  return open;
}

adminRouter.get('/admin/dashboard', requireAdmin, wrap(async (_req, res) => {
  const s = db.get();
  const warning = ephemeralDiskWarning(db.backend);
  const rulesOpen = await firestoreOpenToPublic();
  res.json({
    usersCount: s.users.length,
    handlesCount: s.handles.length,
    verifiedHandles: s.handles.filter(h => h.status === 'verified').length,
    feedItemsCount: s.feedItems.length,
    matchesCount: s.matches.length,
    contestsCount: s.contests.length,
    fantasyLineups: s.fantasyTeams.length,
    gamePlaysToday: s.gamePlays.filter(p => p.day === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' })).length,
    drawsCount: s.draws.length,
    prizesCount: s.prizes.length,
    pendingRedemptions: s.redemptions.filter(r => r.status === 'pending').length,
    openReports: s.forumReports.filter(r => r.status === 'open').length,
    notificationsCount: s.notifications.length,
    fcmSubscribersCount: s.fcmTokens.filter(t => t.enabled).length,
    pendingApprovals: s.approvals.filter(a => a.status === 'pending'),
    agentRuns: s.agentRuns.slice(0, 20),
    settings: maskedSettings(),
    warnings: [
      ...(warning ? [warning] : []),
      ...(rulesOpen ? ['Your Firestore security rules let anyone read the site\'s data. In Firebase console → Firestore → Rules, publish the rules in firestore.rules from the repository (they close the database to browsers; the site itself is not affected).'] : []),
    ],
    integrations: {
      gemini: geminiConfigured(),
      smtp: smtpConfigured(),
      pushServer: pushServerConfigured(),
      pushClient: Boolean(process.env.FCM_VAPID_KEY),
      googleSignIn: Boolean(firebaseProjectId()),
      curator: getCuratorConfig().isConfigured,
      liveScores: liveScoresConfigured(),
      storage: db.backend.describe(),
      sharedStorage: db.shared,
      persistentStorage: db.shared || Boolean(process.env.DATA_DIR),
      scheduledJobs: (process.env.SCHEDULED_JOBS || '').toLowerCase() !== 'off',
      lastScheduledRun: lastJobRun(),
    },
  });
}));

const AGENTS: Record<string, () => Promise<any>> = { discovery: runDiscoveryAgent, social: runSocialAgent, news: runNewsAgent, scores: runScoresAgent, content: runContentAgent, ops: runOpsAgent };
adminRouter.post('/admin/agents/:name/run', requireAdmin(['feeds', 'social', 'matches']), wrap(async (req, res) => {
  const fn = AGENTS[req.params.name];
  if (!fn) return bad(res, 'Unknown agent');
  res.json({ success: true, agent: req.params.name, result: await fn() });
}));

adminRouter.post('/admin/approvals/:id/decide', requireAdmin(['social', 'feeds']), (req, res) => {
  const store = db.get();
  const a = store.approvals.find(x => x.id === req.params.id);
  if (!a) return bad(res, 'Approval not found', 404);
  if (a.status !== 'pending') return bad(res, 'Already decided');
  const approve = req.body?.decision === 'approve';
  a.status = approve ? 'approved' : 'rejected';
  a.decidedAt = new Date().toISOString();
  if (a.kind === 'handle') {
    const h = store.handles.find(x => x.id === a.payload?.handleId);
    if (h) {
      if (approve) {
        h.status = 'verified';
        h.verifiedAt = a.decidedAt;
        if (h.source === 'legacy') h.source = 'admin';
      } else {
        store.handles = store.handles.filter(x => x.id !== h.id);
      }
    }
  } else if (a.kind === 'post' && approve) {
    const matchId = a.payload?.matchId;
    store.feedItems.unshift({
      id: newId('feed'),
      teamId: a.payload?.teamId || null,
      platform: 'Web',
      kind: 'article',
      category: 'marketing',
      title: str(a.payload?.title, 200) || a.title,
      url: matchId ? `/matches/${matchId}` : '/matches',
      image: null,
      source: db.get().settings.brandName || 'ADT10 Fans',
      summary: str(a.payload?.summary, 1200),
      status: 'live',
      publishedAt: a.decidedAt,
      createdAt: a.decidedAt,
      sourceType: 'ai',
    });
  }
  db.save();
  res.json({ success: true, approval: a });
});

adminRouter.get('/admin/settings', requireAdmin('settings'), (_req, res) => res.json({ settings: maskedSettings() }));

adminRouter.post('/admin/settings', requireAdmin('settings'), (req, res) => {
  const b = req.body || {};
  const s = db.get().settings;
  const d = defaultSettings();
  const textKeys = ['brandName', 'tagline', 'copyrightHolder', 'seasonLabel', 'venue', 'tickerText', 'curatorFeedId', 'curatorContainerId', 'curatorFeedUuid', 'curatorHashtags'] as const;
  for (const k of textKeys) if (b[k] !== undefined) (s as any)[k] = str(b[k], k === 'tickerText' ? 300 : 120);
  if (!s.brandName) s.brandName = d.brandName;
  if (b.seasonStart !== undefined) s.seasonStart = /^\d{4}-\d{2}-\d{2}$/.test(str(b.seasonStart, 10)) ? str(b.seasonStart, 10) : s.seasonStart;
  if (b.seasonEnd !== undefined) s.seasonEnd = /^\d{4}-\d{2}-\d{2}$/.test(str(b.seasonEnd, 10)) ? str(b.seasonEnd, 10) : s.seasonEnd;
  if (b.newsQueries !== undefined) s.newsQueries = str(b.newsQueries, 2000);
  if (b.maxSocialPerPlatform !== undefined) s.maxSocialPerPlatform = Math.min(20, Math.max(1, Math.round(num(b.maxSocialPerPlatform, 6))));
  if (b.referralRewardPoints !== undefined) s.referralRewardPoints = Math.min(1000, Math.max(0, Math.round(num(b.referralRewardPoints, 50))));
  if (b.referralMaxRewarded !== undefined) s.referralMaxRewarded = Math.min(1000, Math.max(0, Math.round(num(b.referralMaxRewarded, 10))));
  if (b.lockReminderMinutes !== undefined) s.lockReminderMinutes = Math.min(240, Math.max(5, Math.round(num(b.lockReminderMinutes, 30))));
  if (b.curatorApiKey !== undefined && b.curatorApiKey !== '********') s.curatorApiKey = str(b.curatorApiKey, 200);
  if (b.adminEmails !== undefined) {
    if (!isSuperAdmin(userOf(req))) return bad(res, 'Only a super admin can change who is an admin', 403);
    const list = (Array.isArray(b.adminEmails) ? b.adminEmails : String(b.adminEmails).split(','))
      .map((e: any) => String(e).trim().toLowerCase())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    s.adminEmails = list.filter((e: string) => !envAdmins.includes(e) && e !== SUPER_ADMIN_EMAIL && !(db.get().adminUsers || []).some(a => a.email === e));
  }
  if (b.smtp && typeof b.smtp === 'object') {
    s.smtp = {
      host: b.smtp.host !== undefined ? str(b.smtp.host, 120) : s.smtp.host,
      port: b.smtp.port !== undefined ? Math.round(num(b.smtp.port, 587)) : s.smtp.port,
      user: b.smtp.user !== undefined ? str(b.smtp.user, 120) : s.smtp.user,
      pass: b.smtp.pass && b.smtp.pass !== '********' ? String(b.smtp.pass).slice(0, 200) : s.smtp.pass,
      from: b.smtp.from !== undefined ? str(b.smtp.from, 160) : s.smtp.from,
      enabled: b.smtp.enabled !== undefined ? Boolean(b.smtp.enabled) : s.smtp.enabled,
    };
    resetSmtpErrorState();
  }
  db.save();
  res.json({ success: true, settings: maskedSettings() });
});

adminRouter.post('/admin/smtp/test', requireAdmin, wrap(async (req, res) => {
  const b = req.body || {};
  const c = smtpConfig();
  const host = b.host ? str(b.host, 120) : c.host;
  const port = b.port ? Math.round(num(b.port, 587)) : c.port;
  const user = b.user ? str(b.user, 120) : c.user;
  const pass = b.pass && b.pass !== '••••••••' && b.pass !== '********' ? String(b.pass).trim().replace(/\s+/g, '') : c.pass;
  const from = b.from ? str(b.from, 160) : c.from;
  const to = b.to ? str(b.to, 160) : (userOf(req)?.email || user);

  if (!host) return bad(res, 'SMTP Host is required');
  if (!user && pass) return bad(res, 'SMTP Username is required');

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
      tls: { rejectUnauthorized: false },
    });

    await transporter.verify();

    if (to && to.includes('@')) {
      const formattedFrom = formatFromAddress(from, user);
      await transporter.sendMail({
        from: formattedFrom,
        to,
        subject: 'Test email from Abu Dhabi T10 Fan Hub',
        text: 'Congratulations! Your SMTP settings are working properly and ready to deliver sign-in codes.',
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff">
          <h3 style="color:#0f172a;margin-top:0">Abu Dhabi T10 Fan Hub</h3>
          <p style="color:#334155;font-size:15px">Congratulations! Your email server (SMTP) is verified and working properly.</p>
          <div style="font-size:13px;color:#64748b;background:#f8fafc;padding:12px;border-radius:6px;margin:16px 0">
            <div><strong>Host:</strong> ${host}:${port}</div>
            <div><strong>Account:</strong> ${user || '(none)'}</div>
            <div><strong>From:</strong> ${formattedFrom}</div>
          </div>
          <p style="color:#10b981;font-weight:600;font-size:14px;margin-bottom:0">✓ Ready to send fan sign-in OTP codes</p>
        </div>`,
      });
      return res.json({ success: true, message: `SMTP connection verified! A test email was sent to ${to}.` });
    }

    return res.json({ success: true, message: `SMTP connection to ${host}:${port} verified successfully!` });
  } catch (err: any) {
    let msg = err.message || 'SMTP connection failed';
    if (msg.includes('534-5.7.9') || msg.includes('Application-specific password')) {
      msg = 'Gmail requires a 16-character App Password (not your regular Google account password). Go to Google Account > Security > 2-Step Verification > App Passwords, generate an App Password, and paste it here.';
    }
    return res.status(400).json({ success: false, error: msg });
  }
}));

// ---------- admins (super admin only) ----------
const ROLES: AdminRole[] = ['superadmin', 'league_admin', 'contest_admin', 'winner_admin', 'social_admin', 'team_official', 'custom'];
const ROLE_PRESETS: Record<AdminRole, AdminPermission[]> = {
  superadmin: ['all'],
  league_admin: ['leagues', 'matches', 'teams', 'contests', 'fantasy', 'games', 'notifications', 'fanspaces', 'growth', 'community'],
  contest_admin: ['contests', 'fantasy', 'games'],
  winner_admin: ['winners', 'draws', 'prizes'],
  social_admin: ['feeds', 'social', 'community'],
  team_official: TEAM_OFFICIAL_PERMISSIONS,
  custom: [],
};

adminRouter.get('/admin/admins', requireSuperAdmin, (_req, res) => {
  const store = db.get();
  const env = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  const list = [...(store.adminUsers || [])];
  for (const e of env) if (!list.some(a => a.email.toLowerCase() === e)) list.push({ email: e, name: 'From ADMIN_EMAILS', role: 'superadmin', permissions: ['all'], isSuperAdmin: true, addedBy: 'environment', addedAt: '' });
  res.json({ admins: list, superAdminEmail: SUPER_ADMIN_EMAIL, rolePresets: ROLE_PRESETS, permissions: ALL_PERMISSIONS });
});

adminRouter.post('/admin/admins', requireSuperAdmin, (req, res) => {
  const email = str(req.body?.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(res, 'Enter a valid email');
  if (email === SUPER_ADMIN_EMAIL) return bad(res, 'The owner account cannot be changed', 409);
  const role: AdminRole = ROLES.includes(req.body?.role) ? req.body.role : 'custom';
  const store = db.get();
  let permissions: AdminPermission[];
  let teamId: string | null = null;
  if (role === 'team_official') {
    teamId = str(req.body?.teamId, 60) || null;
    if (!teamId || !store.teams.some(t => t.id === teamId)) return bad(res, 'Choose the team this official manages');
    permissions = (Array.isArray(req.body?.permissions) ? req.body.permissions : TEAM_OFFICIAL_PERMISSIONS).filter((p: AdminPermission) => TEAM_OFFICIAL_PERMISSIONS.includes(p));
    if (!permissions.length) permissions = [...TEAM_OFFICIAL_PERMISSIONS];
  } else if (role === 'superadmin') {
    permissions = ['all'];
  } else {
    const requested = Array.isArray(req.body?.permissions) && req.body.permissions.length ? req.body.permissions : ROLE_PRESETS[role];
    // 'admins' is never grantable: only super admins manage admins.
    permissions = requested.filter((p: AdminPermission) => ALL_PERMISSIONS.includes(p) && p !== 'admins');
    if (!permissions.length) return bad(res, 'Choose at least one permission');
  }
  const caller = userOf(req);
  const now = new Date().toISOString();
  const idx = store.adminUsers.findIndex(a => a.email.toLowerCase() === email);
  const rec = { email, name: str(req.body?.name, 80) || email.split('@')[0], role, permissions, teamId, isSuperAdmin: role === 'superadmin', addedBy: idx >= 0 ? store.adminUsers[idx].addedBy : caller.email, addedAt: idx >= 0 ? store.adminUsers[idx].addedAt : now, updatedAt: now };
  if (idx >= 0) store.adminUsers[idx] = rec;
  else store.adminUsers.push(rec);
  store.settings.adminEmails = (store.settings.adminEmails || []).filter(e => e !== email);
  db.save();
  res.json({ success: true, admins: store.adminUsers });
});

adminRouter.delete('/admin/admins/:email', requireSuperAdmin, (req, res) => {
  const target = str(req.params.email, 200).toLowerCase();
  if (target === SUPER_ADMIN_EMAIL) return bad(res, 'The owner account cannot be removed', 409);
  if (target === userOf(req).email.toLowerCase()) return bad(res, 'You cannot remove yourself', 409);
  const store = db.get();
  store.adminUsers = store.adminUsers.filter(a => a.email.toLowerCase() !== target);
  store.settings.adminEmails = (store.settings.adminEmails || []).filter(e => e !== target);
  db.save();
  res.json({ success: true, admins: store.adminUsers, note: (process.env.ADMIN_EMAILS || '').toLowerCase().includes(target) ? 'This email is also in ADMIN_EMAILS, so it keeps super admin access until it is removed there.' : undefined });
});

// ---------- environment (super admin only) ----------
adminRouter.get('/admin/env', requireSuperAdmin, (_req, res) => res.json({ variables: getAllEnvVariables() }));
adminRouter.post('/admin/env', requireSuperAdmin, (req, res) => res.json(saveEnvOverrides(req.body?.overrides || {})));

// ---------- proposal (confidential) ----------
adminRouter.get('/admin/proposal', requireAdmin('settings'), (_req, res) => res.json({ proposalSettings: db.get().proposalSettings }));
adminRouter.post('/admin/proposal', requireAdmin('settings'), (req, res) => {
  const store = db.get();
  const b = req.body || {};
  store.proposalSettings = {
    ...store.proposalSettings,
    ...(typeof b.exchangeRateUsdToAed === 'number' ? { exchangeRateUsdToAed: b.exchangeRateUsdToAed } : {}),
    ...(b.revenueStreams && typeof b.revenueStreams === 'object' ? { revenueStreams: { ...store.proposalSettings.revenueStreams, ...b.revenueStreams } } : {}),
    ...(Array.isArray(b.activities) ? { activities: b.activities } : {}),
    updatedAt: new Date().toISOString(),
  };
  db.save();
  res.json({ success: true, proposalSettings: store.proposalSettings });
});
adminRouter.post('/admin/proposal/reset', requireAdmin('settings'), (_req, res) => res.json({ success: true, proposalSettings: db.resetProposal() }));

// ---------- Gemini ----------
const teamNames = () => db.get().teams.map(t => t.name);
const geminiError = (res: any, e: any) => bad(res, e?.status === 503 ? e.message : `The AI assistant had a problem: ${e?.message || 'unknown error'}`, e?.status === 503 ? 503 : 502);
adminRouter.post('/gemini/chat', requireUser, rateLimit('ai', 20, 10 * 60_000), wrap(async (req, res) => {
  if (!Array.isArray(req.body?.messages) || !req.body.messages.length) return bad(res, 'Message required');
  try {
    res.json(await chatWithGemini(req.body.messages, teamNames()));
  } catch (e) {
    geminiError(res, e);
  }
}));
adminRouter.post('/gemini/search', requireUser, rateLimit('ai', 20, 10 * 60_000), wrap(async (req, res) => {
  const q = str(req.body?.query, 500);
  if (!q) return bad(res, 'Query required');
  try {
    res.json(await searchGroundingCricket(q, teamNames()));
  } catch (e) {
    geminiError(res, e);
  }
}));
adminRouter.post('/gemini/marketing', requireAdmin(['social', 'notifications']), wrap(async (req, res) => {
  try {
    res.json(await generateMarketingContent(str(req.body?.prompt, 2000) || 'Write a matchday social post.', { teamName: str(req.body?.teamName, 80) }));
  } catch (e) {
    geminiError(res, e);
  }
}));
adminRouter.post('/gemini/transcribe', requireAdmin, wrap(async (req, res) => {
  if (!req.body?.audioBase64) return bad(res, 'Audio required');
  try {
    res.json(await transcribeAudioVoice(String(req.body.audioBase64), str(req.body.mimeType, 60) || 'audio/webm'));
  } catch (e) {
    geminiError(res, e);
  }
}));

// ---------- scheduled jobs ----------
/**
 * Jobs normally run by themselves after visits (see jobs.ts). This endpoint lets an outside scheduler
 * (Vercel Cron, GitHub Actions) or a super admin trigger them too. Anyone may call it, but without the
 * CRON_SECRET (or a super admin session) it only runs when the jobs are due, so it cannot be abused to
 * run them more often than every few minutes.
 */
const cronAuth = (req: any) => {
  const secret = process.env.CRON_SECRET || '';
  const header = String(req.headers.authorization || '');
  if (!secret) return false;
  const given = header.replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const cronHandler = wrap(async (req, res) => {
  const user = (await import('../auth')).getAuthUser(req);
  const trusted = cronAuth(req) || isSuperAdmin(user);
  const only = typeof req.query.only === 'string' ? req.query.only.split(',') : undefined;
  if (trusted && only) return res.json({ success: true, ...(await runScheduledJobs({ only })) });
  const r = await runJobsOnce({ force: trusted });
  if (!trusted) return res.json({ success: true, ran: r.ran, reason: r.reason, lastRun: lastJobRun() });
  res.json({ success: true, ran: r.ran, reason: r.reason, ...(r.result || {}) });
});
adminRouter.get('/cron/run', cronHandler);
adminRouter.post('/cron/run', cronHandler);
