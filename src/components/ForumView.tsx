import React, { useState, useEffect, useCallback } from 'react';
import { User, Team, ForumThread, ForumComment, PublicConfig } from '../types';
import { api } from '../api';
import {
  MessageSquare,
  MessageCircle,
  ThumbsUp,
  Plus,
  Search,
  Pin,
  PinOff,
  Flame,
  Sparkles,
  Calendar,
  Share2,
  Trophy,
  CheckCircle2,
  Send,
  X,
  Eye,
  Clock,
  Award,
  Trash2,
} from 'lucide-react';

interface ForumViewProps {
  user: User | null;
  teams: Team[];
  onOpenAuth: () => void;
  onUserPointsAwarded?: (newPoints: number) => void;
  /** Kept for interface compatibility; the proposal page is admin-only and is not linked from the forum. */
  onNavigateToProposal?: () => void;
  /** Opens the Admin Console (optional). */
  onOpenAdmin?: () => void;
  /** Public config (optional; not required). */
  config?: PublicConfig;
}

type Category = ForumThread['category'];

const CATEGORIES: { id: 'all' | Category; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', label: 'All', icon: MessageSquare },
  { id: 'matchday', label: 'Match day', icon: Flame },
  { id: 'tactics', label: 'Tactics & squads', icon: Trophy },
  { id: 'fantasy', label: 'Fantasy', icon: Sparkles },
  { id: 'franchises', label: 'Teams', icon: Share2 },
  { id: 'fanspaces', label: 'Fan spaces', icon: Calendar },
  { id: 'giveaways', label: 'Giveaways', icon: Award },
  { id: 'general', label: 'General', icon: MessageCircle },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]));

const SCROLL_ROW =
  'flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

const INPUT =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400';

