import { GoogleGenAI } from '@google/genai';

/**
 * Gemini helpers. There are no canned fallbacks: when Gemini isn't configured or a call
 * fails, callers get an error and the UI says so.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

let aiInstance: GoogleGenAI | null = null;
export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}
function getAI(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    const err: any = new Error("The AI assistant isn't configured yet.");
    err.status = 503;
    throw err;
  }
  if (!aiInstance) aiInstance = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
    model: GEMINI_MODEL,
    contents: history,
    config: { systemInstruction: `You are a friendly cricket assistant for fans on an Abu Dhabi T10 fan site. ${LEAGUE_CONTEXT(teams)}` },
  });
  return { text: response.text || '', source: GEMINI_MODEL };
}

export async function searchGroundingCricket(query: string, teams: string[]) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
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
    model: GEMINI_MODEL,
    contents:
      `You write social media copy for an Abu Dhabi T10 fan community${context.teamName ? ` focusing on ${context.teamName}` : ''}. ` +
      `Do not invent statistics, results, prizes or quotes; use placeholders like [PRIZE] where facts are needed.\nTask: ${prompt.slice(0, 2000)}`,
  });
  return { text: response.text || '', source: GEMINI_MODEL };
}

export async function transcribeAudioVoice(audioBase64: string, mimeType = 'audio/webm') {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
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
    model: GEMINI_MODEL,
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
