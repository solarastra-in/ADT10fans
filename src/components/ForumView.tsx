import React, { useState, useEffect } from 'react';
import { User, Team, ForumThread, ForumComment } from '../types';
import { api } from '../api';
import { 
  MessageSquare, 
  MessageCircle, 
  ThumbsUp, 
  Plus, 
  Search, 
  Filter, 
  Pin, 
  Flame, 
  Sparkles, 
  Calendar, 
  Share2, 
  Trophy, 
  CheckCircle2, 
  Send, 
  X, 
  Tag, 
  ArrowLeft,
  Eye,
  Clock,
  Award
} from 'lucide-react';

interface ForumViewProps {
  user: User | null;
  teams: Team[];
  onOpenAuth: () => void;
  onUserPointsAwarded?: (newPoints: number) => void;
  onNavigateToProposal?: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'All Discussions', icon: MessageSquare },
  { id: 'matchday', label: '🔥 Match Day Live', icon: Flame },
  { id: 'tactics', label: '🏏 Tactics & Squads', icon: Trophy },
  { id: 'fantasy', label: '⭐ Dream Team & Fantasy', icon: Sparkles },
  { id: 'fanspaces', label: '🌍 Global Fan Spaces', icon: Calendar },
  { id: 'giveaways', label: '🎁 Giveaways & Rewards', icon: Award },
  { id: 'franchises', label: '🦅 Franchises & Teams', icon: Share2 },
  { id: 'general', label: '💬 General Buzz', icon: MessageCircle },
];

