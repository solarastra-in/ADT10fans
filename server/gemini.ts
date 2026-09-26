import { GoogleGenAI, Modality } from '@google/genai';

let aiInstance: GoogleGenAI | null = null;

function getAI(): GoogleGenAI | null {
  if (aiInstance) return aiInstance;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  aiInstance = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return aiInstance;
}

export async function generateMarketingContent(prompt: string, context: { teamName?: string; topic?: string }) {
  const ai = getAI();
  if (!ai) {
    return {
      text: `🏆 [Demo AI Marketing Preview] Abu Dhabi T10 2026: Experience the roaring power of ${context.teamName || 'Arabian Aces'} under the floodlights at Zayed Cricket Stadium! 90 minutes of relentless boundary hitting, superstar fireworks, and thrilling fan rewards. Enter the predictor contest now to win VIP hospitality passes and signed merchandise!`,
      source: 'local-fallback (No GEMINI_API_KEY configured)'
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `You are the lead marketing director and sports media agent for Abu Dhabi T10 League and the franchise team "${context.teamName || 'Arabian Aces'}". 
Task: ${prompt}
Focus on high-energy cricket excitement, 10-over format tempo, fan contests, VIP hospitality draws, and social media viral hooks. Format with punchy headlines, emoji accents, call to action, and hashtags (#AbuDhabiT10, #ArabianAces, #T10Cricket, #ZayedStadium).`,
    });

    return {
      text: response.text || 'Marketing campaign generated successfully.',
      source: 'Gemini 3.8 Flash'
    };
  } catch (error: any) {
    console.error('Gemini marketing generation failed:', error);
    return {
      text: `Exciting Abu Dhabi T10 2026 updates: Follow ${context.teamName || 'Arabian Aces'} as Lance Klusener and Moeen Ali prepare for the ultimate 10-over sprint!`,
      source: 'fallback: ' + (error?.message || 'Gemini error')
    };
  }
}

export async function discoverSocialHandlesAI(teamName: string, missingPlatforms: string[]) {
  const ai = getAI();
  if (!ai) {
    return [
      { platform: 'Instagram', handle: `@${teamName.toLowerCase().replace(/\s+/g, '')}official`, url: `https://instagram.com/${teamName.toLowerCase().replace(/\s+/g, '')}official`, confidence: 'estimated' }
    ];
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Find or verify official social media handles and website for the Abu Dhabi T10 franchise "${teamName}".
Needed platforms: ${missingPlatforms.join(', ')}.
Return a JSON array of discovered items with keys: platform, handle, url, confidence, evidence.
Example: [{"platform": "Instagram", "handle": "@arabianacesofficial", "url": "https://www.instagram.com/arabianacesofficial", "confidence": "high", "evidence": "Official franchise bio"}]`,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const parsed = JSON.parse(response.text?.trim() || '[]');
    return parsed;
  } catch (error) {
    console.error('Gemini handle discovery error:', error);
    return [];
  }
}

export async function generateTacticalMatchPreview(matchDetails: { teamA: string; teamB: string; venue: string }) {
  const ai = getAI();
  if (!ai) {
    return `Match Preview: ${matchDetails.teamA} lock horns with ${matchDetails.teamB} at ${matchDetails.venue}. Expect high boundary percentages in the powerplay overs.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Provide a tactical, exciting 150-word match preview for Abu Dhabi T10 between ${matchDetails.teamA} and ${matchDetails.teamB} at ${matchDetails.venue}. Mention pitch conditions at Zayed Stadium, key player face-offs, and projected total.`,
    });
    return response.text || 'Exciting clash ahead.';
  } catch (e) {
    return `High-intensity Abu Dhabi T10 battle between ${matchDetails.teamA} and ${matchDetails.teamB}.`;
  }
}

// 1. Gemini Chatbot: Multi-turn chat using gemini-3.5-flash with system instruction
export async function chatWithGemini(messages: { role: 'user' | 'model'; parts: { text: string }[] }[]) {
  const ai = getAI();
  if (!ai) {
    const lastMsg = messages[messages.length - 1]?.parts?.[0]?.text || '';
    return {
      text: `[Offline AI Mode] Regarding "${lastMsg}": In Abu Dhabi T10, each innings is strictly 10 overs (60 balls) with maximum 2 overs per bowler. Arabian Aces is led by Lance Klusener as Head Coach with Moeen Ali as Icon Star!`,
      source: 'offline-knowledge-base'
    };
  }

  try {
    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      config: {
        systemInstruction: `You are the official Abu Dhabi T10 League & Arabian Aces Franchise AI Strategist and Cricket Analyst.
You assist fans with match strategies, team squads (Arabian Aces, Deccan Gladiators, UAE Bulls, Northern Warriors, etc.), cricket rules (10 overs, 2 overs max per bowler, 90 minute match duration, 10 wickets), player credits, Fantasy 10 advice, and verified social media links.
Be energetic, knowledgeable, and passionate about the Abu Dhabi T10 format!`
      }
    });

    const lastMessage = messages[messages.length - 1]?.parts?.[0]?.text || 'Hello!';
    const response = await chat.sendMessage({
      message: lastMessage
    });

    return {
      text: response.text || 'No response generated.',
      source: 'Gemini 3.5 Flash'
    };
  } catch (error: any) {
    console.error('Chatbot error:', error);
    return {
      text: `T10 Cricket Insight: In the 10-over format, run-rates typically hover between 11.5 and 14.2 an over at Zayed Cricket Stadium. Arabian Aces have stacked their top order with aggressive boundary clearers to take full advantage of the powerplay!`,
      source: 'fallback'
    };
  }
}

// 2. Google Search Grounding using gemini-3.5-flash
export async function searchGroundingCricket(query: string) {
  const ai = getAI();
  if (!ai) {
    return {
      text: `Abu Dhabi T10 2026 takes place at the Zayed Cricket Stadium in Abu Dhabi. 9 franchises are competing across 28 matches in 12 days, broadcasted across 110 countries. Arabian Aces is the flagship new team for the 2026 season.`,
      sources: ['abudhabit10.com', 'espncricinfo.com'],
      grounded: false
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Provide the latest up-to-date cricket information and Abu Dhabi T10 context for: "${query}". Focus on verified facts, schedule, stadium conditions, and franchise data.`,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const webSources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web?.title || c.web?.uri).filter(Boolean) || [];

    return {
      text: response.text || 'Information retrieved.',
      sources: webSources,
      grounded: true
    };
  } catch (error: any) {
    console.error('Search grounding error:', error);
    return {
      text: `Abu Dhabi T10 is the world's premier ICC-sanctioned ten-over cricket competition, held annually at Zayed Cricket Stadium. The format features 90-minute games packed with power-hitting.`,
      sources: ['abudhabit10.com'],
      grounded: false
    };
  }
}

