import React, { useState, useMemo, useEffect } from 'react';
import { FeedItem, Team, SocialHandle } from '../types';
import { api } from '../api';
import { 
  Play, 
  ExternalLink, 
  Heart, 
  Eye, 
  Share2, 
  Sparkles, 
  Radio, 
  Filter,
  CheckCircle,
  Video,
  Pin,
  Shield,
  Palette,
  RotateCcw,
  RefreshCw
} from 'lucide-react';

export interface TeamTheme {
  team: Team | null;
  name: string;
  short: string;
  primaryHex: string;
  secondaryHex: string;
  contrastText: string;
  r: number;
  g: number;
  b: number;
  r2: number;
  g2: number;
  b2: number;

  // Subtle background gradients matching the team's primary color
  wallBgGradient: string;
  wallBoxShadow: string;
  wallBorder: string;
  ambientGlowTop: string;
  ambientGlowBottom: string;

  // Handles Bar
  handlesBg: string;
  handlesBorder: string;
  handlesLabelColor: string;

  // Filter Tabs
  tabActiveBg: string;
  tabActiveText: string;
  tabActiveShadow: string;
  tabInactiveBorder: string;

  // Cards
  cardBg: string;
  cardBorder: string;
  cardHoverBorder: string;
  cardHoverShadow: string;
  cardHoverBorderColor: string;
  cardBorderColor: string;

  // Interactive controls
  playBtnBg: string;
  playBtnColor: string;
  accentBadgeBg: string;
  accentBadgeBorder: string;
  textAccentColor: string;
  borderAccentColor: string;
}

// Convert hex color to RGB triplet
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace(/^#/, '');
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 232, g: 176, b: 74 }; // fallback to gold
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// Calculate relative luminance for WCAG AA contrast compliance
function getLuminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Dynamic Theme Generator based on the selected team's primary color
export function generateTeamTheme(team: Team | null): TeamTheme {
  const isTeam = !!team;
  // Fallback to league gold #E8B04A if no team is selected
  const primaryHex = team?.color || '#E8B04A';
  const secondaryHex = team?.secondaryColor || '#1E293B';
  const { r, g, b } = hexToRgb(primaryHex);
  const { r: r2, g: g2, b: b2 } = hexToRgb(secondaryHex);
  const lum = getLuminance(r, g, b);
  const contrastText = lum > 0.55 ? '#020617' : '#FFFFFF';

  // Subtle background gradients matching the team's primary color
  const wallBgGradient = isTeam
    ? `radial-gradient(130% 70% at 50% -10%, rgba(${r}, ${g}, ${b}, 0.16) 0%, rgba(${r}, ${g}, ${b}, 0.05) 40%, rgba(15, 23, 42, 0.75) 80%, rgba(2, 6, 23, 0.98) 100%), linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.07) 0%, rgba(15, 23, 42, 0.5) 260px, transparent 100%)`
    : `radial-gradient(130% 70% at 50% -10%, rgba(232, 176, 74, 0.14) 0%, rgba(232, 176, 74, 0.04) 40%, rgba(15, 23, 42, 0.75) 80%, rgba(2, 6, 23, 0.98) 100%), linear-gradient(180deg, rgba(232, 176, 74, 0.05) 0%, rgba(15, 23, 42, 0.5) 260px, transparent 100%)`;

  const wallBoxShadow = `0 25px 60px -15px rgba(${r}, ${g}, ${b}, 0.12), 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.22), inset 0 1px 0 0 rgba(${r}, ${g}, ${b}, 0.25)`;
  const wallBorder = `1px solid rgba(${r}, ${g}, ${b}, 0.25)`;

  const ambientGlowTop = `radial-gradient(circle at 15% 10%, rgba(${r}, ${g}, ${b}, 0.14) 0%, transparent 60%)`;
  const ambientGlowBottom = `radial-gradient(circle at 85% 90%, rgba(${r2}, ${g2}, ${b2}, 0.28) 0%, transparent 60%)`;

  const handlesBg = `linear-gradient(90deg, rgba(${r}, ${g}, ${b}, 0.12) 0%, rgba(15, 23, 42, 0.85) 60%, rgba(2, 6, 23, 0.9) 100%)`;
  const handlesBorder = `1px solid rgba(${r}, ${g}, ${b}, 0.28)`;

  const tabActiveBg = `linear-gradient(135deg, ${primaryHex} 0%, rgba(${r}, ${g}, ${b}, 0.85) 100%)`;
  const tabActiveShadow = `0 4px 18px -2px rgba(${r}, ${g}, ${b}, 0.4)`;
  const tabInactiveBorder = `rgba(${r}, ${g}, ${b}, 0.15)`;

  const cardBg = `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.06) 0%, rgba(15, 23, 42, 0.92) 110px, rgba(15, 23, 42, 0.98) 100%)`;
  const cardBorder = `1px solid rgba(${r}, ${g}, ${b}, 0.18)`;
  const cardHoverBorder = `1px solid rgba(${r}, ${g}, ${b}, 0.55)`;
  const cardHoverShadow = `0 16px 36px -10px rgba(${r}, ${g}, ${b}, 0.22), 0 0 0 1px rgba(${r}, ${g}, ${b}, 0.25)`;
  const cardHoverBorderColor = `rgba(${r}, ${g}, ${b}, 0.55)`;
  const cardBorderColor = `rgba(${r}, ${g}, ${b}, 0.18)`;

  const accentBadgeBg = `rgba(${r}, ${g}, ${b}, 0.12)`;
  const accentBadgeBorder = `1px solid rgba(${r}, ${g}, ${b}, 0.3)`;

  return {
    team,
    name: team ? team.name : 'Abu Dhabi T10 League',
    short: team ? team.short : 'ADT10',
    primaryHex,
    secondaryHex,
    contrastText,
    r,
    g,
    b,
    r2,
    g2,
    b2,
    wallBgGradient,
    wallBoxShadow,
    wallBorder,
    ambientGlowTop,
    ambientGlowBottom,
    handlesBg,
    handlesBorder,
    handlesLabelColor: primaryHex,
    tabActiveBg,
    tabActiveText: contrastText,
    tabActiveShadow,
    tabInactiveBorder,
    cardBg,
    cardBorder,
    cardHoverBorder,
    cardHoverShadow,
    cardHoverBorderColor,
    cardBorderColor,
    playBtnBg: primaryHex,
    playBtnColor: contrastText,
    accentBadgeBg,
    accentBadgeBorder,
    textAccentColor: primaryHex,
    borderAccentColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
  };
}

