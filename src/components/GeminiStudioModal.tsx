import React, { useState, useRef, useEffect } from 'react';
import { api } from '../api';
import { User } from '../types';
import { Bot, Search, Mic, Square, Sparkles, Send, X, Globe, Megaphone, LogIn, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react';

type StudioTab = 'chat' | 'search' | 'marketing' | 'voice';

interface GeminiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: StudioTab;
  /** Signed-in user. Requests require sign-in; Marketing and Transcribe are admin-only. */
  user?: User | null;
  /** Opens the sign-in modal. */
  onOpenAuth?: () => void;
}

type ChatMsg = { role: 'user' | 'model'; text: string; error?: boolean };

const isHttpUrl = (v: string) => /^https?:\/\//i.test(v.trim());
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export const GeminiStudioModal: React.FC<GeminiStudioModalProps> = ({ isOpen, onClose, defaultTab = 'chat', user = null, onOpenAuth }) => {
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<StudioTab>(defaultTab);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Search grounding
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<{ text: string; sources: string[]; grounded: boolean } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Marketing (admin)
  const [marketingPrompt, setMarketingPrompt] = useState('');
  const [marketingTeam, setMarketingTeam] = useState('');
  const [marketingResult, setMarketingResult] = useState<string | null>(null);
  const [marketingError, setMarketingError] = useState<string | null>(null);
  const [marketingLoading, setMarketingLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Transcribe (admin)
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const tabs: { id: StudioTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'chat', label: 'Chat', icon: Bot },
    { id: 'search', label: 'Search', icon: Globe },
    ...(isAdmin
      ? ([
          { id: 'marketing', label: 'Marketing', icon: Megaphone },
          { id: 'voice', label: 'Transcribe', icon: Mic },
        ] as const)
      : []),
  ];

  // Non-admins can never land on admin tabs
  useEffect(() => {
    if (!isAdmin && (tab === 'marketing' || tab === 'voice')) setTab('chat');
  }, [isAdmin, tab]);

  useEffect(() => {
    if (isOpen) setTab(isAdmin || defaultTab === 'chat' || defaultTab === 'search' ? defaultTab : 'chat');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (tab === 'chat') chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chatMessages, chatLoading, tab]);

  // Lock page scroll + Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  // Stop any recording when closing
  useEffect(() => {
    if (!isOpen && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading || !user) return;
    const newHistory: ChatMsg[] = [...chatMessages, { role: 'user', text }];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const payload = newHistory.filter(m => !m.error).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
      const res = await api.chatGemini(payload);
      if (res?.text && res.text.trim()) {
        setChatMessages([...newHistory, { role: 'model', text: res.text }]);
      } else {
        setChatMessages([...newHistory, { role: 'model', text: 'The assistant returned an empty response. Please try again.', error: true }]);
      }
    } catch (err: any) {
      setChatMessages([...newHistory, { role: 'model', text: err?.message || 'The assistant is unavailable right now.', error: true }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q || searchLoading || !user) return;
    setSearchLoading(true);
    setSearchResult(null);
    setSearchError(null);
    try {
      const res = await api.searchGrounding(q);
      setSearchResult(res);
    } catch (err: any) {
      setSearchError(err?.message || 'Search is unavailable right now.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleMarketing = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = marketingPrompt.trim();
    if (!p || marketingLoading || !isAdmin) return;
    setMarketingLoading(true);
    setMarketingResult(null);
    setMarketingError(null);
    setCopied(false);
    try {
      const res = await api.generateMarketing(p, marketingTeam.trim() || undefined);
      setMarketingResult(res.text);
    } catch (err: any) {
      setMarketingError(err?.message || 'Could not generate copy.');
    } finally {
      setMarketingLoading(false);
    }
  };

  const copyMarketing = async () => {
    if (!marketingResult) return;
    try {
      await navigator.clipboard.writeText(marketingResult);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const startRecording = async () => {
    setTranscribeError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const mime = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Data = String(reader.result || '').split(',')[1] || '';
          if (!base64Data) return;
          setTranscribing(true);
          try {
            const res = await api.transcribeAudio(base64Data, mime);
            setTranscription(res.text);
          } catch (e: any) {
            setTranscribeError(e?.message || 'Transcription failed.');
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setTranscription(null);
    } catch {
      setTranscribeError('Microphone access is needed to record audio.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const SignInPrompt = () => (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-10 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 border border-amber-400/30 flex items-center justify-center">
        <LogIn className="w-7 h-7" />
      </div>
      <p className="text-sm text-slate-300 max-w-xs">Sign in to use the AI assistant.</p>
      {onOpenAuth && (
        <button
          onClick={() => {
            onClose();
            onOpenAuth();
          }}
          className="min-h-[44px] px-6 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm"
        >
          Sign in
        </button>
      )}
    </div>
  );

  const ErrorBox = ({ message }: { message: string }) => (
    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span className="break-words min-w-0">{message}</span>
    </div>
  );

  const inputBarStyle: React.CSSProperties = { paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch sm:items-center justify-center sm:p-6 bg-slate-950/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="AI assistant"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full sm:max-w-3xl h-[100dvh] sm:h-[85dvh] bg-slate-900 sm:border border-amber-500/40 sm:rounded-3xl shadow-2xl flex flex-col text-slate-100 overflow-hidden"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-800 bg-slate-900" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-black text-white truncate">AI assistant</h2>
              <p className="text-xs text-slate-400 truncate">Answers can be wrong — check important details.</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-800 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {tabs.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto px-4 sm:px-6 pb-3 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-sm font-bold">
              {tabs.map(t => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 min-h-[36px] flex items-center gap-1.5 px-3.5 rounded-xl whitespace-nowrap transition-colors ${
                      active ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-950 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                    {(t.id === 'marketing' || t.id === 'voice') && (
                      <span className={`text-xs font-bold ${active ? 'text-slate-900/70' : 'text-slate-500'}`}>admin</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!user ? (
          <SignInPrompt />
        ) : (
          <>
            {/* CHAT */}
            {tab === 'chat' && (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-3">
                  {chatMessages.length === 0 && !chatLoading && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-300 leading-relaxed">
                      Ask about the tournament format, rules, franchises, players or fantasy picks. The assistant covers all six franchises.
                    </div>
                  )}
                  {chatMessages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {m.error ? (
                        <div className="max-w-[88%] p-3.5 rounded-2xl rounded-bl-none bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span className="break-words min-w-0">{m.text}</span>
                        </div>
                      ) : (
                        <div
                          className={`max-w-[88%] p-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                            m.role === 'user'
                              ? 'bg-amber-400 text-slate-950 font-semibold rounded-br-none'
                              : 'bg-slate-950 text-slate-200 border border-slate-800 rounded-bl-none'
                          }`}
                        >
                          {m.text}
                        </div>
                      )}
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-amber-400 font-bold animate-pulse">Thinking…</div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                <form
                  onSubmit={handleSendChat}
                  className="shrink-0 sticky bottom-0 border-t border-slate-800 bg-slate-900 px-4 sm:px-6 pt-3 flex items-center gap-2"
                  style={inputBarStyle}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder="Ask a question…"
                    enterKeyHint="send"
                    aria-label="Message"
                    className="flex-1 min-w-0 min-h-[44px] px-4 bg-slate-950 border border-slate-700 rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-11 h-11 shrink-0 flex items-center justify-center bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </>
            )}

            {/* SEARCH */}
            {tab === 'search' && (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
                  {!searchResult && !searchError && !searchLoading && (
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-sm text-slate-300 leading-relaxed">
                      Search the web with Google for recent news, results and schedules. Answers include the sources used.
                    </div>
                  )}
                  {searchLoading && <div className="text-sm text-amber-400 font-bold animate-pulse">Searching…</div>}
                  {searchError && <ErrorBox message={searchError} />}
                  {searchResult && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                          <Globe className="w-4 h-4" /> Result
                        </span>
                        {searchResult.grounded ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-bold">Grounded with Google Search</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-bold">Not grounded</span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words">{searchResult.text}</p>
                      {searchResult.sources && searchResult.sources.length > 0 && (
                        <div className="pt-3 border-t border-slate-800 space-y-1.5">
                          <span className="text-xs font-bold text-slate-300 block">Sources</span>
                          <ul className="space-y-1">
                            {searchResult.sources.map((src, i) => (
                              <li key={i} className="text-sm min-w-0">
                                {isHttpUrl(src) ? (
                                  <a
                                    href={src}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 min-h-[36px] text-amber-400 hover:text-amber-300 break-all"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    {hostOf(src)}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 break-words">{src}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <form
                  onSubmit={handleSearch}
                  className="shrink-0 sticky bottom-0 border-t border-slate-800 bg-slate-900 px-4 sm:px-6 pt-3 flex items-center gap-2"
                  style={inputBarStyle}
                >
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="e.g. Abu Dhabi T10 latest results"
                    enterKeyHint="search"
                    aria-label="Search query"
                    className="flex-1 min-w-0 min-h-[44px] px-4 bg-slate-950 border border-slate-700 rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    disabled={searchLoading || !searchQuery.trim()}
                    className="min-w-[44px] h-11 px-3 sm:px-4 shrink-0 flex items-center justify-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl disabled:opacity-50"
                  >
                    <Search className="w-5 h-5" />
                    <span className="hidden sm:inline">Search</span>
                  </button>
                </form>
              </>
            )}

            {/* MARKETING (admin) */}
            {tab === 'marketing' && isAdmin && (
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4" style={inputBarStyle}>
                <form onSubmit={handleMarketing} className="space-y-3">
                  <div>
                    <label htmlFor="mk-prompt" className="text-xs font-bold text-slate-300 block mb-1.5">
                      What should the copy be about?
                    </label>
                    <textarea
                      id="mk-prompt"
                      value={marketingPrompt}
                      onChange={e => setMarketingPrompt(e.target.value)}
                      rows={4}
                      placeholder="e.g. Matchday reminder post for tonight's fixture"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none resize-y"
                    />
                  </div>
                  <div>
                    <label htmlFor="mk-team" className="text-xs font-bold text-slate-300 block mb-1.5">
                      Franchise (optional)
                    </label>
                    <input
                      id="mk-team"
                      type="text"
                      value={marketingTeam}
                      onChange={e => setMarketingTeam(e.target.value)}
                      placeholder="Leave blank for league-wide copy"
                      className="w-full min-h-[44px] px-4 bg-slate-950 border border-slate-700 rounded-xl text-base sm:text-sm text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={marketingLoading || !marketingPrompt.trim()}
                    className="w-full sm:w-auto min-h-[44px] px-6 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Megaphone className="w-4 h-4" />
                    {marketingLoading ? 'Generating…' : 'Generate draft'}
                  </button>
                </form>
                {marketingError && <ErrorBox message={marketingError} />}
                {marketingResult && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase text-amber-400">Draft — review before posting</span>
                      <button
                        onClick={copyMarketing}
                        className="min-h-[36px] px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-bold flex items-center gap-1.5"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{marketingResult}</p>
                  </div>
                )}
              </div>
            )}

            {/* TRANSCRIBE (admin) */}
            {tab === 'voice' && isAdmin && (
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col items-center justify-center text-center px-4 sm:px-6 py-6 space-y-5"
                style={inputBarStyle}
              >
                <p className="text-sm text-slate-300 max-w-sm">Record a short clip from your microphone and get a text transcript.</p>
                {isRecording ? (
                  <button
                    onClick={stopRecording}
                    aria-label="Stop recording"
                    className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center animate-pulse"
                  >
                    <Square className="w-8 h-8 fill-white" />
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    disabled={transcribing}
                    aria-label="Start recording"
                    className="w-20 h-20 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center justify-center disabled:opacity-50"
                  >
                    <Mic className="w-8 h-8" />
                  </button>
                )}
                <p className="text-sm font-bold text-slate-300">
                  {isRecording ? 'Recording… tap to stop' : transcribing ? 'Transcribing…' : 'Tap the microphone to record'}
                </p>
                {transcribeError && (
                  <div className="w-full max-w-lg text-left">
                    <ErrorBox message={transcribeError} />
                  </div>
                )}
                {transcription && (
                  <div className="w-full max-w-lg p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left">
                    <span className="text-xs font-bold text-amber-400 block mb-1">Transcript</span>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{transcription}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
