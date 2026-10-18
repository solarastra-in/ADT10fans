import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Check,
  ChevronLeft,
  Crown,
  Flame,
  Layers,
  Lock,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
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
import type { LineupPreset, Player, PlayerRole, PlayerWithForm } from '../types';

const ROLES: PlayerRole[] = ['wicketkeeper', 'batter', 'allrounder', 'bowler'];

export default function FantasyMatchPage({ id }: { id: string }) {
  const { user, teamById, openAuth, toast, setUser, config } = useApp();
  const t = useT();
  const { data, error, loading, reload } = useLoad(() => api.getFantasy(id), [id, user?.id]);
  const [picked, setPicked] = useState<string[]>([]);
  const [captain, setCaptain] = useState('');
  const [vice, setVice] = useState('');
  const [variationId, setVariationId] = useState('var-1');
  const [variationName, setVariationName] = useState('Team 1');
  const [step, setStep] = useState<'pick' | 'captain'>('pick');
  const [role, setRole] = useState<'all' | PlayerRole>('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const m = data?.match;
  const a = teamById(m?.teamA);
  const b = teamById(m?.teamB);
  usePageMeta(
    m ? t('Dream XI: {a} vs {b}', { a: a?.name || '', b: b?.name || '' }) : null,
    t('Pick 11 players within 100 credits. 3–4 Star players recommended. Captain scores double.'),
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
      setVariationName(data.fantasyTeam.variationName || 'Team 1');
    }
  }, [data?.fantasyTeam]);

  const pool = (data?.pool || []) as PlayerWithForm[];
  const rules = data?.rules;
  const byId = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);
  const chosen = picked.map(pid => byId.get(pid)).filter(Boolean) as PlayerWithForm[];
  const credits = Math.round(chosen.reduce((s, p) => s + (p.credits || 0), 0) * 10) / 10;
  const perTeam = (tid?: string) => chosen.filter(p => p.teamId === tid).length;
  const perRole = (r: PlayerRole) => chosen.filter(p => p.role === r).length;
  const starCount = chosen.filter(p => p.form?.tier === 'star').length;

  if (loading && !data) return <Spinner />;
  if (error || !data || !m || !rules) return <ErrorBox message={error || t('Match not found')} onRetry={reload} />;

  const why = (p: PlayerWithForm): string | null => {
    if (picked.includes(p.id)) return null;
    if (picked.length >= rules.size) return t('Your XI is full');
    if (credits + (p.credits || 0) > rules.creditCap) return t('Not enough credits');
    if (perTeam(p.teamId) >= rules.maxFromOneTeam) return t('Max {n} from one team', { n: rules.maxFromOneTeam });
    if (perRole(p.role) >= rules.roleMax) return t('Max {n} {role}s', { n: rules.roleMax, role: t(ROLE_LABEL[p.role]).toLowerCase() });
    const remaining = rules.size - picked.length - 1;
    const missingRoles = ROLES.filter(r => r !== p.role && perRole(r) === 0).length;
    if (missingRoles > remaining) return t('Leave room for every role');
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
      setVariationName(target.variationName || `Team ${vId.replace('var-', '')}`);
      setStep('pick');
      toast(t('Loaded variation: {name}', { name: target.variationName || vId }));
    }
  };

  const handleCreateNewVariation = () => {
    const nextSlot = savedTeams.length + 1;
    const newId = `var-${nextSlot}`;
    setVariationId(newId);
    setVariationName(`Team ${nextSlot}`);
    setPicked([]);
    setCaptain('');
    setVice('');
    setStep('pick');
    toast(t('New team slot {name} created. Pick your 11 or select a smart preset!', { name: `Team ${nextSlot}` }));
  };

  const handleApplyPreset = (preset: LineupPreset) => {
    setPicked(preset.playerIds);
    setCaptain(preset.captainId);
    setVice(preset.viceCaptainId);
    setVariationName(preset.name);
    setStep('pick');
    toast(t('Applied "{name}" preset ({stars} stars, {cr} cr). Customize or save!', {
      name: preset.name,
      stars: preset.starCount,
      cr: preset.totalCredits,
    }));
  };

  const save = async () => {
    if (!user) return openAuth(t('Sign in to save your Dream XI.'));
    setSaving(true);
    setErr(null);
    try {
      const r = await api.submitFantasy(m.id, picked, captain, vice, variationId, variationName);
      setUser(r.user);
      toast(t('Dream XI variation "{name}" saved and persisted.', { name: variationName }));
      reload();
      setStep('pick');
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
    .filter(p => (role === 'all' || p.role === role) && (teamFilter === 'all' || p.teamId === teamFilter))
    .sort((x, y) => (y.credits || 0) - (x.credits || 0) || x.name.localeCompare(y.name));
  const complete = picked.length === rules.size;

  return (
    <div className="space-y-4 pb-24">
      <Link to="/fantasy" className="text-xs text-slate-500 hover:text-white inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4 rtl-flip" /> {t('Dream XI')}
      </Link>
      {header}

      {/* Variation Switcher & Manager Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 p-2.5 border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-300 inline-flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            {t('Variation')}:
          </span>
          <input
            type="text"
            value={variationName}
            onChange={e => setVariationName(e.target.value)}
            className="rounded bg-slate-950 px-2.5 py-1 font-bold text-white border border-slate-700 focus:border-amber-400 focus:outline-none max-w-[150px]"
            placeholder="e.g. Team 1"
          />
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
                  'rounded-lg px-2.5 py-1 font-bold text-xs transition-all border',
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

      {/* Real-time counters: Players, Credits, 3-4 Stars, and Team distributions */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center" data-testid="xi-counters">
        <Card className="p-2">
          <p className="text-lg font-black text-white tabular-nums">{picked.length}/{rules.size}</p>
          <p className="text-[11px] text-slate-400">{t('Players')}</p>
        </Card>
        <Card className="p-2">
          <p className={cx('text-lg font-black tabular-nums', credits > rules.creditCap ? 'text-red-400' : 'text-amber-400')}>
            {(rules.creditCap - credits).toFixed(1)}
          </p>
          <p className="text-[11px] text-slate-400">{t('Credits left')}</p>
        </Card>
        <Card className="p-2 col-span-2 sm:col-span-1">
          <p className={cx('text-lg font-black tabular-nums', starCount >= 3 && starCount <= 4 ? 'text-emerald-400' : starCount > 4 ? 'text-amber-400' : 'text-sky-300')}>
            {starCount}/4 ⭐
          </p>
          <p className="text-[11px] text-slate-400">{t('3–4 Stars (Optimal)')}</p>
        </Card>
        <Card className="p-2">
          <p className="text-lg font-black text-white tabular-nums">{perTeam(m.teamA)}</p>
          <p className="text-[11px] text-slate-400">{a?.short}</p>
        </Card>
        <Card className="p-2">
          <p className="text-lg font-black text-white tabular-nums">{perTeam(m.teamB)}</p>
          <p className="text-[11px] text-slate-400">{b?.short}</p>
        </Card>
      </div>

      {/* Role balance chips */}
      <div className="flex gap-1.5 flex-wrap">
        {ROLES.map(r => (
          <span
            key={r}
            className={cx(
              'px-2 py-1 rounded-lg text-[11px] font-bold border',
              perRole(r) >= rules.roleMin
                ? 'border-emerald-500/40 text-emerald-300'
                : 'border-slate-700 text-slate-400'
            )}
          >
            {ROLE_SHORT[r]} {perRole(r)}
          </span>
        ))}
        <span className="text-[11px] text-slate-500 self-center">{t('1–{max} of each role', { max: rules.roleMax })}</span>
      </div>

      {step === 'pick' ? (
        <>
          <Tabs
            value={role}
            onChange={setRole as any}
            items={[{ id: 'all', label: t('All') }, ...ROLES.map(r => ({ id: r, label: `${ROLE_SHORT[r]} (${perRole(r)})` }))]}
          />
          <Tabs
            value={teamFilter}
            onChange={setTeamFilter}
            items={[{ id: 'all', label: t('Both teams') }, { id: m.teamA, label: a?.short || m.teamA }, { id: m.teamB, label: b?.short || m.teamB }]}
          />

          <div className="space-y-1.5" data-testid="player-pool">
            {visible.map(p => {
              const on = picked.includes(p.id);
              const blocked = !on && Boolean(why(p));
              const tm = teamById(p.teamId);
              const form = p.form;
              const isStar = form?.tier === 'star';

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  className={cx(
                    'w-full flex items-center gap-3 p-2.5 rounded-xl border text-start transition-colors min-h-[64px]',
                    on
                      ? 'bg-amber-400/10 border-amber-400/60'
                      : blocked
                      ? 'bg-slate-950/40 border-slate-900 opacity-50'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-600'
                  )}
                  data-player={p.id}
                  aria-pressed={on}
                >
                  <Avatar name={p.name} src={p.photoUrl} size={40} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-white truncate">{p.name}</span>
                      {isStar && (
                        <span className="rounded bg-amber-400/20 px-1.5 py-0.2 text-[9px] font-black text-amber-300">
                          ⭐ Star
                        </span>
                      )}
                      {form?.trend === 'hot' && (
                        <span className="rounded bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 text-[9px] font-bold inline-flex items-center gap-0.5">
                          <Flame className="w-2.5 h-2.5" /> +{form.momentumScore}%
                        </span>
                      )}
                      {form?.trend === 'rising' && (
                        <span className="rounded bg-sky-500/20 text-sky-300 px-1.5 py-0.2 text-[9px] font-bold inline-flex items-center gap-0.5">
                          <TrendingUp className="w-2.5 h-2.5" /> +{form.momentumScore}%
                        </span>
                      )}
                      {form?.trend === 'cold' && (
                        <span className="rounded bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 text-[9px] font-bold inline-flex items-center gap-0.5">
                          <TrendingDown className="w-2.5 h-2.5" /> Value Dip
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate mt-0.5">
                      <span className="inline-flex items-center gap-1.5">
                        <TeamBadge team={tm} size="xs" />
                        {tm?.short} · {ROLE_SHORT[p.role]}
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
                  </div>

                  {/* Credits & Projected Points */}
                  <div className="flex flex-col items-end text-end min-w-[50px]">
                    <span className="text-sm font-black text-slate-200 tabular-nums">{p.credits} cr</span>
                    {form?.projectedPoints && (
                      <span className="text-[10px] text-amber-400/90 font-bold tabular-nums">
                        Proj: {form.projectedPoints}
                      </span>
                    )}
                  </div>

                  {/* Add / Remove button */}
                  <span
                    className={cx(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform',
                      on ? 'bg-amber-400 text-slate-950 scale-105' : 'bg-slate-800 text-slate-300'
                    )}
                  >
                    {on ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </span>
                </button>
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
                    <span className="block text-[11px] text-slate-400">
                      {teamById(p.teamId)?.short} · {ROLE_SHORT[p.role]} · Proj: <strong className="text-amber-400">{form?.projectedPoints || 45} pts</strong>
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
                  <span className="text-emerald-400 font-bold">XI complete · {starCount} Stars</span>
                ) : (
                  t('{n} more to pick', { n: rules.size - picked.length })
                )}
              </span>
              <Button disabled={!complete || credits > rules.creditCap} onClick={() => setStep('captain')} data-testid="xi-next">
                {t('Next')}: {t('captain')}
              </Button>
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
              <Button disabled={!captain || !vice} loading={saving} onClick={save} data-testid="xi-save">
                <Check className="w-4 h-4" /> {t('Save "{name}"', { name: variationName })}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
