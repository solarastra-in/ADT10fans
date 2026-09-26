import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { 
  Bot, 
  Search, 
  Mic, 
  MicOff, 
  Music, 
  Video, 
  Sparkles, 
  Send, 
  X, 
  Play, 
  Square, 
  Upload, 
  Volume2, 
  Globe, 
  Film 
} from 'lucide-react';

interface GeminiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'chat' | 'search' | 'voice' | 'music' | 'video';
}

export const GeminiStudioModal: React.FC<GeminiStudioModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'chat'
}) => {
  const [tab, setTab] = useState<'chat' | 'search' | 'voice' | 'music' | 'video'>(defaultTab);

  // 1. Chatbot State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
    {
      role: 'model',
      text: "👋 Marhaba! I am your Abu Dhabi T10 AI Strategist and Arabian Aces Franchise Analyst. Ask me anything about T10 match strategies, player rosters, tournament rules, or fantasy picks!"
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // 2. Search Grounding State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ text: string; sources: string[]; grounded: boolean } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // 3. Audio Transcription / Voice State
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // 4. Music Generation State (Lyria)
  const [musicPrompt, setMusicPrompt] = useState('Heroic Arabic percussion fused with electric rock stadium anthem for Arabian Aces walkout');
  const [musicResult, setMusicResult] = useState<{ status: string; message: string; audioData?: string; audioUrl?: string } | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);

  // 5. Veo Video Generation State
  const [videoPrompt, setVideoPrompt] = useState('Moeen Ali hitting a match-winning six into the floodlights at Zayed Cricket Stadium in slow motion');
  const [uploadedPhoto, setUploadedPhoto] = useState<string | null>(null);
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [videoResult, setVideoResult] = useState<{ status: string; videoUrl?: string; message: string } | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    if (tab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, tab]);

  if (!isOpen) return null;

  // Handle Send Chat
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userText = chatInput;
    const newHistory = [...chatMessages, { role: 'user' as const, text: userText }];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const payload = newHistory.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      const res = await api.chatGemini(payload);
      setChatMessages([...newHistory, { role: 'model', text: res.text }]);
    } catch (err: any) {
      setChatMessages([...newHistory, { role: 'model', text: "Error connecting to AI: " + err.message }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Handle Google Search Grounding
  const handleSearchGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchLoading) return;
    setSearchLoading(true);
    setSearchResult(null);
    try {
      const res = await api.searchGrounding(searchQuery);
      setSearchResult(res);
    } catch (err: any) {
      alert(err?.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // Audio Recording & Transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          setTranscribing(true);
          try {
            const res = await api.transcribeAudio(base64Data, 'audio/webm');
            setTranscription(res.text);
          } catch (e: any) {
            setTranscription('Transcription error: ' + e?.message);
          } finally {
            setTranscribing(false);
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscription(null);
    } catch (err) {
      alert('Microphone access is required for audio transcription.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Handle Music Generation
  const handleGenerateMusic = async () => {
    setMusicLoading(true);
    setMusicResult(null);
    try {
      const res = await api.generateMusic(musicPrompt);
      setMusicResult(res);
    } catch (e: any) {
      alert(e?.message);
    } finally {
      setMusicLoading(false);
    }
  };

  // Handle Veo Video Generation
  const handleGenerateVideo = async () => {
    setVideoLoading(true);
    setVideoResult(null);
    try {
      const res = await api.generateVideo(videoPrompt, uploadedPhoto || undefined, videoAspectRatio);
      setVideoResult(res);
    } catch (e: any) {
      alert(e?.message);
    } finally {
      setVideoLoading(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setUploadedPhoto(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col h-[85vh] text-slate-100">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">
              Abu Dhabi T10 <span className="text-amber-400">AI Intelligence Suite</span>
            </h2>
            <p className="text-xs text-slate-400">
              Powered by Gemini 3.5 Flash, Google Search Grounding, Transcribe, Lyria & Veo 3
            </p>
          </div>
        </div>

        {/* Feature Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-slate-800/80 no-scrollbar text-xs font-bold">
          {[
            { id: 'chat', label: 'AI Strategist Chat', icon: Bot },
            { id: 'search', label: 'Google Search Grounding', icon: Globe },
            { id: 'voice', label: 'Audio Transcription', icon: Mic },
            { id: 'music', label: 'Stadium Music (Lyria)', icon: Music },
            { id: 'video', label: 'Veo Video Generator', icon: Film },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl whitespace-nowrap transition-all ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Multi-Turn Chatbot */}
        {tab === 'chat' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 no-scrollbar">
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-amber-400 text-slate-950 font-semibold rounded-br-none shadow-md shadow-amber-500/10'
                        : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-amber-400 font-bold animate-pulse">
                    AI Strategist analyzing tournament playbook...
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendChat} className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Ask about Arabian Aces batting order, rules, or bowler economy..."
                className="flex-1 px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-400 outline-none"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="p-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl disabled:opacity-50 transition-transform active:scale-95"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Search Grounding */}
        {tab === 'search' && (
          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <h3 className="font-extrabold text-sm text-white mb-1">
                Real-Time Google Search Grounding (gemini-3.5-flash)
              </h3>
              <p className="text-xs text-slate-400 mb-3">
                Query current Abu Dhabi T10 match results, live schedule, weather at Zayed Stadium, or international player news.
              </p>

              <form onSubmit={handleSearchGrounding} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="e.g. Latest Abu Dhabi T10 2026 news and team standings"
                  className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:border-amber-400 outline-none"
                />
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/20"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{searchLoading ? 'Searching...' : 'Search'}</span>
                </button>
              </form>
            </div>

            {searchResult && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Grounded Search Output
                  </span>
                  {searchResult.grounded && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                      ✓ Google Verified
                    </span>
                  )}
                </div>

                <p className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
                  {searchResult.text}
                </p>

                {searchResult.sources && searchResult.sources.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    <span className="font-bold text-slate-300">Sources:</span> {searchResult.sources.slice(0, 4).join(' · ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Audio Transcription */}
        {tab === 'voice' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-6">
            <div className="max-w-md">
              <h3 className="font-extrabold text-lg text-white mb-2">
                Speech-to-Text Transcription (gemini-3.5-transcribe)
              </h3>
              <p className="text-xs text-slate-400">
                Click below to record your voice from the microphone. Gemini will transcribe your match predictions or voice commentary into accurate text.
              </p>
            </div>

            <div>
              {isRecording ? (
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-500/30 animate-pulse transition-transform hover:scale-105"
                >
                  <Square className="w-8 h-8 fill-white" />
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={transcribing}
                  className="w-20 h-20 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 transition-transform hover:scale-105"
                >
                  <Mic className="w-8 h-8" />
                </button>
              )}
            </div>

            <p className="text-xs font-bold text-slate-300">
              {isRecording ? 'Listening... click to stop' : transcribing ? 'Transcribing audio with Gemini...' : 'Click microphone to record'}
            </p>

            {transcription && (
              <div className="w-full max-w-lg p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs">
                <span className="font-bold text-amber-400 block mb-1">Transcribed Result:</span>
                <p className="text-slate-200">{transcription}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Music Generation (Lyria) */}
        {tab === 'music' && (
          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Music className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">
                  Franchise Anthem & Stadium Walkout Music (Lyria)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Generate custom high-energy 20-30 second audio clips for Arabian Aces and Abu Dhabi T10 match days.
              </p>

              <textarea
                rows={2}
                value={musicPrompt}
                onChange={e => setMusicPrompt(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white mb-3"
              />

              <button
                onClick={handleGenerateMusic}
                disabled={musicLoading}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20"
              >
                <Music className="w-4 h-4" />
                <span>{musicLoading ? 'Composing Track...' : 'Generate Stadium Anthem'}</span>
              </button>
            </div>

            {musicResult && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                <span className="text-xs font-bold text-amber-400">Playable Audio Output:</span>
                <audio
                  controls
                  className="w-full"
                  src={musicResult.audioData || musicResult.audioUrl}
                />
                <p className="text-[11px] text-slate-400">{musicResult.message}</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Veo Video Generator */}
        {tab === 'video' && (
          <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Film className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">
                  Veo 3 Video Generation (Text-to-Video & Image-to-Video)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Generate high-definition cinematic animations for social media reels, boundary celebrations, and match highlights.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Video Prompt</label>
                  <textarea
                    rows={2}
                    value={videoPrompt}
                    onChange={e => setVideoPrompt(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Optional Source Photo (Image-to-Video)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Aspect Ratio</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setVideoAspectRatio('16:9')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${videoAspectRatio === '16:9' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
                      >
                        16:9 (Landscape)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoAspectRatio('9:16')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${videoAspectRatio === '9:16' ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-300'}`}
                      >
                        9:16 (Reels/TikTok)
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateVideo}
                  disabled={videoLoading}
                  className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl flex items-center gap-2 shadow-md shadow-amber-500/20"
                >
                  <Film className="w-4 h-4" />
                  <span>{videoLoading ? 'Rendering Veo Video...' : 'Generate Veo 3 Video'}</span>
                </button>
              </div>
            </div>

            {videoResult && (
              <div className="p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                <span className="text-xs font-bold text-amber-400">Rendered Video Output:</span>
                {videoResult.videoUrl ? (
                  <video
                    controls
                    className="w-full max-h-64 rounded-xl bg-black"
                    src={videoResult.videoUrl}
                  />
                ) : (
                  <p className="text-xs text-slate-300">{videoResult.message}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
