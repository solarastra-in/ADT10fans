import { GoogleGenAI } from '@google/genai';

/**
 * Gemini helpers. There are no canned fallbacks: when Gemini isn't configured or a call
 * fails, callers get an error and the UI says so.
 */
/** Read on each call so a model set in Admin → Environment applies straight away. */
export const geminiModel = () => process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let aiInstance: GoogleGenAI | null = null;
let aiKey = '';
export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}
function getAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    const err: any = new Error("The AI assistant isn't configured yet.");
    err.status = 503;
    throw err;
  }
  // Recreated when the key changes (it can be replaced in Admin → Environment).
  if (!aiInstance || aiKey !== process.env.GEMINI_API_KEY) {
    aiKey = process.env.GEMINI_API_KEY;
    aiInstance = new GoogleGenAI({ apiKey: aiKey });
  }
  return aiInstance;
}

const LEAGUE_CONTEXT = (teams: string[]) =>
  `Context: Abu Dhabi T10 is a ten-overs-a-side franchise cricket league played at Zayed Cricket Stadium, Abu Dhabi.` +
  (teams.length ? ` Current franchises: ${teams.join(', ')}.` : '') +
  ` Be neutral between franchises. If you are not sure about a fact (squads, results, dates), say so instead of guessing.`;

export async function chatWithGemini(messages: { role: 'user' | 'model'; parts: { text: string }[] }[], teams: string[]) {
  const ai = getAI();
  const history = messages.slice(-12).map(m => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: String(m.parts?.[0]?.text || '').slice(0, 4000) }],
  }));
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents: history,
    config: { systemInstruction: `You are a friendly cricket assistant for fans on an Abu Dhabi T10 fan site. ${LEAGUE_CONTEXT(teams)}` },
  });
  return { text: response.text || '', source: geminiModel() };
}

export async function searchGroundingCricket(query: string, teams: string[]) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents: `${LEAGUE_CONTEXT(teams)}\n\nAnswer using up-to-date web results, citing facts precisely: ${query.slice(0, 500)}`,
    config: { tools: [{ googleSearch: {} }] },
  });
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = chunks
    .map((c: any) => c.web?.uri || c.web?.title)
    .filter(Boolean)
    .slice(0, 8);
  return { text: response.text || '', sources, grounded: sources.length > 0 };
}

export async function generateMarketingContent(prompt: string, context: { teamName?: string }) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents:
      `You write social media copy for an Abu Dhabi T10 fan community${context.teamName ? ` focusing on ${context.teamName}` : ''}. ` +
      `Do not invent statistics, results, prizes or quotes; use placeholders like [PRIZE] where facts are needed.\nTask: ${prompt.slice(0, 2000)}`,
  });
  return { text: response.text || '', source: geminiModel() };
}

export async function transcribeAudioVoice(audioBase64: string, mimeType = 'audio/webm') {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }, { text: 'Transcribe this audio accurately. Return only the transcript.' }] }],
  });
  return { text: response.text || '' };
}

export interface DiscoveredSocialHandle {
  platform: 'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube';
  handle: string;
  url: string;
  evidence: string;
}

/**
 * Ask Gemini (with Google Search grounding) for a franchise's official accounts.
 * Results are only *suggestions* — they go to the admin approval queue as pending.
 */
export async function suggestOfficialHandles(teamName: string, platforms: string[]): Promise<DiscoveredSocialHandle[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: geminiModel(),
    contents:
      `Find the OFFICIAL social media accounts of the Abu Dhabi T10 cricket franchise "${teamName}" on: ${platforms.join(', ')}. ` +
      `Only include an account if a search result clearly shows it belongs to this franchise. Omit anything uncertain. ` +
      `Return ONLY a JSON array: [{"platform":"X","handle":"@...","url":"https://...","evidence":"<source URL showing it is official>"}]`,
    config: { tools: [{ googleSearch: {} }] },
  });
  const raw = response.text || '';
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  let parsed: any[] = [];
  try {
    parsed = JSON.parse(m[0]);
  } catch {
    return [];
  }
  const hostFor: Record<string, RegExp> = {
    X: /^https:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?$/,
    Instagram: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/,
    Threads: /^https:\/\/(www\.)?threads\.(net|com)\/@[A-Za-z0-9_.]+\/?$/,
    Facebook: /^https:\/\/(www\.)?facebook\.com\/[A-Za-z0-9_.\-/]+$/,
    TikTok: /^https:\/\/(www\.)?tiktok\.com\/@[A-Za-z0-9_.]+\/?$/,
    LinkedIn: /^https:\/\/(www\.)?linkedin\.com\/(company|in)\/[A-Za-z0-9_\-]+\/?$/,
    YouTube: /^https:\/\/(www\.)?youtube\.com\/(@[A-Za-z0-9_.\-]+|channel\/UC[\w-]{22})\/?$/,
  };
  return parsed.filter(
    (p: any) => p && platforms.includes(p.platform) && typeof p.url === 'string' && hostFor[p.platform]?.test(p.url)
  );
}

export interface HarvestedPost {
  title: string;
  url: string;
  platform: 'X' | 'Instagram' | 'Threads' | 'Facebook' | 'TikTok' | 'LinkedIn' | 'YouTube' | 'Web';
  summary?: string;
  publishedAt?: string;
  image?: string;
}

let searchQuotaExhaustedUntil = 0;

export function isSearchQuotaExhausted() {
  return Date.now() < searchQuotaExhaustedUntil;
}

/**
 * Discovers recent public posts, announcements, and videos for a franchise using Google Search Grounding.
 * Returns validated posts without needing third-party services like Curator.io.
 */
export async function harvestSocialPostsWithSearch(
  teamName: string,
  handles: { platform: string; handle: string; url: string }[]
): Promise<HarvestedPost[]> {
  if (!geminiConfigured() || isSearchQuotaExhausted()) return [];
  try {
    const ai = getAI();
    const accounts = handles.map(h => `${h.platform}: ${h.handle} (${h.url})`).join(', ');
    const response = await ai.models.generateContent({
      model: geminiModel(),
      contents:
        `Find recent real public posts, tweets, reels, videos, or announcements from or about the Abu Dhabi T10 franchise "${teamName}". ` +
        (accounts ? `Official handles to check: ${accounts}. ` : '') +
        `Only return real URLs found on the web (e.g. from x.com, instagram.com, youtube.com, tiktok.com, facebook.com, or official news articles). ` +
        `Return ONLY a JSON array of objects: [{"title":"...","url":"https://...","platform":"X|Instagram|YouTube|TikTok|Facebook|Web","summary":"...","publishedAt":"YYYY-MM-DD"}]`,
      config: { tools: [{ googleSearch: {} }] },
    });
    const raw = response.text || '';
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p: any) => p && typeof p.url === 'string' && /^https:\/\/[^\s/]+/.test(p.url) && typeof p.title === 'string'
    );
  } catch (err: any) {
    const msg = String(err?.message || err || '');
    if (err?.status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      searchQuotaExhaustedUntil = Date.now() + 60 * 60_000; // 1-hour cooldown
    }
    return [];
  }
}