export const ForumView: React.FC<ForumViewProps> = ({
  user,
  teams,
  onOpenAuth,
  onUserPointsAwarded,
  onNavigateToProposal
}) => {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected thread modal
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [threadComments, setThreadComments] = useState<ForumComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // New Thread modal
  const [newThreadModalOpen, setNewThreadModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'matchday' | 'tactics' | 'franchises' | 'fantasy' | 'fanspaces' | 'giveaways' | 'general'>('matchday');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [submittingThread, setSubmittingThread] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 4000);
  };

  const fetchThreads = async () => {
    setLoading(true);
    try {
      const res = await api.getForumThreads({
        category: activeCategory !== 'all' ? activeCategory : undefined,
        teamId: selectedTeamFilter !== 'all' ? selectedTeamFilter : undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
      });
      setThreads(res.threads || []);
    } catch (e) {
      console.error('Error fetching forum threads:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, [activeCategory, selectedTeamFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchThreads();
  };

  const openThread = async (thread: ForumThread) => {
    setSelectedThread(thread);
    setLoadingComments(true);
    try {
      const res = await api.getForumThreadDetail(thread.id);
      setSelectedThread(res.thread);
      setThreadComments(res.comments || []);
    } catch (e) {
      console.error('Error loading thread details:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleUpvoteThread = async (threadId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      const res = await api.upvoteForumThread(threadId);
      setThreads(prev =>
        prev.map(t =>
          t.id === threadId
            ? {
                ...t,
                upvotes: res.upvotes,
                upvotedBy: res.upvoted
                  ? [...(t.upvotedBy || []), user.id]
                  : (t.upvotedBy || []).filter(id => id !== user.id),
              }
            : t
        )
      );
      if (selectedThread && selectedThread.id === threadId) {
        setSelectedThread(prev => prev ? { ...prev, upvotes: res.upvotes } : null);
      }
    } catch (e: any) {
      alert(e?.message || 'Error upvoting');
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
                upvotedBy: res.upvoted
                  ? [...(c.upvotedBy || []), user.id]
                  : (c.upvotedBy || []).filter(id => id !== user.id),
              }
            : c
        )
      );
    } catch (e: any) {
      alert(e?.message || 'Error upvoting comment');
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
      setSelectedThread(res.thread);
      setThreads(prev => prev.map(t => t.id === res.thread.id ? res.thread : t));
      if (onUserPointsAwarded && res.user) {
        onUserPointsAwarded(res.user.points);
      }
      showToast('🎉 Reply posted! +5 Fan Points added to your account.');
    } catch (e: any) {
      alert(e?.message || 'Error adding comment');
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
      alert('Thread title must be at least 5 characters');
      return;
    }
    if (newContent.trim().length < 10) {
      alert('Thread content must be at least 10 characters');
      return;
    }

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

      setThreads(prev => [res.thread, ...prev]);
      setNewThreadModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      if (onUserPointsAwarded && res.user) {
        onUserPointsAwarded(res.user.points);
      }
      showToast('🔥 Discussion thread opened! +15 Fan Points awarded.');
      openThread(res.thread);
    } catch (e: any) {
      alert(e?.message || 'Error creating thread');
    } finally {
      setSubmittingThread(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-20 right-6 z-50 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold px-4 py-3 rounded-2xl shadow-2xl border border-amber-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span className="text-xs sm:text-sm">{feedbackToast}</span>
        </div>
      )}

      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-black uppercase tracking-wider mb-3">
              <MessageSquare className="w-3.5 h-3.5 fill-amber-400" />
              <span>ADT10 Fan Commons · Open Real-Time Discourse</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              Abu Dhabi T10 <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">Discussion Forum</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              Connect with global fans, debate squad selections, dissect ball-by-ball masterclasses, discuss physical Fan Spaces, and share your Dream Team combinations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                if (user) setNewThreadModalOpen(true);
                else onOpenAuth();
              }}
              className="px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Open New Thread (+15 pts)</span>
            </button>

            {onNavigateToProposal && (
              <button
                onClick={onNavigateToProposal}
                className="px-4 py-3 bg-slate-950/80 hover:bg-slate-800 text-amber-300 font-bold text-xs sm:text-sm rounded-xl border border-amber-500/40 flex items-center gap-2 transition-colors"
                title="View the comprehensive League Expansion Proposal"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Read League Proposal</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Strip */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80 text-xs">
          <div>
            <span className="font-mono text-xl font-black text-white">{threads.length}</span>
            <p className="text-slate-400 font-medium">Active Discussions</p>
          </div>
          <div>
            <span className="font-mono text-xl font-black text-amber-400">
              {threads.reduce((acc, t) => acc + (t.commentsCount || 0), 0)}
            </span>
            <p className="text-slate-400 font-medium">Fan Comments & Debates</p>
          </div>
          <div>
            <span className="font-mono text-xl font-black text-emerald-400">9</span>
            <p className="text-slate-400 font-medium">Franchise Fan Clubs</p>
          </div>
          <div>
            <span className="font-mono text-xl font-black text-amber-300">+15 / +5</span>
            <p className="text-slate-400 font-medium">Points per Thread / Reply</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Categories scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-amber-400/40 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-slate-950' : 'text-amber-400'}`} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search & Team Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          <select
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-amber-400"
          >
            <option value="all">All Franchises</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search topics, tags, players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
          </form>
        </div>
      </div>

      {/* Main Threads List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 bg-slate-900/50 rounded-3xl border border-slate-800">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin mx-auto mb-3"></div>
          <p className="text-xs font-bold">Loading live fan discussions...</p>
        </div>
      ) : threads.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-dashed border-slate-800 space-y-3">
          <MessageSquare className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No discussions found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Be the first fan to open a thread on this topic and earn +15 fan points!
          </p>
          <button
            onClick={() => {
              if (user) setNewThreadModalOpen(true);
              else onOpenAuth();
            }}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black rounded-xl"
          >
            Open First Thread
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {threads.map(thread => {
            const team = teams.find(t => t.id === thread.teamId);
            const isUpvoted = Boolean(user && thread.upvotedBy?.includes(user.id));

            return (
              <div
                key={thread.id}
                onClick={() => openThread(thread)}
                className={`group p-5 rounded-2xl bg-slate-900/90 hover:bg-slate-900 border transition-all cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  thread.pinned 
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-slate-900 to-slate-900' 
                    : 'border-slate-800/80 hover:border-amber-400/40'
                }`}
              >
                {/* Left content */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {thread.pinned && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 uppercase text-[10px]">
                        <Pin className="w-3 h-3 fill-amber-400" /> Pinned
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold uppercase text-[10px]">
                      {thread.category}
                    </span>
                    {team && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-slate-300 font-semibold text-[11px]">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }}></span>
                        {team.short}
                      </span>
                    )}
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(thread.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition-colors">
                    {thread.title}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {thread.content}
                  </p>

                  {/* Author & tags */}
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                      <img
                        src={thread.userAvatar}
                        alt={thread.userName}
                        className="w-5 h-5 rounded-full object-cover ring-1 ring-amber-400/30"
                      />
                      <span className="font-semibold text-slate-300">{thread.userName}</span>
                      {thread.userBadge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {thread.userBadge}
                        </span>
                      )}
                    </div>

                    {thread.tags && thread.tags.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5">
                        {thread.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-[10px] text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right stats & action */}
                <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                    <div className="flex items-center gap-1" title="Comments">
                      <MessageCircle className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-slate-200">{thread.commentsCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1" title="Views">
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>{thread.views || 1}</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleUpvoteThread(thread.id, e)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isUpvoted
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
                    }`}
                    title={isUpvoted ? 'Remove upvote' : 'Upvote discussion'}
                  >
                    <ThumbsUp className={`w-3.5 h-3.5 ${isUpvoted ? 'fill-slate-950' : ''}`} />
                    <span>{thread.upvotes || 0}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ================= MODAL: THREAD DETAIL & COMMENTS ================= */}
      {selectedThread && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-8 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/60">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400/10 text-amber-400 border border-amber-400/20">
                    {selectedThread.category}
                  </span>
                  {selectedThread.pinned && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400 text-slate-950">
                      Pinned
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    Posted {new Date(selectedThread.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  {selectedThread.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedThread(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Thread Description & Comments */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {/* Author bar */}
              <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedThread.userAvatar}
                    alt={selectedThread.userName}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-amber-400/40"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{selectedThread.userName}</span>
                      {selectedThread.userBadge && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 font-semibold border border-amber-500/30">
                          {selectedThread.userBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">League Superfan Member</p>
                  </div>
                </div>

                <button
                  onClick={() => handleUpvoteThread(selectedThread.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    user && selectedThread.upvotedBy?.includes(user.id)
                      ? 'bg-amber-400 text-slate-950 font-black'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>{selectedThread.upvotes || 0} Upvotes</span>
                </button>
              </div>

              {/* Thread Content */}
              <div className="text-sm text-slate-200 leading-relaxed space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                <p className="whitespace-pre-line">{selectedThread.content}</p>

                {selectedThread.tags && selectedThread.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    {selectedThread.tags.map((t, idx) => (
                      <span key={idx} className="text-[11px] font-semibold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-md">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-amber-400" />
                    <span>Fan Replies ({threadComments.length})</span>
                  </h4>
                  <span className="text-[11px] text-amber-400 font-semibold">
                    Earn +5 pts per reply
                  </span>
                </div>

                {loadingComments ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    Loading replies...
                  </div>
                ) : threadComments.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
                    <p className="text-xs text-slate-400">No replies yet. Be the first to share your thoughts!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {threadComments.map(comment => {
                      const isUpvoted = Boolean(user && comment.upvotedBy?.includes(user.id));
                      const commentTeam = teams.find(t => t.id === comment.teamId);

                      return (
                        <div
                          key={comment.id}
                          className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <img
                                src={comment.userAvatar}
                                alt={comment.userName}
                                className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-700"
                              />
                              <span className="font-bold text-xs text-white">{comment.userName}</span>
                              {comment.userBadge && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-amber-300">
                                  {comment.userBadge}
                                </span>
                              )}
                              {commentTeam && (
                                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: commentTeam.color }} />
                                  {commentTeam.short}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500">
                                {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <button
                                onClick={() => handleUpvoteComment(comment.id)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                                  isUpvoted ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                <span>{comment.upvotes || 0}</span>
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed pl-8">
                            {comment.content}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Input Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80">
              {user ? (
                <form onSubmit={handleCreateComment} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a constructive reply to join this debate..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !newCommentText.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingComment ? 'Sending...' : 'Reply (+5)'}</span>
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                  <span className="text-slate-400">Sign in to join this thread and earn fan points.</span>
                  <button
                    onClick={onOpenAuth}
                    className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg"
                  >
                    Sign In to Reply
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE NEW THREAD ================= */}
      {newThreadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl sm:rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Start New Discussion</h3>
                  <p className="text-xs text-amber-400">Earn +15 Fan Points for opening a thread</p>
                </div>
              </div>
              <button
                onClick={() => setNewThreadModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateThread} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Thread Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tactical preview for Match 1: Who should open with Alex Hales?"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={140}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-1">{newTitle.length}/140 characters</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Category *
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e: any) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="matchday">🔥 Match Day Live</option>
                    <option value="tactics">🏏 Tactics & Squads</option>
                    <option value="fantasy">⭐ Dream Team & Fantasy</option>
                    <option value="fanspaces">🌍 Global Fan Spaces</option>
                    <option value="giveaways">🎁 Giveaways & Rewards</option>
                    <option value="franchises">🦅 Franchises & Teams</option>
                    <option value="general">💬 General Buzz</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Franchise Tag (Optional)
                  </label>
                  <select
                    value={newTeamId}
                    onChange={(e) => setNewTeamId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="">General League Wide</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Discussion Content *
                </label>
                <textarea
                  rows={4}
                  placeholder="Share your opinions, analysis, match predictions or proposal thoughts..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 leading-relaxed"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. ArabianAces, MoeenAli, FinalOvers, Sixes"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNewThreadModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingThread}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>{submittingThread ? 'Publishing...' : 'Publish Thread (+15 pts)'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
