import { SignJWT, importPKCS8 } from 'jose';

/** Google service-account helpers shared by push (FCM) and the Cloud Storage store backend. */
export type ServiceAccount = { project_id: string; client_email: string; private_key: string };

/** Accepts raw JSON or base64-encoded JSON. Returns null when it is missing or incomplete. */
export function parseServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  if (!raw || !raw.trim()) return null;
  try {
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw.trim(), 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    return parsed.client_email && parsed.private_key && parsed.project_id ? parsed : null;
  } catch {
    return null;
  }
}

const cache = new Map<string, { value: string; exp: number }>();

/** OAuth2 access token for a service account via the JWT-bearer grant (cached until near expiry). */
export async function googleAccessToken(sa: ServiceAccount, scope: string): Promise<string> {
  const key = `${sa.client_email}|${scope}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return hit.value;
  const tokenUrl = process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token';
  const pk = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(pk);
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange failed: HTTP ${res.status}`);
  const body: any = await res.json();
  cache.set(key, { value: body.access_token, exp: Date.now() + (body.expires_in || 3600) * 1000 });
  return body.access_token;
}