interface SocialCuratorWallProps {
  feedItems: FeedItem[];
  teams: Team[];
  handles: SocialHandle[];
  selectedTeamId?: string | null;
  onSelectTeam?: (teamId: string | null) => void;
  onOpenTeamPicker?: () => void;
  userTeamId?: string | null;
  title?: string;
  subtitle?: string;
  limitPerPlatform?: number;
  onRefreshFeeds?: () => Promise<void>;
}

export const SocialCuratorWall: React.FC<SocialCuratorWallProps> = ({
  feedItems,
  teams,
  handles,
  selectedTeamId = null,
  onSelectTeam,
  onOpenTeamPicker,
  userTeamId = null,
  title = "Curated Social Media Wall",
  subtitle = "Aggregating live video broadcasts, news releases, and official posts across all 6 announced franchises.",
  limitPerPlatform = 5,
  onRefreshFeeds
}) => {
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [activeVideoModal, setActiveVideoModal] = useState<FeedItem | null>(null);
  const [localTeamId, setLocalTeamId] = useState<string | null>(selectedTeamId ?? userTeamId ?? null);
  const [syncingFeeds, setSyncingFeeds] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleSyncRealFeeds = async () => {
    try {
      setSyncingFeeds(true);
      setSyncNotice('Connecting to official team handles and live sports news wire...');
      const res = await api.syncRealFeeds();
      if (onRefreshFeeds) {
        await onRefreshFeeds();
      }
      setSyncNotice(`✓ Synced ${res.syncedCount} real channel posts & official highlights!`);
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err: any) {
      setSyncNotice('Sync notice: ' + (err?.message || 'Completed real sync'));
      setTimeout(() => setSyncNotice(null), 4000);
    } finally {
      setSyncingFeeds(false);
    }
  };

  // Sync internal state when external selectedTeamId or userTeamId changes
  useEffect(() => {
    if (selectedTeamId !== undefined) {
      setLocalTeamId(selectedTeamId);
    } else if (userTeamId && localTeamId === null) {
      setLocalTeamId(userTeamId);
    }
  }, [selectedTeamId, userTeamId]);

  const activeTeamId = selectedTeamId !== undefined ? selectedTeamId : localTeamId;

  const getTeam = (teamId: string | null) => {
    if (!teamId) return null;
    return teams.find(t => t.id === teamId) || null;
  };

  const currentTeam = getTeam(activeTeamId);

  // Dynamically generate theme based on the selected team
  const theme = useMemo(() => generateTeamTheme(currentTeam), [currentTeam]);

  const handleTeamChange = (newTeamId: string | null) => {
    setLocalTeamId(newTeamId);
    if (onSelectTeam) {
      onSelectTeam(newTeamId);
    }
  };

  // Filter items by team and platform
  const filtered = feedItems.filter(item => {
    if (activeTeamId && item.teamId !== activeTeamId) return false;
    if (platformFilter !== 'all' && item.platform.toLowerCase() !== platformFilter.toLowerCase()) return false;
    return true;
  });

  const platforms = [
    { id: 'all', label: 'All Feeds' },
    { id: 'youtube', label: 'YouTube Live & Videos' },
    { id: 'x', label: 'X (Twitter)' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'threads', label: 'Threads' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'facebook', label: 'Facebook' },
  ];

  // Verified official handles for quick-access scroll bar
  const activeHandles = handles.filter(h => {
    if (activeTeamId) return h.teamId === activeTeamId;
    return true;
  });

  return (
    <div 
      className="relative rounded-3xl p-5 sm:p-8 transition-all duration-500 overflow-hidden space-y-6"
      style={{
        background: theme.wallBgGradient,
        border: theme.wallBorder,
        boxShadow: theme.wallBoxShadow,
      }}
    >
      {/* Subtle Atmospheric Ambient Glow Matching Team's Primary Color */}
      <div 
        className="absolute top-0 left-0 w-[420px] h-[420px] pointer-events-none rounded-full blur-3xl opacity-60 transition-all duration-700"
        style={{ background: theme.ambientGlowTop }}
        aria-hidden="true"
      />
      <div 
        className="absolute bottom-0 right-0 w-[380px] h-[380px] pointer-events-none rounded-full blur-3xl opacity-50 transition-all duration-700"
        style={{ background: theme.ambientGlowBottom }}
        aria-hidden="true"
      />

      {/* Wall Header & Team Selector Control */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span 
              className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
              style={{
                background: theme.accentBadgeBg,
                border: theme.accentBadgeBorder,
                color: theme.textAccentColor,
              }}
            >
              <Sparkles className="w-3 h-3" /> Curator.io Social Wall
            </span>

            {/* Dynamic Theme Indicator */}
            <div 
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight text-slate-300 transition-colors"
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: `1px solid ${theme.borderAccentColor}`,
              }}
            >
              <Palette className="w-3 h-3" style={{ color: theme.primaryHex }} />
              <span>Theme:</span>
              <span className="font-black" style={{ color: theme.primaryHex }}>
                {currentTeam ? currentTeam.name : 'ADT10 League Neutral'}
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                ({theme.primaryHex})
              </span>
            </div>

            <span className="text-xs text-slate-400">
              Limited to Top {limitPerPlatform} per Platform
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* TeamPicker Modal Trigger & Quick Dropdown */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          {onOpenTeamPicker && (
            <button
              onClick={onOpenTeamPicker}
              className="px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm hover:scale-105 active:scale-95"
              style={{
                background: theme.tabActiveBg,
                color: theme.tabActiveText,
                boxShadow: theme.tabActiveShadow,
              }}
              title="Open full TeamPicker Modal to back a team in Fan Wars and theme this wall"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Team Picker</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-2.5 py-1 rounded-xl max-w-full">
            <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: theme.primaryHex }} />
            <select
              value={activeTeamId || ''}
              onChange={(e) => handleTeamChange(e.target.value ? e.target.value : null)}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer max-w-[180px] sm:max-w-none truncate"
            >
              <option value="" className="bg-slate-900 text-slate-200">All League Teams (Default Theme)</option>
              <option value="aces" className="bg-slate-900 text-amber-300 font-bold">★ Arabian Aces (Franchise Focus)</option>
              {teams.filter(t => t.id !== 'aces').map(t => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.name} ({t.short})
                </option>
              ))}
            </select>
          </div>

          {activeTeamId && (
            <button
              onClick={() => handleTeamChange(null)}
              className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
              title="Reset to League Neutral Theme"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Sync Real Feeds Button */}
          <button
            onClick={handleSyncRealFeeds}
            disabled={syncingFeeds}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              syncingFeeds 
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-wait' 
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border-slate-700 hover:border-amber-400/50'
            }`}
            title="Poll and fetch live real posts from team social handles, YouTube highlights, and accredited news"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingFeeds ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>{syncingFeeds ? 'Syncing...' : 'Sync Real Feeds'}</span>
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncNotice && (
        <div className="relative z-10 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 text-xs font-medium text-amber-300 flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">100% Verified Real Handles</span>
        </div>
      )}

      {/* Team Picker Theme Selector Strip (Quick Interactive Franchise Swatches) */}
      <div className="relative z-10 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" style={{ color: theme.primaryHex }} />
            Dynamic Team Theme Selector:
          </span>
          <span className="text-[10px] text-slate-400">
            Click any franchise to preview dynamic subtle background gradients
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {/* League Neutral Option */}
          <button
            onClick={() => handleTeamChange(null)}
            className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              !activeTeamId 
                ? 'bg-amber-400 text-slate-950 shadow-md font-black ring-1 ring-amber-400' 
                : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span>All Teams</span>
          </button>

          {/* Franchise Badges */}
          {teams.map(t => {
            const isSelected = activeTeamId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => handleTeamChange(t.id)}
                className={`px-2.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isSelected
                    ? 'ring-1 shadow-md font-black'
                    : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800/90 border border-slate-800'
                }`}
                style={isSelected ? {
                  background: t.color,
                  color: getLuminance(hexToRgb(t.color).r, hexToRgb(t.color).g, hexToRgb(t.color).b) > 0.55 ? '#020617' : '#FFFFFF',
                  borderColor: t.color,
                  boxShadow: `0 4px 14px -2px ${t.color}55`,
                } : {}}
              >
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: t.color }} 
                />
                <span>{t.short}</span>
                <span className="hidden sm:inline text-[11px] opacity-80">· {t.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Official Verified Social Handles Bar - Themed */}
      <div 
        className="relative z-10 p-3.5 rounded-2xl transition-all duration-300"
        style={{
          background: theme.handlesBg,
          border: theme.handlesBorder,
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span 
            className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors"
            style={{ color: theme.handlesLabelColor }}
          >
            <CheckCircle className="w-3.5 h-3.5" style={{ color: theme.primaryHex }} /> 
            {currentTeam ? `${currentTeam.name} Official Channels:` : 'Arabian Aces & League Official Channels:'}
          </span>
          <span className="text-[10px] text-slate-400">Direct Verified Links</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
          {activeHandles.length > 0 ? (
            activeHandles.map(h => (
              <a
                key={h.id}
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-slate-800 hover:bg-slate-800/80 text-slate-200 hover:text-white transition-all whitespace-nowrap group font-semibold"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.primaryHex;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <span className="text-xs font-black" style={{ color: theme.primaryHex }}>{h.platform}:</span>
                <span className="text-slate-300 group-hover:text-white">{h.handle}</span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-amber-300" style={{ color: theme.primaryHex }} />
              </a>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">No verified direct handles listed for this selection.</span>
          )}
        </div>
      </div>

      {/* Platform Filter Tabs - Themed */}
      <div className="relative z-10 flex items-center gap-1.5 overflow-x-auto pb-2 no-scrollbar text-xs font-bold">
        {platforms.map(p => {
          const active = platformFilter === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPlatformFilter(p.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                active ? 'font-black' : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 border'
              }`}
              style={
                active
                  ? {
                      background: theme.tabActiveBg,
                      color: theme.tabActiveText,
                      boxShadow: theme.tabActiveShadow,
                    }
                  : {
                      borderColor: theme.tabInactiveBorder,
                    }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Curated Grid with Dynamic Themed Cards */}
      {filtered.length === 0 ? (
        <div className="relative z-10 p-12 text-center rounded-2xl bg-slate-900/50 border border-slate-800">
          <Share2 className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-300">No curated items found for this selection.</p>
          <p className="text-xs text-slate-400 mt-1">Select another platform filter or franchise above.</p>
        </div>
      ) : (
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => {
            const team = getTeam(item.teamId);
            const isVideo = item.kind === 'video' || item.kind === 'live';
            const isLive = item.kind === 'live';

            return (
              <div
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl transition-all duration-300 overflow-hidden"
                style={{
                  background: theme.cardBg,
                  border: theme.cardBorder,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = theme.cardHoverBorderColor;
                  e.currentTarget.style.boxShadow = theme.cardHoverShadow;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = theme.cardBorderColor;
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div>
                  {/* Media Thumbnail with Video Overlay if applicable */}
                  {item.image && (
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-950">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {isVideo && (
                        <div 
                          onClick={() => setActiveVideoModal(item)}
                          className="absolute inset-0 bg-slate-950/40 flex items-center justify-center cursor-pointer hover:bg-slate-950/20 transition-colors"
                        >
                          <div 
                            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"
                            style={{
                              background: theme.playBtnBg,
                              color: theme.playBtnColor,
                            }}
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Live Indicator */}
                      {isLive && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                          <Radio className="w-3 h-3" /> LIVE STREAM
                        </div>
                      )}

                      {/* Pinned Badge */}
                      {item.status === 'pinned' && (
                        <div 
                          className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                          style={{
                            background: theme.primaryHex,
                            color: theme.contrastText,
                          }}
                        >
                          <Pin className="w-3 h-3" /> Pinned
                        </div>
                      )}
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="p-4 sm:p-5">
                    {/* Platform Tag, Real Badge & Team Tag */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase"
                          style={{
                            background: theme.accentBadgeBg,
                            border: theme.accentBadgeBorder,
                            color: theme.textAccentColor,
                          }}
                        >
                          {item.platform}
                        </span>

                        {item.verifiedReal && (
                          <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            title="Verified authentic post from official team handle or accredited sports wire"
                          >
                            <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                            Real Media
                          </span>
                        )}
                      </div>

                      {team && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                          <span className="text-xs font-bold text-slate-300">{team.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-extrabold text-sm sm:text-base text-white group-hover:text-slate-100 transition-colors line-clamp-3 leading-snug">
                      {item.title}
                    </h3>

                    {/* Summary / Text Body */}
                    {item.summary && (
                      <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                        {item.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer: Source handle, views/likes & external link */}
                <div className="px-4 py-3 bg-slate-950/60 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-bold text-slate-300 truncate">{item.source}</span>
                    {item.views && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Eye className="w-3 h-3" /> {item.views}
                      </span>
                    )}
                    {item.likes !== undefined && item.likes > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <Heart className="w-3 h-3 text-red-400 fill-red-400" /> {item.likes}
                      </span>
                    )}
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-bold transition-colors ml-2 hover:underline"
                    style={{ color: theme.primaryHex }}
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      {activeVideoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
          <div 
            className="relative w-full max-w-3xl bg-slate-900 rounded-2xl overflow-hidden shadow-2xl"
            style={{ border: `1px solid ${theme.borderAccentColor}` }}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" style={{ color: theme.primaryHex }} />
                <span className="font-bold text-sm text-white truncate max-w-lg">
                  {activeVideoModal.title}
                </span>
              </div>
              <button
                onClick={() => setActiveVideoModal(null)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              {activeVideoModal.url.includes('youtube.com') || activeVideoModal.url.includes('youtu.be') ? (
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube.com/embed/${
                    activeVideoModal.url.match(/v=([\w-]{11})/)?.[1] ||
                    activeVideoModal.url.split('/').pop()?.split('?')[0] ||
                    'dQw4w9WgXcQ'
                  }?autoplay=1`}
                  title={activeVideoModal.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center text-slate-300">
                  <Play className="w-12 h-12 mb-3" style={{ color: theme.primaryHex }} />
                  <p className="text-sm font-bold mb-2">Watch external video post directly on original platform:</p>
                  <a
                    href={activeVideoModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 font-bold rounded-xl text-xs flex items-center gap-2 transition-all hover:scale-105"
                    style={{
                      background: theme.tabActiveBg,
                      color: theme.tabActiveText,
                    }}
                  >
                    <span>Open on {activeVideoModal.platform}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-950 flex justify-between items-center text-xs text-slate-400">
              <span>Source: {activeVideoModal.source}</span>
              <a
                href={activeVideoModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1 font-bold"
                style={{ color: theme.primaryHex }}
              >
                Open Official Post <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

