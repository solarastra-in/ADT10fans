import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Crown,
  Eye,
  Flame,
  Info,
  Medal,
  Search,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api';
import { useLoad, useApp } from '../state';
import { useT } from '../i18n';
import { Avatar, Button, Card, Modal, Notice, Pill, Spinner, TeamBadge, cx, ROLE_SHORT, ROLE_LABEL } from './ui';
import type { MatchRegisteredTeamsResponse, RegisteredFantasyTeam, RegisteredTeamPlayerDetail, Team } from '../types';

interface Props {
  matchId: string;
  matchA?: Team | null;
  matchB?: Team | null;
  onDraftTeamClick?: () => void;
}

export function MatchRegisteredTeamsView({ matchId, matchA, matchB, onDraftTeamClick }: Props) {
  const t = useT();
  const { user, openAuth } = useApp();
  const { data, loading, error, reload } = useLoad(() => api.getMatchRegisteredTeams(matchId), [matchId]);
  const [search, setSearch] = useState('');
  const [inspectTeam, setInspectTeam] = useState<RegisteredFantasyTeam | null>(null);

  const teams = data?.teams || [];
  const topTeam = data?.topTeam;
  const hasScorecard = data?.hasScorecard;

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter(
      tm =>
        tm.userName.toLowerCase().includes(q) ||
        tm.variationName.toLowerCase().includes(q) ||
        tm.captainName.toLowerCase().includes(q) ||
        tm.viceCaptainName.toLowerCase().includes(q) ||
        (tm.userCity && tm.userCity.toLowerCase().includes(q))
    );
  }, [teams, search]);

  if (loading && !data) {
    return (
      <div className="py-12 text-center space-y-3">
        <Spinner />
        <p className="text-sm text-slate-400">{t('Loading registered teams and scorecard rankings…')}</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card className="p-6 text-center space-y-3 border-red-500/30">
        <p className="text-sm text-red-300 font-bold">{error}</p>
        <Button size="sm" onClick={() => reload()}>{t('Retry')}</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-5" data-testid="registered-teams-view">
      {/* Top Status & Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-black text-white">
                {t('Registered Fan Teams')} ({data?.totalRegistered || 0})
              </h3>
              {hasScorecard ? (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> {t('Scorecard Evaluated')}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {t('Registrations Active')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasScorecard
                ? t('Performance points computed from official match boundaries, wickets, milestones, and multipliers.')
                : t('All squads registered for this match. Scorecard points unlock on matchday.')}
            </p>
          </div>
        </div>

        {onDraftTeamClick && (
          <Button size="sm" onClick={onDraftTeamClick} className="font-bold shrink-0 self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            {user ? t('Draft My Squad') : t('Sign In to Register Squad')}
          </Button>
        )}
      </div>

      {/* HIGHEST POINTS LEADER HERO CARD */}
      {topTeam && topTeam.points > 0 && (
        <Card className="relative overflow-hidden p-5 sm:p-6 border-2 border-amber-500/50 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/30 shadow-xl shadow-amber-500/10">
          <div className="absolute top-0 end-0 translate-x-4 -translate-y-4 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
            <div className="flex items-start gap-4">
              <div className="relative">
                <div className="rounded-full overflow-hidden border-2 border-amber-400 shadow-lg">
                  <Avatar name={topTeam.userName} src={topTeam.userAvatar} size={58} />
                </div>
                <div className="absolute -top-2 -end-2 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-1 shadow-sm">
                    <Trophy className="w-3 h-3 fill-current" /> {t('Rank #1 · Highest Points')}
                  </span>
                  {topTeam.userCity && (
                    <span className="text-xs text-slate-400 font-medium">
                      📍 {topTeam.userCity}
                    </span>
                  )}
                </div>
                <h4 className="text-xl font-black text-white">{topTeam.userName}</h4>
                <p className="text-xs text-amber-300/90 font-bold flex items-center gap-2">
                  <span>{t('Lineup')}: <strong className="text-white">{topTeam.variationName}</strong></span>
                  <span>·</span>
                  <span>(C) {topTeam.captainName} (2x)</span>
                  <span>·</span>
                  <span>(VC) {topTeam.viceCaptainName} (1.5x)</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 self-end md:self-center border-t md:border-t-0 md:border-s border-slate-800 pt-3 md:pt-0 md:ps-6">
              <div className="text-end">
                <p className="text-[11px] uppercase font-bold text-amber-400/90 tracking-wider">
                  {t('Match Scorecard Points')}
                </p>
                <p className="text-3xl sm:text-4xl font-black text-amber-400 tabular-nums">
                  {topTeam.points.toLocaleString()} <span className="text-sm font-semibold text-slate-300">pts</span>
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setInspectTeam(topTeam)}
                className="bg-amber-400 text-slate-950 hover:bg-amber-300 font-black shadow-md cursor-pointer shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">{t('Inspect XI')}</span>
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Top Point-Scoring Players from Scorecard (if available) */}
      {data?.playerScorecardPoints && data.playerScorecardPoints.length > 0 && (
        <Card className="p-4 bg-slate-900/80 border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Flame className="w-4 h-4" />
              {t('Top Match Scorecard Performers')}
            </h4>
            <span className="text-[11px] text-slate-400">{t('Fantasy Points Earned')}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {data.playerScorecardPoints.slice(0, 4).map((p, idx) => (
              <div key={p.playerId} className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-slate-500">#{idx + 1}</span>
                    <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{p.detail[0] || 'Scorecard points'}</p>
                </div>
                <span className="text-sm font-black text-emerald-400 tabular-nums shrink-0">
                  +{p.points}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* SEARCH BAR & REGISTERED TEAMS TABLE */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="text-sm font-black text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400" />
            {t('All Registered Match Lineups')} ({filteredTeams.length})
          </h4>

          <div className="relative max-w-xs w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('Search fan, team, or captain…')}
              className="w-full text-xs rounded-xl bg-slate-900 border border-slate-700 ps-8 pe-3 py-1.5 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {filteredTeams.length === 0 ? (
          <Card className="p-8 text-center space-y-2 border-slate-800">
            <p className="text-sm text-slate-400">{t('No registered teams match "{q}".', { q: search })}</p>
            <Button size="sm" variant="ghost" onClick={() => setSearch('')}>{t('Clear search')}</Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredTeams.map(tm => {
              const isFirst = tm.rank === 1 && tm.points > 0;
              const isSecond = tm.rank === 2 && tm.points > 0;
              const isThird = tm.rank === 3 && tm.points > 0;

              return (
                <div
                  key={tm.id}
                  onClick={() => setInspectTeam(tm)}
                  className={cx(
                    'p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3',
                    isFirst
                      ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400'
                      : isSecond
                      ? 'bg-slate-900/90 border-slate-700 hover:border-slate-500'
                      : isThird
                      ? 'bg-slate-900/80 border-amber-900/30 hover:border-amber-700/50'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank Badge */}
                    <div
                      className={cx(
                        'w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 tabular-nums border',
                        isFirst
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                          : isSecond
                          ? 'bg-slate-300 text-slate-950 border-white'
                          : isThird
                          ? 'bg-amber-700 text-white border-amber-600'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      )}
                    >
                      {isFirst ? <Crown className="w-4 h-4 fill-current" /> : `#${tm.rank}`}
                    </div>

                    <div className="shrink-0">
                      <Avatar name={tm.userName} src={tm.userAvatar} size={40} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-sm text-white truncate hover:text-amber-300">
                          {tm.userName}
                        </span>
                        {tm.isHighest && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                            ★ {t('Highest Scorer')}
                          </span>
                        )}
                        {tm.userCity && (
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({tm.userCity})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap mt-0.5">
                        <span className="font-bold text-slate-300">{tm.variationName}</span>
                        <span>·</span>
                        <span className="text-amber-300 font-semibold">C: {tm.captainName} (2x)</span>
                        <span>·</span>
                        <span className="text-sky-300 font-semibold">VC: {tm.viceCaptainName} (1.5x)</span>
                      </div>
                    </div>
                  </div>

                  {/* Performance Points & Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 ms-11 sm:ms-0 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
                    <div className="text-start sm:text-end">
                      <p className="text-[10px] uppercase font-bold text-slate-400">{t('Scorecard Points')}</p>
                      <p className={cx('text-xl font-black tabular-nums', isFirst ? 'text-amber-400' : 'text-white')}>
                        {tm.points.toLocaleString()} <span className="text-xs font-normal text-slate-400">pts</span>
                      </p>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 font-bold text-xs text-slate-200 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('View Lineup')}</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LINEUP SCORECARD INSPECTION MODAL */}
      {inspectTeam && (
        <Modal
          open={Boolean(inspectTeam)}
          onClose={() => setInspectTeam(null)}
          title={`${inspectTeam.userName} · ${inspectTeam.variationName}`}
        >
          <div className="space-y-4 max-h-[80vh] overflow-y-auto pe-1">
            {/* Header info */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="flex items-center gap-3">
                <Avatar name={inspectTeam.userName} src={inspectTeam.userAvatar} size={42} />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-white">{inspectTeam.userName}</h4>
                    {inspectTeam.isHighest && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-amber-400 text-slate-950">
                        {t('Scorecard Leader')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{inspectTeam.userCity || 'Cricket Fan'}</p>
                </div>
              </div>

              <div className="text-end">
                <span className="text-[10px] font-bold uppercase text-slate-400">{t('Total Lineup Points')}</span>
                <p className="text-2xl font-black text-amber-400 tabular-nums">
                  {inspectTeam.points.toLocaleString()} <span className="text-xs text-slate-300">pts</span>
                </p>
              </div>
            </div>

            {/* Players Table Breakdown */}
            <div className="space-y-1.5">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">
                {t('11-Player Scorecard Performance Breakdown')}
              </p>

              <div className="divide-y divide-slate-800 rounded-xl bg-slate-950/80 border border-slate-800 overflow-hidden">
                {inspectTeam.players.map(p => {
                  const roleCls = ROLE_SHORT[p.role as keyof typeof ROLE_SHORT] || 'BAT';
                  return (
                    <div key={p.playerId} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0">
                          <Avatar name={p.name} src={p.photoUrl} size={34} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-white truncate">{p.name}</span>
                            <span className="text-[10px] font-bold px-1 rounded bg-slate-800 text-slate-300">
                              {roleCls}
                            </span>
                            {p.isCaptain && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950">
                                2x (C)
                              </span>
                            )}
                            {p.isViceCaptain && (
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-sky-400 text-slate-950">
                                1.5x (VC)
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {p.detail}
                          </p>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <span className="text-[10px] text-slate-500 block">
                          {p.multiplier > 1 ? `${p.basePoints} × ${p.multiplier}` : 'base'}
                        </span>
                        <span className={cx('text-sm font-black tabular-nums', p.totalPoints > 0 ? 'text-emerald-400' : 'text-slate-400')}>
                          {p.totalPoints > 0 ? `+${p.totalPoints}` : p.totalPoints} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>{t('Registration Timestamp')}: {new Date(inspectTeam.updatedAt).toLocaleString()}</span>
              <Button size="sm" variant="ghost" onClick={() => setInspectTeam(null)}>{t('Close')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
