import { googleAccessToken, parseServiceAccount, ServiceAccount } from './googleAuth';

/**
 * Firebase Cloud Messaging (HTTP v1) sender.
 * Configure with FIREBASE_SERVICE_ACCOUNT = the service-account JSON (raw or base64).
 * Without it, notifications are stored and shown in-app only.
 */
let account: ServiceAccount | null | undefined;
function getAccount(): ServiceAccount | null {
  if (account !== undefined) return account;
  account = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  if (!account && process.env.FIREBASE_SERVICE_ACCOUNT) console.error('[PUSH] FIREBASE_SERVICE_ACCOUNT is not a valid service-account JSON');
  return account ?? null;
}

export const pushServerConfigured = () => Boolean(getAccount());

/** Sends to each token; returns counts and the tokens FCM reported as dead. */
export async function sendFcm(
  tokens: string[],
  msg: { title: string; body: string; url?: string; data?: Record<string, string> }
): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
  const sa = getAccount();
  if (!sa || tokens.length === 0) return { success: 0, failure: 0, invalidTokens: [] };
  const bearer = await googleAccessToken(sa, 'https://www.googleapis.com/auth/firebase.messaging');
  const base = (process.env.FCM_API_BASE || 'https://fcm.googleapis.com').replace(/\/$/, '');
  const endpoint = `${base}/v1/projects/${sa.project_id}/messages:send`;
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
