import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  Crown,
  Dices,
  Flame,
  HelpCircle,
  Info,
  Layers,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Shield,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta } from '../router';
import {
  Avatar,
  Button,
  Card,
  Countdown,
  ErrorBox,
  Notice,
  Pill,
  SectionTitle,
  Spinner,
  Tabs,
  TeamBadge,
  cx,
  ROLE_SHORT,
  ROLE_LABEL,
} from '../components/ui';
import { FantasySwingVisualizer } from '../components/FantasySwingVisualizer';
import { SquadSkillRadar } from '../components/SquadSkillRadar';
import { suggestUniqueTeamName } from '../utils/teamNames';
import type { LineupPreset, Player, PlayerRole, PlayerWithForm } from '../types';

const ROLES: PlayerRole[] = ['wicketkeeper', 'batter', 'allrounder', 'bowler'];

const ROLE_INFO: Record<PlayerRole, {
  label: string;
  short: string;
  singular: string;
  icon: typeof Shield;
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  summary: string;
}> = {
  wicketkeeper: {
    label: 'Wicketkeepers',
    short: 'WK',
    singular: 'Wicketkeeper',
    icon: Shield,
    color: '#f59e0b',
    badgeBg: 'bg-amber-500/15',
    badgeBorder: 'border-amber-500/30',
    badgeText: 'text-amber-300',
    summary: 'Catches, stumpings & top-order hitting',
  },
  batter: {
    label: 'Batters',
    short: 'BAT',
    singular: 'Batter',
    icon: Zap,
    color: '#f43f5e',
    badgeBg: 'bg-rose-500/15',
    badgeBorder: 'border-rose-500/30',
    badgeText: 'text-rose-300',
    summary: 'Powerplay boundaries & acceleration',
  },
  allrounder: {
    label: 'All-Rounders',
    short: 'AR',
    singular: 'All-Rounder',
    icon: Sparkles,
    color: '#818cf8',
    badgeBg: 'bg-indigo-500/15',
    badgeBorder: 'border-indigo-500/30',
    badgeText: 'text-indigo-300',
    summary: 'Match-winners with bat & ball',
  },
  bowler: {
    label: 'Bowlers',
    short: 'BOWL',
    singular: 'Bowler',
    icon: Target,
    color: '#10b981',
    badgeBg: 'bg-emerald-500/15',
    badgeBorder: 'border-emerald-500/30',
    badgeText: 'text-emerald-300',
    summary: 'Wicket takers, spin & death yorkers',
  },
};