// 3. Audio Transcription with gemini-3.5-transcribe
export async function transcribeAudioVoice(audioBase64: string, mimeType = 'audio/webm') {
  const ai = getAI();
  if (!ai) {
    return { text: "Simulated transcription: 'Go Arabian Aces! Moeen Ali to hit a six over long on!'" };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64
            }
          },
          {
            text: 'Transcribe this cricket commentary or fan audio accurately in English.'
          }
        ]
      }
    });

    return { text: response.text || 'No speech detected.' };
  } catch (error: any) {
    console.error('Transcription error:', error);
    return { text: 'Transcription error: ' + error.message };
  }
}

// 4. Music Generation with Lyria
export async function generateStadiumMusic(prompt: string) {
  const ai = getAI();
  if (!ai) {
    return {
      status: 'demo',
      message: 'Music generation requires an active API key with Lyria access.',
      audioUrl: 'https://actions.google.com/sounds/v1/sports/stadium_cheer.ogg'
    };
  }

  try {
    const response = await ai.models.generateContentStream({
      model: 'lyria-3-clip-preview',
      contents: `Create a high-energy 20-second Abu Dhabi T10 stadium anthem. ${prompt}`,
    });

    let audioBase64 = '';
    let mimeType = 'audio/wav';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          audioBase64 += part.inlineData.data;
          if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
        }
      }
    }

    if (audioBase64) {
      return {
        status: 'success',
        audioData: `data:${mimeType};base64,${audioBase64}`
      };
    }
  } catch (error: any) {
    console.warn('Lyria music error:', error.message);
  }

  return {
    status: 'demo',
    message: 'Stadium cheer track rendered for demo',
    audioUrl: 'https://actions.google.com/sounds/v1/sports/stadium_cheer.ogg'
  };
}

// 5. Veo 3 Video Generation (Text-to-Video & Image-to-Video)
export async function generateVeoVideo(prompt: string, imageBase64?: string, aspectRatio: '16:9' | '9:16' = '16:9') {
  const ai = getAI();
  if (!ai) {
    return {
      status: 'simulated',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      message: 'Veo video rendered preview (demo mode).'
    };
  }

  try {
    const payload: any = {
      model: 'veo-3.1-lite-generate-preview',
      prompt: prompt || 'A cinematic shot of a cricket ball exploding through floodlights at Zayed Cricket Stadium Abu Dhabi',
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio
      }
    };

    if (imageBase64) {
      payload.image = {
        imageBytes: imageBase64,
        mimeType: 'image/jpeg'
      };
    }

    const operation = await ai.models.generateVideos(payload);
    return {
      status: 'pending',
      operationName: operation.name,
      message: 'Video generation started.'
    };
  } catch (error: any) {
    console.error('Veo video error:', error);
    return {
      status: 'simulated',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
      message: 'Simulation fallback: ' + (error?.message || 'Veo requires paid API key flow')
    };
  }
}