function initials(name: string): string {
  return (
    (name || '?')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(w => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

const Avatar: React.FC<{ name: string; src?: string; size?: number }> = ({ name, src, size = 24 }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) };
  if (src && /^(https?:|data:image\/)/.test(src) && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        style={style}
        className="rounded-full object-cover ring-1 ring-slate-700 shrink-0 bg-slate-800"
      />
    );
  }
  return (
    <span
      style={style}
      className="rounded-full bg-slate-800 text-slate-200 font-black flex items-center justify-center ring-1 ring-slate-700 shrink-0"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
};

function sortThreads(list: ForumThread[]): ForumThread[] {
  return [...list].sort((a, b) => {
    const pa = a.pinned ? 1 : 0;
    const pb = b.pinned ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime();
  });
}

export const ForumView: React.FC<ForumViewProps> = ({ user, teams, onOpenAuth, onUserPointsAwarded }) => {
  const isAdmin = user?.role === 'admin';
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'all' | Category>('all');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Thread detail
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [threadComments, setThreadComments] = useState<ForumComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // New thread
  const [newThreadModalOpen, setNewThreadModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<Category>('general');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [submittingThread, setSubmittingThread] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const showToast = (text: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 4000);
  };

  const fetchThreads = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.getForumThreads({
        ...(activeCategory !== 'all' ? { category: activeCategory } : {}),
        ...(selectedTeamFilter !== 'all' ? { teamId: selectedTeamFilter } : {}),
        ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
      });
      setThreads(sortThreads(res.threads || []));
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load discussions.');
    } finally {
      setLoading(false);
    }
    // searchQuery intentionally read at call time (submit-driven)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategory, selectedTeamFilter]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Lock page scroll while a sheet is open
  useEffect(() => {
    if (!selectedThread && !newThreadModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedThread, newThreadModalOpen]);

  const openThread = async (thread: ForumThread) => {
    setSelectedThread(thread);
    setThreadComments([]);
    setLoadingComments(true);
    try {
      const res = await api.getForumThreadDetail(thread.id);
      setSelectedThread(res.thread);
      setThreadComments(res.comments || []);
    } catch (e: any) {
      showToast(e?.message || 'Could not load this discussion.', 'err');
    } finally {
      setLoadingComments(false);
    }
  };

  const openNewThread = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setFormError(null);
    setNewThreadModalOpen(true);
  };

  const handleUpvoteThread = async (threadId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await api.upvoteForumThread(threadId);
      const patch = (t: ForumThread): ForumThread =>
        t.id === threadId
          ? {
              ...t,
              upvotes: res.upvotes,
              upvotedBy: res.upvoted ? [...(t.upvotedBy || []), user.id] : (t.upvotedBy || []).filter(id => id !== user.id),
            }
          : t;
      setThreads(prev => prev.map(patch));
      setSelectedThread(prev => (prev ? patch(prev) : prev));
    } catch (err: any) {
      showToast(err?.message || 'Could not upvote.', 'err');
    }
  };

  const handleUpvoteComment = async (commentId: string) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await api.upvoteForumComment(commentId);
      setThreadComments(prev =>
        prev.map(c =>
          c.id === commentId
            ? {
                ...c,
                upvotes: res.upvotes,
                upvotedBy: res.upvoted ? [...(c.upvotedBy || []), user.id] : (c.upvotedBy || []).filter(id => id !== user.id),
              }
            : c
        )
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not upvote.', 'err');
    }
  };

  const handleCreateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!selectedThread || !newCommentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await api.addForumComment(selectedThread.id, newCommentText.trim());
      setThreadComments(prev => [...prev, res.comment]);
      setNewCommentText('');
      if (res.thread) {
        setSelectedThread(res.thread);
        setThreads(prev => prev.map(t => (t.id === res.thread.id ? res.thread : t)));
      }
      if (onUserPointsAwarded && res.user) onUserPointsAwarded(res.user.points);
      showToast(res.pointsAdded ? `Reply posted · +${res.pointsAdded} points` : 'Reply posted');
    } catch (err: any) {
      showToast(err?.message || 'Could not post your reply.', 'err');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (newTitle.trim().length < 5) {
      setFormError('The title needs at least 5 characters.');
      return;
    }
    if (newContent.trim().length < 10) {
      setFormError('The post needs at least 10 characters.');
      return;
    }
    setFormError(null);
    setSubmittingThread(true);
    try {
      const tagList = newTags
        .split(',')
        .map(t => t.trim().replace(/^#/, ''))
        .filter(Boolean);
      const res = await api.createForumThread({
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        teamId: newTeamId || undefined,
        tags: tagList.length > 0 ? tagList : undefined,
      });
      setThreads(prev => sortThreads([res.thread, ...prev]));
      setNewThreadModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      setNewTeamId('');
      if (onUserPointsAwarded && res.user) onUserPointsAwarded(res.user.points);
      showToast(res.pointsAdded ? `Discussion posted · +${res.pointsAdded} points` : 'Discussion posted');
      openThread(res.thread);
    } catch (err: any) {
      setFormError(err?.message || 'Could not create the discussion.');
    } finally {
      setSubmittingThread(false);
    }
  };

  /* ---------------- Admin moderation ---------------- */

  const handlePin = async (thread: ForumThread, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await api.pinForumThread(thread.id, !thread.pinned);
      const updated = res.thread || { ...thread, pinned: !thread.pinned };
      setThreads(prev => sortThreads(prev.map(t => (t.id === thread.id ? { ...t, ...updated } : t))));
      setSelectedThread(prev => (prev && prev.id === thread.id ? { ...prev, ...updated } : prev));
      showToast(updated.pinned ? 'Thread pinned' : 'Thread unpinned');
    } catch (err: any) {
      showToast(err?.message || 'Could not update pin.', 'err');
    }
  };

  const handleDeleteThread = async (thread: ForumThread, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Delete "${thread.title}" and all its replies?`)) return;
    try {
      await api.deleteForumThread(thread.id);
      setThreads(prev => prev.filter(t => t.id !== thread.id));
      if (selectedThread?.id === thread.id) setSelectedThread(null);
      showToast('Thread deleted');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete thread.', 'err');
    }
  };

  const handleDeleteComment = async (comment: ForumComment) => {
    if (!window.confirm('Delete this reply?')) return;
    try {
      await api.deleteForumComment(comment.id);
      setThreadComments(prev => prev.filter(c => c.id !== comment.id));
      const dec = (t: ForumThread): ForumThread =>
        t.id === comment.threadId ? { ...t, commentsCount: Math.max(0, (t.commentsCount || 0) - 1) } : t;
      setThreads(prev => prev.map(dec));
      setSelectedThread(prev => (prev ? dec(prev) : prev));
      showToast('Reply deleted');
    } catch (err: any) {
      showToast(err?.message || 'Could not delete reply.', 'err');
    }
  };

  const adminThreadControls = (thread: ForumThread) =>
    isAdmin ? (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        <button
          onClick={e => handlePin(thread, e)}
          className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 flex items-center justify-center"
          aria-label={thread.pinned ? 'Unpin thread' : 'Pin thread'}
          title={thread.pinned ? 'Unpin' : 'Pin'}
        >
          {thread.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
        </button>
        <button
          onClick={e => handleDeleteThread(thread, e)}
          className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-red-500/20 border border-slate-700 hover:border-red-500/40 text-red-300 flex items-center justify-center"
          aria-label="Delete thread"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ) : null;

  const totalReplies = threads.reduce((acc, t) => acc + (t.commentsCount || 0), 0);
  const filtersActive = activeCategory !== 'all' || selectedTeamFilter !== 'all' || !!searchQuery.trim();

  return (
    <div className="space-y-5 sm:space-y-8">
      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[60] font-bold px-4 py-3 rounded-2xl shadow-2xl border flex items-center gap-2 text-sm ${
            toast.tone === 'ok'
              ? 'bg-amber-400 text-slate-950 border-amber-300'
              : 'bg-red-600 text-white border-red-400'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="min-w-0 break-words">{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 p-5 sm:p-8">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="max-w-2xl min-w-0">
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">Fan forum</h1>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">
              Talk tactics, squads, fantasy picks and match days with other fans.
            </p>
          </div>
          <button
            onClick={openNewThread}
            className="min-h-[44px] px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
            <span>New discussion</span>
          </button>
        </div>

        {!loading && threads.length > 0 && (
          <div className="relative z-10 grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-800/80 max-w-sm">
            <div>
              <span className="font-mono text-xl font-black text-white">{threads.length}</span>
              <p className="text-xs text-slate-400">{filtersActive ? 'Matching discussions' : 'Discussions'}</p>
            </div>
            <div>
              <span className="font-mono text-xl font-black text-amber-400">{totalReplies}</span>
              <p className="text-xs text-slate-400">Replies</p>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className={SCROLL_ROW} role="tablist" aria-label="Categories">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCategory(cat.id)}
                className={`min-h-[36px] shrink-0 flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap ${
                  active
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-400/40 hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          {teams.length > 0 && (
            <select
              value={selectedTeamFilter}
              onChange={e => setSelectedTeamFilter(e.target.value)}
              aria-label="Filter by team"
              className="min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl px-3 text-base sm:text-sm font-semibold text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="all">All teams</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <form
            onSubmit={e => {
              e.preventDefault();
              fetchThreads();
            }}
            className="relative flex-1 sm:max-w-sm"
            role="search"
          >
            <input
              type="search"
              placeholder="Search discussions"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="Search discussions"
              className="w-full min-h-[44px] bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </form>
        </div>
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="p-10 text-center text-slate-400 bg-slate-900/50 rounded-3xl border border-slate-800">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold">Loading discussions…</p>
        </div>
      ) : loadError ? (
        <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-red-500/30 space-y-3">
          <p className="text-sm text-red-300">{loadError}</p>
          <button onClick={fetchThreads} className="min-h-[44px] px-4 bg-slate-800 text-white text-sm font-bold rounded-xl">
            Try again
          </button>
        </div>
      ) : threads.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 space-y-3">
          <MessageSquare className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-white">{filtersActive ? 'No matching discussions' : 'No discussions yet'}</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            {filtersActive ? 'Try another category or search term, or start the conversation yourself.' : 'Be the first to start a conversation.'}
          </p>
          <button onClick={openNewThread} className="min-h-[44px] px-5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-black rounded-xl">
            Start a discussion
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map(thread => {
            const team = teams.find(t => t.id === thread.teamId);
            const isUpvoted = Boolean(user && thread.upvotedBy?.includes(user.id));
            return (
              <article
                key={thread.id}
                onClick={() => openThread(thread)}
                onKeyDown={e => {
                  if (e.key === 'Enter') openThread(thread);
                }}
                tabIndex={0}
                className={`group p-4 sm:p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-900 border cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0 ${
                  thread.pinned ? 'border-amber-500/40' : 'border-slate-800/80 hover:border-amber-400/40'
                }`}
              >
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {thread.pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold">
                      {CATEGORY_LABEL[thread.category] || thread.category}
                    </span>
                    {team && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                        {team.short || team.name}
                      </span>
                    )}
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(thread.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 break-words">{thread.title}</h3>
                  <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed break-words">{thread.content}</p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-400 min-w-0">
                    <Avatar name={thread.userName} src={thread.userAvatar} size={24} />
                    <span className="font-semibold text-slate-300 truncate max-w-[60%]">{thread.userName}</span>
                    {thread.userBadge && (
                      <span className="px-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{thread.userBadge}</span>
                    )}
                    {thread.tags?.slice(0, 3).map((tag, i) => (
                      <span key={i} className="hidden sm:inline text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                    <span className="flex items-center gap-1" title="Replies">
                      <MessageCircle className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-slate-200">{thread.commentsCount || 0}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Views">
                      <Eye className="w-4 h-4 text-slate-500" />
                      <span>{thread.views || 0}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {adminThreadControls(thread)}
                    <button
                      onClick={e => handleUpvoteThread(thread.id, e)}
                      aria-pressed={isUpvoted}
                      className={`min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 px-3 rounded-xl text-sm font-bold ${
                        isUpvoted
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                      }`}
                      title={isUpvoted ? 'Remove upvote' : 'Upvote'}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{thread.upvotes || 0}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ================= SHEET: THREAD DETAIL ================= */}
      {selectedThread && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setSelectedThread(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="thread-title"
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[100dvh] h-[100dvh] sm:h-auto sm:max-h-[90dvh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-3 bg-slate-950/60">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    {CATEGORY_LABEL[selectedThread.category] || selectedThread.category}
                  </span>
                  {selectedThread.pinned && (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-400 text-slate-950">Pinned</span>
                  )}
                  <span className="text-xs text-slate-500">{new Date(selectedThread.createdAt).toLocaleDateString()}</span>
                </div>
                <h2 id="thread-title" className="text-lg sm:text-2xl font-black text-white break-words">
                  {selectedThread.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedThread(null)}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 overscroll-contain">
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={selectedThread.userName} src={selectedThread.userAvatar} size={40} />
                  <div className="min-w-0">
                    <span className="font-bold text-sm text-white block truncate">{selectedThread.userName}</span>
                    {selectedThread.userBadge && <span className="text-xs text-amber-400">{selectedThread.userBadge}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {adminThreadControls(selectedThread)}
                  <button
                    onClick={() => handleUpvoteThread(selectedThread.id)}
                    className={`min-h-[44px] flex items-center gap-1.5 px-3 rounded-xl text-sm font-bold ${
                      user && selectedThread.upvotedBy?.includes(user.id)
                        ? 'bg-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span>{selectedThread.upvotes || 0}</span>
                  </button>
                </div>
              </div>

              <div className="text-sm text-slate-200 leading-relaxed space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <p className="whitespace-pre-line break-words">{selectedThread.content}</p>
                {selectedThread.tags?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    {selectedThread.tags.map((t, idx) => (
                      <span key={idx} className="text-xs font-semibold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-amber-400" /> Replies ({threadComments.length})
                </h4>

                {loadingComments ? (
                  <p className="py-6 text-center text-sm text-slate-500">Loading replies…</p>
                ) : threadComments.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
                    <p className="text-sm text-slate-400">No replies yet. Share your thoughts below.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {threadComments.map(comment => {
                      const isUpvoted = Boolean(user && comment.upvotedBy?.includes(user.id));
                      const commentTeam = teams.find(t => t.id === comment.teamId);
                      return (
                        <div key={comment.id} className="p-3 sm:p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2 min-w-0">
                              <Avatar name={comment.userName} src={comment.userAvatar} size={28} />
                              <span className="font-bold text-sm text-white truncate max-w-[10rem]">{comment.userName}</span>
                              {comment.userBadge && (
                                <span className="text-xs px-1.5 rounded bg-slate-800 text-amber-300">{comment.userBadge}</span>
                              )}
                              {commentTeam && (
                                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: commentTeam.color }} />
                                  {commentTeam.short || commentTeam.name}
                                </span>
                              )}
                              <span className="text-xs text-slate-500">
                                {new Date(comment.createdAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteComment(comment)}
                                  className="w-9 h-9 rounded-lg bg-slate-800 hover:bg-red-500/20 text-red-300 flex items-center justify-center"
                                  aria-label="Delete reply"
                                  title="Delete reply"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleUpvoteComment(comment.id)}
                                aria-pressed={isUpvoted}
                                className={`h-9 min-w-[44px] flex items-center justify-center gap-1 px-2 rounded-lg text-xs font-bold ${
                                  isUpvoted ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300 hover:text-white'
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                                <span>{comment.upvotes || 0}</span>
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed break-words whitespace-pre-line">{comment.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div
              className="p-3 sm:p-5 border-t border-slate-800 bg-slate-950/80"
              style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
              {user ? (
                <form onSubmit={handleCreateComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a reply…"
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    aria-label="Write a reply"
                    className="flex-1 min-w-0 min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3.5 text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newCommentText.trim()}
                    className="min-h-[44px] px-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-sm rounded-xl flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                    aria-label="Send reply"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">{submittingComment ? 'Sending…' : 'Reply'}</span>
                  </button>
                </form>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-sm">
                  <span className="text-slate-400">Sign in to reply.</span>
                  <button onClick={onOpenAuth} className="min-h-[44px] px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl">
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= SHEET: NEW THREAD ================= */}
      {newThreadModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setNewThreadModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-thread-title"
        >
          <div
            className="bg-slate-900 border border-slate-800 sm:border-amber-500/30 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-xl overflow-hidden shadow-2xl max-h-[100dvh] sm:max-h-[92dvh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between gap-3">
              <h3 id="new-thread-title" className="text-lg font-black text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" /> New discussion
              </h3>
              <button
                onClick={() => setNewThreadModalOpen(false)}
                className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="flex flex-col flex-1 min-h-0">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                <div>
                  <label htmlFor="nt-title" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Title
                  </label>
                  <input
                    id="nt-title"
                    type="text"
                    placeholder="What do you want to talk about?"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    maxLength={140}
                    className={INPUT}
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1">{newTitle.length}/140</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="nt-cat" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                      Category
                    </label>
                    <select id="nt-cat" value={newCategory} onChange={e => setNewCategory(e.target.value as Category)} className={INPUT}>
                      {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {teams.length > 0 && (
                    <div>
                      <label htmlFor="nt-team" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                        Team (optional)
                      </label>
                      <select id="nt-team" value={newTeamId} onChange={e => setNewTeamId(e.target.value)} className={INPUT}>
                        <option value="">No specific team</option>
                        {teams.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="nt-body" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Post
                  </label>
                  <textarea
                    id="nt-body"
                    rows={5}
                    placeholder="Share your view, analysis or question…"
                    value={newContent}
                    onChange={e => setNewContent(e.target.value)}
                    className={`${INPUT} leading-relaxed`}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="nt-tags" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Tags (comma separated, optional)
                  </label>
                  <input
                    id="nt-tags"
                    type="text"
                    placeholder="e.g. powerplay, fantasy"
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    className={INPUT}
                  />
                </div>

                {formError && (
                  <p role="alert" className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                    {formError}
                  </p>
                )}
              </div>

              <div
                className="p-4 sm:p-6 border-t border-slate-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                <button
                  type="button"
                  onClick={() => setNewThreadModalOpen(false)}
                  className="min-h-[44px] px-4 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 sm:bg-transparent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingThread}
                  className="min-h-[44px] px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submittingThread ? 'Publishing…' : 'Publish'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