export default function FantasyMatchPage({ id }: { id: string }) {
  const { user, teamById, openAuth, toast, setUser, config } = useApp();
  const t = useT();
  const { data, error, loading, reload } = useLoad(() => api.getFantasy(id), [id, user?.id]);
  const [picked, setPicked] = useState<string[]>([]);
  const [captain, setCaptain] = useState('');
  const [vice, setVice] = useState('');
  const [variationId, setVariationId] = useState('var-1');
  const [variationName, setVariationName] = useState(() => suggestUniqueTeamName());
  const [step, setStep] = useState<'pick' | 'captain'>('pick');
  const [role, setRole] = useState<'all' | PlayerRole>('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState<'all' | '5' | '4' | '3' | '2' | '1'>('all');
  const [expandedAdaptationId, setExpandedAdaptationId] = useState<string | null>(null);
  const [infoPlayerId, setInfoPlayerId] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const m = data?.match;
  const a = teamById(m?.teamA);
  const b = teamById(m?.teamB);
  usePageMeta(
    m ? t('Dream XI: {a} vs {b}', { a: a?.name || '', b: b?.name || '' }) : null,
    t('Draft a balanced 11-player squad across Wicketkeeper, Batter, All-Rounder, and Bowler under a 100 Credits budget. Captain scores 2x, Vice-Captain 1.5x.'),
    config?.brandName
  );

  const savedTeams = useMemo(() => {
    if (data?.fantasyTeams && data.fantasyTeams.length > 0) return data.fantasyTeams;
    if (data?.fantasyTeam) return [data.fantasyTeam];
    return [];
  }, [data?.fantasyTeams, data?.fantasyTeam]);

  useEffect(() => {
    if (data?.fantasyTeam && picked.length === 0) {
      setPicked(data.fantasyTeam.playerIds);
      setCaptain(data.fantasyTeam.captainId);
      setVice(data.fantasyTeam.viceCaptainId || '');
      setVariationId(data.fantasyTeam.variationId || 'var-1');
      setVariationName(data.fantasyTeam.variationName || suggestUniqueTeamName());
    }
  }, [data?.fantasyTeam]);

  const pool = (data?.pool || []) as PlayerWithForm[];
  const rules = data?.rules;
  const byId = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);
  const chosen = picked.map(pid => byId.get(pid)).filter(Boolean) as PlayerWithForm[];
  const totalSquadProj = Math.round(chosen.reduce((s, p) => s + (p.form?.projectedPoints || 70), 0));
  const totalCreditsUsed = Math.round(chosen.reduce((s, p) => s + (p.credits ?? 8.0), 0) * 10) / 10;
  const budgetLimit = rules?.creditCap || 100;
  const remainingCredits = Math.round((budgetLimit - totalCreditsUsed) * 10) / 10;
  const isUnderBudget = totalCreditsUsed <= budgetLimit;

  const perTeam = (tid?: string) => chosen.filter(p => p.teamId === tid).length;
  const perRole = (r: PlayerRole) => chosen.filter(p => p.role === r).length;
  const perLevel = (lvl: number) => chosen.filter(p => (p.form?.allocationLevel || (p.form?.tier === 'star' ? 5 : 3)) === lvl).length;

  const isTop = (p: PlayerWithForm): boolean => {
    const form = p.form;
    if (typeof form?.allocationLevel === 'number' && form.allocationLevel >= 4) return true;
    if (form?.tier === 'star' || p.isIcon) return true;
    return (p.credits ?? 8.0) >= 9.5;
  };

  const topCount = chosen.filter(p => isTop(p)).length;
  const maxTop = rules?.maxTopPlayers || 4;
  const isTopLimitOk = topCount <= maxTop;

  // Balanced squad checks: at least 1 of each role (WK, BAT, AR, BOWL)
  const missingRoles = ROLES.filter(r => perRole(r) < (rules?.roleMin ?? 1));
  const isSquadBalanced = missingRoles.length === 0;
  const isSquadComplete = rules ? picked.length === rules.size : false;
  const complete = isSquadComplete && isSquadBalanced && isUnderBudget && isTopLimitOk;

  if (loading && !data) return <Spinner />;
  if (error || !data || !m || !rules) return <ErrorBox message={error || t('Match not found')} onRetry={reload} />;

  const why = (p: PlayerWithForm): string | null => {
    if (picked.includes(p.id)) return null;
    if (picked.length >= rules.size) return t('Squad is full ({size}/{size} players selected)', { size: rules.size });
    if (perTeam(p.teamId) >= rules.maxFromOneTeam) return t('Max {n} from one team', { n: rules.maxFromOneTeam });
    if (perRole(p.role) >= rules.roleMax) {
      return t('Max {n} {role}s allowed in squad', {
        n: rules.roleMax,
        role: ROLE_INFO[p.role].label,
      });
    }

    // Budget check: ensure remaining picks have at least 7.0 credits each
    const pCost = p.credits ?? 8.0;
    const remainingPicks = rules.size - picked.length - 1;
    const minRequiredForRemaining = remainingPicks * 7.0;
    if (totalCreditsUsed + pCost + minRequiredForRemaining > budgetLimit) {
      return t('Budget exceeded: need at least {need} credits for remaining {picks} picks ({rem} credits left)', {
        need: minRequiredForRemaining.toFixed(1),
        picks: remainingPicks,
        rem: remainingCredits.toFixed(1),
      });
    }

    // Top player / star allocation constraint: team can only have few good players
    if (isTop(p) && topCount >= maxTop) {
      return t('Max {max} top/star players allowed ({count} selected). Fill remaining spots with mediocre/budget enablers.', {
        max: maxTop,
        count: topCount,
      });
    }

    // Enforce balanced squad across all 4 roles:
    const remainingSpots = rules.size - picked.length - 1;
    const rolesStillMissing = ROLES.filter(r => r !== p.role && perRole(r) < rules.roleMin);
    if (rolesStillMissing.length > remainingSpots) {
      const missingLabels = rolesStillMissing.map(r => ROLE_INFO[r].singular).join(', ');
      return t('Leave spot(s) for required {roles} ({left} spot(s) left)', {
        roles: missingLabels,
        left: remainingSpots,
      });
    }
    return null;
  };

  const toggle = (p: PlayerWithForm) => {
    setErr(null);
    if (picked.includes(p.id)) {
      setPicked(picked.filter(x => x !== p.id));
      if (captain === p.id) setCaptain('');
      if (vice === p.id) setVice('');
      return;
    }
    const block = why(p);
    if (block) return toast(block, 'error');
    setPicked([...picked, p.id]);
  };

  const handleSelectVariation = (vId: string) => {
    const target = savedTeams.find(t => (t.variationId || 'var-1') === vId);
    if (target) {
      setPicked(target.playerIds);
      setCaptain(target.captainId);
      setVice(target.viceCaptainId || '');
      setVariationId(target.variationId || 'var-1');
      setVariationName(target.variationName || suggestUniqueTeamName());
      setStep('pick');
      toast(t('Loaded variation: {name}', { name: target.variationName || vId }));
    }
  };

  const handleSuggestName = () => {
    const newName = suggestUniqueTeamName([...savedTeams.map(s => s.variationName || ''), variationName]);
    setVariationName(newName);
    toast(t('Suggested unique team name: {name}', { name: newName }));
  };

  const handleCreateNewVariation = () => {
    const nextSlot = savedTeams.length + 1;
    const newId = `var-${nextSlot}`;
    const newName = suggestUniqueTeamName(savedTeams.map(s => s.variationName || ''));
    setVariationId(newId);
    setVariationName(newName);
    setPicked([]);
    setCaptain('');
    setVice('');
    setStep('pick');
    toast(t('New squad slot "{name}" created. Pick your 11 players or select a smart preset!', { name: newName }));
  };

  const handleApplyPreset = (preset: LineupPreset) => {
    setPicked(preset.playerIds);
    setCaptain(preset.captainId);
    setVice(preset.viceCaptainId);
    setVariationName(preset.name);
    setStep('pick');
    toast(t('Applied "{name}" preset ({stars} stars, {pts} proj pts). Customize or save!', {
      name: preset.name,
      stars: preset.starCount,
      pts: preset.totalCredits,
    }));
  };

  const save = async () => {
    if (!user) return openAuth(t('Sign in to save your Dream XI.'));
    setSaving(true);
    setErr(null);
    try {
      const r = await api.submitFantasy(m.id, picked, captain, vice, variationId, variationName);
      setUser(r.user);
      setJustSaved(true);
      toast(t('Squad Saved! Your team "{name}" is locked in for the match.', { name: variationName }), 'success');
      setTimeout(() => {
        setJustSaved(false);
      }, 2600);
      reload();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(t('Delete this Dream XI variation?'))) return;
    await api.deleteFantasy(m.id, variationId);
    setPicked([]);
    setCaptain('');
    setVice('');
    reload();
  };

  const header = (
    <Card className="p-4 flex items-center gap-3">
      <TeamBadge team={a} size="md" />
      <span className="font-black text-white text-base truncate">{a?.short} vs {b?.short}</span>
      <TeamBadge team={b} size="md" />
      <span className="ms-auto text-xs text-slate-300 text-end">
        {data.locked ? (
          <span className="inline-flex items-center gap-1 text-slate-400"><Lock className="w-3.5 h-3.5" /> {t('Locked')}</span>
        ) : (
          <strong className="text-amber-300"><Countdown to={m.startsAt} prefix="Locks in {time}" /></strong>
        )}
        <span className="block text-[11px] text-slate-500">{t('{n} teams entered', { n: data.lineups })}</span>
      </span>
    </Card>
  );

  // Locked: show the lineup (and its points once scored).
  if (data.locked) {
    const ft = data.fantasyTeam;
    return (
      <div className="space-y-5">
        <Link to="/fantasy" className="text-xs text-slate-500 hover:text-white inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4 rtl-flip" /> {t('Dream XI')}
        </Link>
        {header}
        {!ft ? (
          <Notice>{t('Lineups are locked for this match and you did not pick a team.')}</Notice>
        ) : (
          <Card>
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-black text-white">
                {ft.variationName || t('Your Dream XI')}
              </span>
              {ft.points !== undefined && ft.scoredAt ? (
                <span className="font-black text-amber-400">{t('{n} pts', { n: ft.points })} · #{ft.rank}</span>
              ) : (
                <Pill>{t('Waiting for the result')}</Pill>
              )}
            </div>
            <div className="divide-y divide-slate-800">
              {(ft.breakdown || ft.playerIds.map(pid => ({ playerId: pid, name: byId.get(pid)?.name || pid, base: 0, multiplier: pid === ft.captainId ? 2 : pid === ft.viceCaptainId ? 1.5 : 1, total: 0, detail: '' }))).map(line => (
                <div key={line.playerId} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={line.name} src={byId.get(line.playerId)?.photoUrl} size={32} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white truncate">
                      {line.name} {line.playerId === ft.captainId && <Pill tone="amber">C (2x)</Pill>} {line.playerId === ft.viceCaptainId && <Pill tone="blue">VC (1.5x)</Pill>}
                    </span>
                    {line.detail && <span className="block text-[11px] text-slate-500 truncate">{line.detail}</span>}
                  </span>
                  {ft.scoredAt && <span className="font-black text-amber-400 tabular-nums">{line.total}</span>}
                </div>
              ))}
            </div>
          </Card>
        )}
        <Link to={`/matches/${m.id}`} className="text-sm font-bold text-amber-400">{t('Match page')} →</Link>
      </div>
    );
  }

  const visible = pool
    .filter(p => (role === 'all' || p.role === role) && (teamFilter === 'all' || p.teamId === teamFilter) && (levelFilter === 'all' || String(p.form?.allocationLevel ?? (p.form?.tier === 'star' ? 5 : 3)) === levelFilter))
    .sort((x, y) => (y.form?.projectedPoints || 0) - (x.form?.projectedPoints || 0) || x.name.localeCompare(y.name));

  return (
    <div className="space-y-4 pb-24">
      <Link to="/fantasy" className="text-xs text-slate-500 hover:text-white inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4 rtl-flip" /> {t('Dream XI')}
      </Link>
      {header}

      {/* Variation Switcher & Manager Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 p-2.5 border border-slate-800 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-300 inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {t('Team Name')}:
          </span>
          <input
            type="text"
            value={variationName}
            onChange={e => setVariationName(e.target.value)}
            className="rounded bg-slate-950 px-2.5 py-1 font-bold text-white border border-slate-700 focus:border-amber-400 focus:outline-none min-w-[160px]"
            placeholder="Unique squad name"
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSuggestName}
            className="text-amber-400 text-xs px-2 hover:bg-amber-400/10 flex items-center gap-1 cursor-pointer"
            title={t('Suggest a unique creative cricket team name')}
          >
            <Dices className="w-3.5 h-3.5" />
            <span>{t('Suggest Name')}</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {savedTeams.map(st => {
            const isCur = (st.variationId || 'var-1') === variationId;
            return (
              <button
                key={st.variationId || st.variationName}
                type="button"
                onClick={() => handleSelectVariation(st.variationId || 'var-1')}
                className={cx(
                  'rounded-lg px-2.5 py-1 font-bold text-xs transition-all border cursor-pointer',
                  isCur
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                )}
              >
                {st.variationName || 'Team'}
              </button>
            );
          })}
          {savedTeams.length < 4 && (
            <Button size="sm" variant="ghost" onClick={handleCreateNewVariation} className="text-amber-400 text-xs">
              <Plus className="w-3.5 h-3.5" /> {t('New Slot')}
            </Button>
          )}
        </div>
      </div>

      {!user && <Notice>{t('You can build and simulate variations now; sign in to persist your teams.')}</Notice>}
      {err && <ErrorBox message={err} />}

      {/* Graphical Team Swing Visualizer (Radar, Performance momentum, Star allocation, Presets) */}
      <FantasySwingVisualizer
        pool={pool}
        pickedIds={picked}
        captainId={captain}
        viceCaptainId={vice}
        matchAId={m.teamA}
        matchBId={m.teamB}
        teamById={teamById}
        swingInsights={data.swingInsights}
        presets={data.presets}
        onApplyPreset={handleApplyPreset}
        activeVariationName={variationName}
        savedVariations={savedTeams}
        onSelectVariation={handleSelectVariation}
      />

      {/* Real-time counters: Squad Size (11 max), Budget (100 credits cap), Stars (Few good players), and Team distributions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center" data-testid="xi-counters">
        <Card className="p-2 border border-amber-500/30 bg-slate-900/90">
          <p className={cx('text-lg font-black tabular-nums', complete ? 'text-emerald-400' : 'text-amber-400')}>
            {picked.length}/{rules.size}
          </p>
          <p className="text-[11px] text-slate-300 font-semibold">{t('Squad ({size} Players)', { size: rules.size })}</p>
        </Card>
        <Card className="p-2">
          <p className={cx('text-lg font-black tabular-nums', isUnderBudget ? 'text-emerald-300' : 'text-rose-400')}>
            {totalCreditsUsed} <span className="text-xs font-normal text-slate-400">/ {budgetLimit}</span>
          </p>
          <p className="text-[11px] text-slate-400">{remainingCredits >= 0 ? `${remainingCredits} credits left` : 'Over Budget!'}</p>
        </Card>
        <Card className="p-2 col-span-2 sm:col-span-1">
          <p className={cx('text-lg font-black tabular-nums', isTopLimitOk ? (topCount >= 3 ? 'text-emerald-400' : 'text-sky-300') : 'text-rose-400')}>
            {topCount}/{maxTop} ⭐
          </p>
          <p className="text-[11px] text-slate-400">{t('Stars (Max {n})', { n: maxTop })}</p>
        </Card>
        <Card className="p-2">
          <p className={cx('text-lg font-black tabular-nums', perTeam(m.teamA) > rules.maxFromOneTeam ? 'text-red-400' : 'text-white')}>
            {perTeam(m.teamA)}/{rules.maxFromOneTeam}
          </p>
          <p className="text-[11px] text-slate-400">{a?.short} ({t('Max {n}', { n: rules.maxFromOneTeam })})</p>
        </Card>
        <Card className="p-2">
          <p className={cx('text-lg font-black tabular-nums', perTeam(m.teamB) > rules.maxFromOneTeam ? 'text-red-400' : 'text-white')}>
            {perTeam(m.teamB)}/{rules.maxFromOneTeam}
          </p>
          <p className="text-[11px] text-slate-400">{b?.short} ({t('Max {n}', { n: rules.maxFromOneTeam })})</p>
        </Card>
      </div>

      {/* Aggregate Skill Distribution Radar (Batting, Bowling, Fielding) using Recharts */}
      <SquadSkillRadar
        pickedPlayers={chosen}
        captainId={captain}
        viceCaptainId={vice}
        squadSizeLimit={rules.size}
      />

      {/* Balanced Squad Requirement Board (11 Players across 4 Roles) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
                <Shield className="h-3.5 w-3.5" />
              </span>
              <h4 className="text-sm font-black text-white">
                {t('Balanced Squad Requirement (11 Players Across Roles)')}
              </h4>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('Every 11-player squad must include at least 1 Wicketkeeper, 1 Batter, 1 All-Rounder, and 1 Bowler (Max {max} per role).', { max: rules.roleMax })}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSquadBalanced ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-black text-emerald-300 border border-emerald-500/40">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {t('All 4 Roles Balanced')}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs font-black text-amber-300 border border-amber-500/40">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                {t('{n} Role(s) Missing', { n: missingRoles.length })}
              </span>
            )}
          </div>
        </div>

        {/* 4 Interactive Role Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {ROLES.map(r => {
            const conf = ROLE_INFO[r];
            const count = perRole(r);
            const isCovered = count >= rules.roleMin;
            const isFull = count >= rules.roleMax;
            const Icon = conf.icon;
            const isSelectedTab = role === r;

            return (
              <button
                key={r}
                type="button"
                onClick={() => setRole(role === r ? 'all' : r)}
                className={cx(
                  'rounded-xl border p-2.5 text-start transition-all cursor-pointer relative',
                  isSelectedTab
                    ? 'ring-2 ring-amber-400 border-amber-400 bg-slate-950'
                    : isCovered
                    ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500/70'
                    : 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/70'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-white">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-md"
                      style={{ backgroundColor: `${conf.color}20`, color: conf.color }}
                    >
                      <Icon className="h-3 w-3" />
                    </span>
                    {conf.singular}
                  </span>
                  <span
                    className={cx(
                      'text-[10px] font-black px-1.5 py-0.2 rounded font-mono',
                      isCovered
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    )}
                  >
                    {count}/{rules.roleMin} min
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 truncate text-[10px]">{conf.summary}</span>
                  <span className={cx('text-[10px] font-bold ml-1 shrink-0', isCovered ? 'text-emerald-400' : 'text-amber-400')}>
                    {isCovered ? (isFull ? t('Max {n}', { n: rules.roleMax }) : t('✓ Covered')) : t('⚠️ Need 1')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {step === 'pick' ? (
        <>
          <Tabs
            value={role}
            onChange={setRole as any}
            items={[
              { id: 'all', label: t('All Roles ({n})', { n: pool.length }) },
              ...ROLES.map(r => ({
                id: r,
                label: `${ROLE_INFO[r].singular} (${perRole(r)}/${rules.roleMin})`,
              })),
            ]}
          />
          <Tabs
            value={teamFilter}
            onChange={setTeamFilter}
            items={[{ id: 'all', label: t('Both teams') }, { id: m.teamA, label: a?.short || m.teamA }, { id: m.teamB, label: b?.short || m.teamB }]}
          />

          {/* Multi-level Point Allocation Filter Strip */}
          <div className="flex items-center gap-1.5 flex-wrap p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
            <span className="text-[11px] font-black text-slate-300 inline-flex items-center gap-1.5 pr-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Allocation Levels:
            </span>
            <button
              type="button"
              onClick={() => setLevelFilter('all')}
              className={cx(
                'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer',
                levelFilter === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              )}
            >
              All ({pool.length})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('5')}
              className={cx(
                'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1',
                levelFilter === '5'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-amber-400 border border-amber-400/40 hover:bg-amber-400/10'
              )}
            >
              ⭐ L5 Supernova ({perLevel(5)} in team)
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('4')}
              className={cx(
                'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1',
                levelFilter === '4'
                  ? 'bg-sky-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-sky-400 border border-sky-400/40 hover:bg-sky-400/10'
              )}
            >
              L4 Premium ({perLevel(4)})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('3')}
              className={cx(
                'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1',
                levelFilter === '3'
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-emerald-400 border border-emerald-400/40 hover:bg-emerald-400/10'
              )}
            >
              L3 Core ({perLevel(3)})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('2')}
              className={cx(
                'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1',
                levelFilter === '2'
                  ? 'bg-purple-400 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-purple-400 border border-purple-400/40 hover:bg-purple-400/10'
              )}
            >
              L2 Tactical ({perLevel(2)})
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter('1')}
              className={cx(
                'px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer flex items-center gap-1',
                levelFilter === '1'
                  ? 'bg-slate-200 text-slate-950 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border border-slate-700 hover:text-white'
              )}
            >
              L1 Enablers ({perLevel(1)})
            </button>
          </div>

          <div className="space-y-2" data-testid="player-pool">
            {visible.map(p => {
              const on = picked.includes(p.id);
              const blocked = !on ? why(p) : null;
              const tm = teamById(p.teamId);
              const form = p.form;
              const lvl = form?.allocationLevel || (form?.tier === 'star' ? 5 : form?.tier === 'core' ? 3 : 2);
              const isExpanded = expandedAdaptationId === p.id;

              return (
                <div
                  key={p.id}
                  className={cx(
                    'rounded-2xl border transition-all overflow-hidden',
                    on
                      ? 'bg-amber-400/10 border-amber-400/60 shadow-md'
                      : blocked
                      ? 'bg-slate-950/40 border-slate-900 opacity-60'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  )}
                >
                  <div className="flex items-center gap-3 p-3 min-h-[68px]">
                    <Avatar name={p.name} src={p.photoUrl} size={42} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">{p.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setInfoPlayerId(infoPlayerId === p.id ? null : p.id);
                          }}
                          aria-label={t('View stats for {name}', { name: p.name })}
                          title={t('Historical metrics & career stats')}
                          className="p-1 rounded-full text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>

                        {/* Role Category Badge */}
                        {(() => {
                          const rConf = ROLE_INFO[p.role];
                          const RIcon = rConf.icon;
                          return (
                            <span
                              className={cx(
                                'rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 border',
                                rConf.badgeBg,
                                rConf.badgeBorder,
                                rConf.badgeText
                              )}
                            >
                              <RIcon className="w-2.5 h-2.5" />
                              {rConf.short} · {rConf.singular}
                            </span>
                          );
                        })()}

                        {/* Allocation Level Badge */}
                        <span
                          className={cx(
                            'rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider',
                            lvl === 5
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 shadow-sm'
                              : lvl === 4
                              ? 'bg-sky-400/20 text-sky-300 border border-sky-400/40'
                              : lvl === 3
                              ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                              : lvl === 2
                              ? 'bg-purple-400/20 text-purple-300 border border-purple-400/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          )}
                        >
                          L{lvl} {lvl === 5 ? 'Supernova' : lvl === 4 ? 'Premium' : lvl === 3 ? 'Core' : lvl === 2 ? 'Tactical' : 'Enabler'}
                        </span>

                        {form?.trend === 'hot' && (
                          <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 text-[9px] font-bold inline-flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> +{form.momentumScore}% Hot
                          </span>
                        )}
                        {form?.trend === 'rising' && (
                          <span className="rounded bg-sky-500/20 text-sky-300 px-1.5 py-0.5 text-[9px] font-bold inline-flex items-center gap-0.5">
                            <TrendingUp className="w-2.5 h-2.5" /> +{form.momentumScore}% Rising
                          </span>
                        )}
                        {form?.trend === 'cold' && (
                          <span className="rounded bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 text-[9px] font-bold inline-flex items-center gap-0.5">
                            <TrendingDown className="w-2.5 h-2.5" /> Value Dip
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate mt-1">
                        <span className="inline-flex items-center gap-1.5">
                          <TeamBadge team={tm} size="xs" />
                          <span className="font-bold text-slate-300">{tm?.short}</span>
                          <span>·</span>
                          <span>{[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' · ') || ROLE_INFO[p.role].singular}</span>
                        </span>
                        {form?.matchupNote && (
                          <>
                            <span>·</span>
                            <span className="text-slate-300 font-medium truncate">{form.matchupNote}</span>
                          </>
                        )}
                        {typeof p.selectedBy === 'number' && data.lineups > 0 && (
                          <>
                            <span>·</span>
                            <span>{p.selectedBy}% picked</span>
                          </>
                        )}
                      </div>

                      {/* Past Performance Sparkline & Future Adaptive Indicators */}
                      {form?.recentScores && (
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                          <span className="text-slate-500">Past:</span>
                          <div className="flex items-center gap-1">
                            {form.recentScores.map((score, sIdx) => (
                              <span
                                key={sIdx}
                                className={cx(
                                  'px-1.5 py-0.2 rounded font-mono font-bold text-[9px]',
                                  score >= 50 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-300'
                                )}
                              >
                                {score}
                              </span>
                            ))}
                          </div>
                          <span>·</span>
                          <span className="text-slate-300 font-medium">Avg: <strong className="text-white">{form.pastPointsAvg || form.recentAvg}</strong></span>
                          <span>·</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAdaptationId(isExpanded ? null : p.id);
                            }}
                            className="text-amber-400 hover:underline font-bold inline-flex items-center gap-0.5 cursor-pointer ml-auto"
                          >
                            {isExpanded ? 'Hide Model' : 'Adaptation Intel ▾'}
                          </button>
                        </div>
                      )}

                      {/* Blocked reason helper text if user cannot pick this player */}
                      {blocked && (
                        <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-amber-400 font-medium bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/20">
                          <Info className="w-3 h-3 shrink-0 text-amber-400" />
                          <span className="truncate">{blocked}</span>
                        </div>
                      )}
                    </div>

                    {/* Base Point Projection & Credits */}
                    <div className="flex flex-col items-end text-end min-w-[76px]">
                      <div className="inline-flex items-baseline gap-1">
                        <span className="text-base font-black text-amber-400 tabular-nums">
                          {form?.projectedPoints || 70}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">pts</span>
                      </div>
                      <span className="text-[11px] font-black text-slate-200 tabular-nums">
                        {p.credits ?? 8.0} <span className="text-[10px] font-medium text-slate-400">credits</span>
                      </span>
                      {form?.recentAvg && (
                        <span className="text-[9px] text-slate-500 font-mono">
                          Past: {form.pastPointsAvg || form.recentAvg} avg
                        </span>
                      )}
                    </div>

                    {/* Add / Remove button */}
                    <button
                      type="button"
                      onClick={() => toggle(p)}
                      aria-pressed={on}
                      data-player={p.id}
                      disabled={Boolean(blocked)}
                      className={cx(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform',
                        on
                          ? 'bg-amber-400 text-slate-950 scale-105 shadow-md shadow-amber-500/20 cursor-pointer'
                          : blocked
                          ? 'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer'
                      )}
                      title={on ? 'Remove from team' : blocked ? blocked : 'Add to team'}
                    >
                      {on ? <Minus className="w-5 h-5 stroke-[2.5]" /> : <Plus className="w-5 h-5 stroke-[2.5]" />}
                    </button>
                  </div>

                  {/* Expandable Past & Future Performance Adaptation Intel Panel */}
                  {isExpanded && form && (
                    <div className="p-3 bg-slate-950/95 border-t border-slate-800/80 text-xs space-y-2 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between font-bold text-slate-300 text-[11px]">
                        <span className="text-amber-400 inline-flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          Multi-Level Adaptive Allocation: Level {lvl}
                        </span>
                        <span className="text-slate-400 font-mono">
                          Floor: {form.projectedFloor || Math.round(form.projectedPoints * 0.65)} pts · Ceiling: {form.projectedCeiling || Math.round(form.projectedPoints * 1.35)} pts
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                        {/* Past Performance Model */}
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-wider text-sky-400 block">
                            Past Performance Tracking
                          </span>
                          <p className="text-slate-300">
                            Tournament Historical Average: <strong className="text-white">{form.pastPointsAvg || form.recentAvg} pts</strong>
                          </p>
                          <p className="text-slate-400">
                            Recent trajectory: [{form.recentScores.join(', ')}] pts with {form.trend.toUpperCase()} momentum ({form.momentumScore > 0 ? '+' : ''}{form.momentumScore}%).
                          </p>
                        </div>

                        {/* Future Performance Projection */}
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 block">
                            Future Match Outlook & Adaptation
                          </span>
                          <p className="text-slate-300">
                            Sheikh Zayed Pitch Fit: <strong className="text-emerald-400">{form.pitchSuitability}</strong> (+{form.futurePitchBoost || 10} pts boost)
                          </p>
                          <p className="text-slate-400">
                            Tactical Role: {form.matchupNote}. Projected ceiling of {form.projectedCeiling || Math.round(form.projectedPoints * 1.35)} pts in T10 format.
                          </p>
                        </div>
                      </div>

                      {form.adaptationSummary && (
                        <p className="text-[11px] text-slate-400 italic bg-slate-900/40 p-2 rounded-lg border border-slate-800/50">
                          {form.adaptationSummary}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <section>
          <SectionTitle title={t('Choose captain and vice-captain')} />
          <p className="text-sm text-slate-400 mb-3">
            {t('Captain scores {c}x points, vice-captain {vc}x.', {
              c: rules.captainMultiplier,
              vc: rules.viceCaptainMultiplier,
            })}
          </p>

          <div className="space-y-1.5" data-testid="captain-list">
            {chosen.map(p => {
              const form = p.form;
              return (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <Avatar name={p.name} src={p.photoUrl} size={36} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white truncate">
                      {p.name} {form?.tier === 'star' && <span className="text-amber-400 text-xs">⭐</span>}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span className="font-bold text-slate-300">{teamById(p.teamId)?.short}</span>
                      <span>·</span>
                      <span className={cx('rounded px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider border', ROLE_INFO[p.role].badgeBg, ROLE_INFO[p.role].badgeBorder, ROLE_INFO[p.role].badgeText)}>
                        {ROLE_INFO[p.role].short} · {ROLE_INFO[p.role].singular}
                      </span>
                      <span>·</span>
                      <span>Proj: <strong className="text-amber-400">{form?.projectedPoints || 45} pts</strong></span>
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptain(p.id);
                      if (vice === p.id) setVice('');
                    }}
                    className={cx(
                      'w-11 h-11 rounded-full font-black text-sm border transition-all',
                      captain === p.id
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]'
                        : 'border-slate-600 text-slate-300 hover:border-slate-400'
                    )}
                    aria-pressed={captain === p.id}
                    aria-label={t('Make {name} captain', { name: p.name })}
                    data-role="captain"
                  >
                    C
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVice(p.id);
                      if (captain === p.id) setCaptain('');
                    }}
                    className={cx(
                      'w-11 h-11 rounded-full font-black text-xs border transition-all',
                      vice === p.id
                        ? 'bg-sky-400 text-slate-950 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.6)]'
                        : 'border-slate-600 text-slate-300 hover:border-slate-400'
                    )}
                    aria-pressed={vice === p.id}
                    aria-label={t('Make {name} vice-captain', { name: p.name })}
                    data-role="vice"
                  >
                    VC
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Floating Bottom Action Bar */}
      <div className="fixed bottom-[calc(58px+env(safe-area-inset-bottom))] lg:bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          {step === 'pick' ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setPicked([]);
                  setCaptain('');
                  setVice('');
                }}
                disabled={!picked.length}
                aria-label={t('Clear')}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              {data.fantasyTeam && (
                <Button variant="ghost" onClick={remove} aria-label={t('Delete team')}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <span className="flex-1 text-xs text-slate-400">
                {complete ? (
                  <span className="text-emerald-400 font-bold inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('Balanced Squad (11/11) · {credits} credits · {pts} Proj Pts', { credits: totalCreditsUsed, pts: totalSquadProj })}
                  </span>
                ) : isSquadComplete && !isUnderBudget ? (
                  <span className="text-rose-400 font-bold inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('Over budget ({credits}/{max} credits). Swap top stars for budget enablers.', { credits: totalCreditsUsed, max: budgetLimit })}
                  </span>
                ) : isSquadComplete && !isTopLimitOk ? (
                  <span className="text-amber-400 font-bold inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('Max {max} stars allowed ({count} picked). Balance with mediocre players.', { max: maxTop, count: topCount })}
                  </span>
                ) : isSquadComplete && !isSquadBalanced ? (
                  <span className="text-amber-400 font-bold inline-flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {t('Need at least 1 {roles} for balance', {
                      roles: missingRoles.map(r => ROLE_INFO[r].singular).join(', '),
                    })}
                  </span>
                ) : (
                  <span>
                    {t('{n} more to pick ({cur}/{size}) · {rem} credits left', {
                      n: rules.size - picked.length,
                      cur: picked.length,
                      size: rules.size,
                      rem: remainingCredits.toFixed(1),
                    })}
                    {missingRoles.length > 0 && (
                      <span className="text-amber-400/90 ml-1.5 font-medium">
                        · {t('Need: {roles}', { roles: missingRoles.map(r => ROLE_INFO[r].short).join(', ') })}
                      </span>
                    )}
                  </span>
                )}
              </span>
              {complete && captain && vice ? (
                <Button
                  disabled={!complete}
                  loading={saving}
                  onClick={save}
                  data-testid="xi-quick-save"
                  className={cx(
                    'transition-all duration-300 font-bold cursor-pointer',
                    justSaved ? '!bg-emerald-500 !text-slate-950 hover:!bg-emerald-400 !border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.7)] scale-105' : ''
                  )}
                >
                  {justSaved ? (
                    <span className="inline-flex items-center gap-1.5 font-black text-slate-950 animate-in zoom-in-75 duration-300">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-slate-950" />
                      {t('Squad Saved!')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      {t('Submit Team')}
                    </span>
                  )}
                </Button>
              ) : (
                <Button disabled={!complete} onClick={() => setStep('captain')} data-testid="xi-next">
                  {t('Next')}: {t('captain')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep('pick')}>
                <ChevronLeft className="w-4 h-4 rtl-flip" /> {t('Players')}
              </Button>
              <span className="flex-1 text-xs text-slate-400 inline-flex items-center gap-1">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                {captain ? byId.get(captain)?.name : t('pick a captain')}
              </span>
              <Button
                disabled={!captain || !vice || !complete}
                loading={saving}
                onClick={save}
                data-testid="xi-save"
                className={cx(
                  'transition-all duration-300 font-bold cursor-pointer',
                  justSaved ? '!bg-emerald-500 !text-slate-950 hover:!bg-emerald-400 !border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.7)] scale-105' : ''
                )}
              >
                {justSaved ? (
                  <span className="inline-flex items-center gap-1.5 font-black text-slate-950 animate-in zoom-in-75 duration-300">
                    <CheckCircle2 className="w-4 h-4 stroke-[2.5] text-slate-950" />
                    {t('Squad Saved!')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> {t('Submit Team "{name}"', { name: variationName })}
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Historical Performance Metrics Popover Modal */}
      {(() => {
        const infoPlayer = infoPlayerId ? byId.get(infoPlayerId) : null;
        if (!infoPlayer) return null;
        const hist = infoPlayer.form?.historicalMetrics;
        const tm = teamById(infoPlayer.teamId);
        const rConf = ROLE_INFO[infoPlayer.role];
        const RIcon = rConf.icon;

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setInfoPlayerId(null)}
          >
            <div
              className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/90 space-y-4 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <Avatar name={infoPlayer.name} src={infoPlayer.photoUrl} size={48} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-white">{infoPlayer.name}</h3>
                      {(infoPlayer.form?.tier === 'star' || isTop(infoPlayer)) && (
                        <span className="text-amber-400 text-sm" title="Star / Marquee Player">⭐</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <TeamBadge team={tm} size="xs" />
                      <span className="font-bold text-slate-300">{tm?.name}</span>
                      <span>·</span>
                      <span className={cx('font-bold inline-flex items-center gap-1', rConf.badgeText)}>
                        <RIcon className="w-3 h-3" />
                        {rConf.singular}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoPlayerId(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Fantasy Cost & Valuation Bar */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-slate-950/70 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Cost (Credits)</span>
                  <span className="text-base font-black text-white tabular-nums">{infoPlayer.credits ?? 8.0} <span className="text-xs text-slate-400 font-semibold">{t('credits')}</span></span>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Base Proj.</span>
                  <span className="text-base font-black text-amber-300 tabular-nums">{infoPlayer.form?.projectedPoints || 70} <span className="text-xs text-slate-400 font-normal">pts</span></span>
                </div>
                <div className="rounded-xl bg-slate-950/70 p-2.5 border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Avg Pts / Match</span>
                  <span className="text-base font-black text-emerald-400 tabular-nums">{hist?.avgPointsPerMatch || infoPlayer.form?.pastPointsAvg || infoPlayer.form?.recentAvg || 65}</span>
                </div>
              </div>

              {/* Historical Performance Metrics Grid */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 mb-2 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  {t('Historical Performance Metrics')}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{t('Matches')}</span>
                    <span className="text-sm font-black text-white">{hist?.matches || 22}</span>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{t('Total Runs')}</span>
                    <span className="text-sm font-black text-sky-300">{hist?.totalRuns || 0}</span>
                    <span className="text-[9px] text-slate-500 block">HS: {hist?.highestScore || 0}</span>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{t('Strike Rate')}</span>
                    <span className="text-sm font-black text-amber-300">{hist?.strikeRate || 0}</span>
                    <span className="text-[9px] text-slate-500 block">Avg: {hist?.battingAvg || 0}</span>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">{t('Wickets')}</span>
                    <span className="text-sm font-black text-emerald-300">{hist?.totalWickets || 0}</span>
                    <span className="text-[9px] text-slate-500 block">Econ: {hist?.economy || 0}</span>
                  </div>
                </div>
              </div>

              {/* Additional Historical Breakdown: Boundaries, Catches, Stumpings */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{t('Boundaries')}</span>
                  <span className="text-xs font-black text-slate-200">
                    {hist?.boundaryCount || 0} 4s · {hist?.sixCount || 0} 6s
                  </span>
                </div>
                <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{t('Fielding')}</span>
                  <span className="text-xs font-black text-slate-200">
                    {hist?.catches || 0} catches {hist?.stumpings ? `· ${hist.stumpings} stumpings` : ''}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-950/50 p-2 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{t('Best Bowling')}</span>
                  <span className="text-xs font-black text-slate-200">
                    {hist?.bestBowling || '—'}
                  </span>
                </div>
              </div>

              {/* Form Trajectory & Pitch Fit */}
              <div className="rounded-xl bg-slate-950/60 p-3 border border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">{t('Recent Match Scores')}:</span>
                  <div className="flex items-center gap-1">
                    {(infoPlayer.form?.recentScores || []).map((sc, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-200">
                        {sc}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>{t('Pitch Suitability')}:</span>
                  <strong className="text-emerald-400">{infoPlayer.form?.pitchSuitability}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>{t('Match Context')}:</span>
                  <span className="text-slate-300 font-medium truncate max-w-[200px]">{infoPlayer.form?.matchupNote}</span>
                </div>
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <Button variant="ghost" size="sm" onClick={() => setInfoPlayerId(null)}>
                  {t('Close')}
                </Button>
                <Button
                  size="sm"
                  variant={picked.includes(infoPlayer.id) ? 'danger' : 'primary'}
                  onClick={() => {
                    toggle(infoPlayer);
                    setInfoPlayerId(null);
                  }}
                >
                  {picked.includes(infoPlayer.id) ? t('Remove from Squad') : t('Add to Squad')}
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
