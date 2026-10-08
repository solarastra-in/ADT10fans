import { SignJWT, importPKCS8 } from 'jose';

/**
 * Firebase Cloud Messaging (HTTP v1) sender.
 * Configure with FIREBASE_SERVICE_ACCOUNT = the service-account JSON (raw or base64).
 * Without it, notifications are stored and shown in-app only.
 */
type ServiceAccount = { project_id: string; client_email: string; private_key: string };

let account: ServiceAccount | null | undefined;
function getAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return (account = null);
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    account = parsed.client_email && parsed.private_key && parsed.project_id ? parsed : null;
  } catch (e) {
    console.error('[PUSH] FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    account = null;
  }
  return account ?? null;
}

export const pushServerConfigured = () => Boolean(getAccount());

let cachedToken: { value: string; exp: number } | null = null;
async function accessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: ${res.status}`);
  const body: any = await res.json();
  cachedToken = { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

/** Sends to each token; returns counts and the tokens FCM reported as dead. */
export async function sendFcm(
  tokens: string[],
  msg: { title: string; body: string; url?: string; data?: Record<string, string> }
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  const sa = getAccount();
  if (!sa || tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };
  const bearer = await accessToken(sa);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  let success = 0;
  let failure = 0;
  const invalidTokens: string[] = [];
  const data: Record<string, string> = { ...(msg.data || {}), url: msg.url || '/' };

  // Modest concurrency to stay well inside FCM quotas.
  const queue = [...tokens];
  const worker = async () => {
    while (queue.length) {
      const token = queue.shift()!;
      try {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: msg.title, body: msg.body },
              data,
              webpush: { fcm_options: { link: msg.url || '/' } },
            },
          }),
        });
        if (r.ok) success++;
        else {
          failure++;
          if (r.status === 404 || r.status === 400) invalidTokens.push(token);
        }
      } catch {
        failure++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, tokens.length) }, worker));
  return { success, failure, invalidTokens };
}
