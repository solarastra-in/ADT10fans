import React, { useState } from 'react';
import { NotificationItem, Match, Contest } from '../types';
import { api } from '../api';
import { 
  Bell, 
  CheckCheck, 
  Trophy, 
  Clock, 
  ExternalLink, 
  X, 
  ShieldCheck, 
  Radio, 
  Sparkles, 
  ChevronRight, 
  Code2, 
  Flame, 
  Info,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  unreadCount: number;
  fcmStatus: 'granted' | 'denied' | 'default' | 'unsupported';
  onRequestPermission: () => Promise<void>;
  onNotificationClick: (notif: NotificationItem) => void;
  onMarkAllRead: () => Promise<void>;
  selectedNotification: NotificationItem | null;
  onCloseDetail: () => void;
  onNavigateTab: (tab: string) => void;
}

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  fcmStatus,
  onRequestPermission,
  onNotificationClick,
  onMarkAllRead,
  selectedNotification,
  onCloseDetail,
  onNavigateTab,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [detailTab, setDetailTab] = useState<'overview' | 'api_details'>('overview');
  const [copiedCurl, setCopiedCurl] = useState(false);

  if (!isOpen && !selectedNotification) return null;

  const filteredNotifications = notifications.filter(n => {
    if (filterCategory === 'all') return true;
    return n.category === filterCategory;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'match_result':
        return {
          label: 'Match Result',
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          icon: Trophy,
        };
      case 'contest_deadline':
        return {
          label: 'Contest Deadline',
          color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          icon: Clock,
        };
      case 'perk':
        return {
          label: 'Exclusive Perk',
          color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          icon: Sparkles,
        };
      default:
        return {
          label: 'Official Alert',
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          icon: Radio,
        };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  return (
    <>
      {/* 1. NOTIFICATION CENTER DRAWER / OVERLAY */}
      {isOpen && !selectedNotification && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div 
            className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col justify-between overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white flex items-center gap-2">
                      FCM Alerts & Inbox
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950">
                          {unreadCount} new
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Real-time match results & contest lock warnings
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* FCM Web Push Permission Banner */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${fcmStatus === 'granted' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-slate-300 font-semibold">
                    {fcmStatus === 'granted' ? 'FCM Web Push Active' : 'Push Alerts Disabled'}
                  </span>
                </div>
                {fcmStatus !== 'granted' && (
                  <button
                    onClick={onRequestPermission}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition-transform active:scale-95"
                  >
                    Enable Push
                  </button>
                )}
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 mt-3 overflow-x-auto no-scrollbar text-xs">
                {[
                  { id: 'all', label: 'All Alerts' },
                  { id: 'match_result', label: '🏆 Results' },
                  { id: 'contest_deadline', label: '⏳ Deadlines' },
                  { id: 'announcement', label: '📢 League' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg whitespace-nowrap font-bold transition-all ${
                      filterCategory === cat.id
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <Bell className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-300">No notifications in this view</p>
                  <p className="text-xs text-slate-500 mt-1">
                    When match results or contest deadlines approach, you will receive instant real-time alerts.
                  </p>
                </div>
              ) : (
                filteredNotifications.map(item => {
                  const badge = getCategoryBadge(item.category);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onNotificationClick(item)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                        item.read 
                          ? 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700' 
                          : 'bg-slate-950 border-amber-500/40 shadow-md shadow-amber-500/5 hover:border-amber-400'
                      }`}
                    >
                      {!item.read && (
                        <span className="absolute top-3.5 right-3 w-2 h-2 rounded-full bg-amber-400 ring-4 ring-amber-400/20" />
                      )}

                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-black uppercase flex items-center gap-1 ${badge.color}`}>
                          <Icon className="w-3 h-3" /> {badge.label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug group-hover:text-amber-300 transition-colors pr-4">
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {item.body}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-amber-400/80 group-hover:text-amber-300 font-bold">
                        <span>Click to view event scorecard & details</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 text-xs">
              <button
                onClick={onMarkAllRead}
                disabled={notifications.length === 0}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Mark All Read</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onNavigateTab('admin');
                }}
                className="text-slate-400 hover:text-amber-400 text-xs font-semibold flex items-center gap-1"
              >
                <span>Admin FCM Dispatch</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. RICH NOTIFICATION DETAIL MODAL (How to get notification details) */}
      {selectedNotification && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
          onClick={onCloseDetail}
        >
          <div 
            className="w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  {selectedNotification.category === 'match_result' ? (
                    <Trophy className="w-5 h-5 text-amber-400" />
                  ) : selectedNotification.category === 'contest_deadline' ? (
                    <Clock className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Radio className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getCategoryBadge(selectedNotification.category).color}`}>
                      {getCategoryBadge(selectedNotification.category).label}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {new Date(selectedNotification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white mt-0.5">
                    Notification Event Details
                  </h3>
                </div>
              </div>

              <button
                onClick={onCloseDetail}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Detail Tabs */}
            <div className="flex items-center border-b border-slate-800 px-5 bg-slate-950/40 text-xs font-bold">
              <button
                onClick={() => setDetailTab('overview')}
                className={`py-2.5 px-3 border-b-2 transition-colors ${
                  detailTab === 'overview'
                    ? 'border-amber-400 text-amber-400 font-black'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Event Summary & Scorecard
              </button>
              <button
                onClick={() => setDetailTab('api_details')}
                className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                  detailTab === 'api_details'
                    ? 'border-amber-400 text-amber-400 font-black'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>API & FCM Payload</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {detailTab === 'overview' ? (
                <>
                  <div>
                    <h2 className="text-lg font-black text-white leading-snug">
                      {selectedNotification.title}
                    </h2>
                    <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                      {selectedNotification.body}
                    </p>
                  </div>

                  {/* Match Result Rich Card */}
                  {selectedNotification.category === 'match_result' && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Official Abu Dhabi T10 Match Result
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {selectedNotification.data?.matchId || 'm-live'}
                        </span>
                      </div>

                      {selectedNotification.data?.scoreSummary && (
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Scoreboard Summary
                          </span>
                          <div className="text-sm font-mono font-bold text-amber-300">
                            {selectedNotification.data.scoreSummary}
                          </div>
                        </div>
                      )}

                      {selectedNotification.data?.topScorer && (
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <span className="text-amber-400 font-bold">Top Performer:</span>
                          <span>{selectedNotification.data.topScorer}</span>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          onCloseDetail();
                          onClose();
                          onNavigateTab('matches');
                        }}
                        className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-transform"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Open Live Match Center</span>
                      </button>
                    </div>
                  )}

                  {/* Contest Deadline Rich Card */}
                  {selectedNotification.category === 'contest_deadline' && (
                    <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/30 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-amber-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> Approaching Submission Deadline
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {selectedNotification.data?.contestId || 'c-01'}
                        </span>
                      </div>

                      {selectedNotification.data?.prize && (
                        <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Prize at Stake
                          </span>
                          <div className="text-sm font-extrabold text-amber-300">
                            {selectedNotification.data.prize}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          onCloseDetail();
                          onClose();
                          onNavigateTab('contests');
                        }}
                        className="w-full py-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 hover:scale-[1.01] transition-transform"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Submit Contest Picks Now</span>
                      </button>
                    </div>
                  )}

                  {/* Metadata strip */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Dispatched By</span>
                      <span className="font-bold text-white mt-0.5 block">{selectedNotification.createdBy}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Audience</span>
                      <span className="font-bold text-amber-300 mt-0.5 block capitalize">
                        {selectedNotification.targetAudience === 'logged_in' ? 'Logged-In Fans' : selectedNotification.targetAudience}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                /* TAB 2: API & HOW TO GET NOTIFICATION DETAILS */
                <div className="space-y-4 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-amber-400 text-xs">
                        How to Retrieve Notification Details via API:
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`curl -X GET "${window.location.origin}/api/notifications/${selectedNotification.id}"`);
                          setCopiedCurl(true);
                          setTimeout(() => setCopiedCurl(false), 2000);
                        }}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        {copiedCurl ? '✓ Copied' : 'Copy cURL'}
                      </button>
                    </div>
                    <code className="text-[11px] font-mono text-emerald-300 block bg-slate-900 p-2 rounded overflow-x-auto">
                      GET /api/notifications/{selectedNotification.id}
                    </code>
                  </div>

                  <div>
                    <span className="font-bold text-slate-400 block mb-1">
                      Full FCM WebPush & Database Record:
                    </span>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-200/90 overflow-x-auto max-h-56">
                      {JSON.stringify(selectedNotification, null, 2)}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <p className="font-bold text-white">Client-side SDK Listener Pattern:</p>
                    <code className="text-emerald-400 block font-mono">
                      {"firebase.messaging().onMessage((payload) => { ... });"}
                    </code>
                    <p>Background alerts are routed via <span className="font-mono text-slate-300">/firebase-messaging-sw.js</span> onBackgroundMessage.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-3">
              <button
                onClick={onCloseDetail}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
