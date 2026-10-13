import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, Crown, Lock, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta } from '../router';
import { Avatar, Button, Card, Countdown, ErrorBox, Notice, Pill, SectionTitle, Spinner, Tabs, TeamBadge, cx, ROLE_SHORT, ROLE_LABEL } from '../components/ui';
import type { Player, PlayerRole } from '../types';

const ROLES: PlayerRole[] = ['wicketkeeper', 'batter', 'allrounder', 'bowler'];

export default function FantasyMatchPage({ id }: { id: string }) {
  const { user, teamById, openAuth, toast, setUser, config } = useApp();
  const t = useT();
  const { data, error, loading, reload } = useLoad(() => api.getFantasy(id), [id, user?.id]);
  const [picked, setPicked] = useState<string[]>([]);
  const [captain, setCaptain] = useState('');
  const [vice, setVice] = useState('');
  const [step, setStep] = useState<'pick' | 'captain'>('pick');
  const [role, setRole] = useState<'all' | PlayerRole>('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const m = data?.match;
  const a = teamById(m?.teamA);
  const b = teamById(m?.teamB);
  usePageMeta(m ? t('Dream XI: {a} vs {b}', { a: a?.name || '', b: b?.name || '' }) : null, t('Pick 11 players within 100 credits. Captain scores double.'), config?.brandName);

  useEffect(() => {
    if (data?.fantasyTeam) {
      setPicked(data.fantasyTeam.playerIds);
      setCaptain(data.fantasyTeam.captainId);
      setVice(data.fantasyTeam.viceCaptainId || '');
    }
  }, [data?.fantasyTeam]);

  const pool = data?.pool || [];
  const rules = data?.rules;
  const byId = useMemo(() => new Map(pool.map(p => [p.id, p])), [pool]);
  const chosen = picked.map(pid => byId.get(pid)).filter(Boolean) as Player[];
  const credits = Math.round(chosen.reduce((s, p) => s + (p.credits || 0), 0) * 10) / 10;
  const perTeam = (tid?: string) => chosen.filter(p => p.teamId === tid).length;
  const perRole = (r: PlayerRole) => chosen.filter(p => p.role === r).length;

  if (loading && !data) return <Spinner />;
  if (error || !data || !m || !rules) return <ErrorBox message={error || t('Match not found')} onRetry={reload} />;

  const why = (p: Player): string | null => {
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

  const toggle = (p: Player) => {
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

  const save = async () => {
    if (!user) return openAuth(t('Sign in to save your Dream XI.'));
    setSaving(true);
    setErr(null);
    try {
      const r = await api.submitFantasy(m.id, picked, captain, vice);
      setUser(r.user);
      toast(t('Dream XI saved. You can change it until the first ball.'));
      reload();
      setStep('pick');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(t('Delete your Dream XI for this match?'))) return;
    await api.deleteFantasy(m.id);
    setPicked([]);
    setCaptain('');
    setVice('');
    reload();
  };

  const header = (
    <Card className="p-4 flex items-center gap-3">
      <TeamBadge team={a} size="sm" />
      <span className="font-black text-white text-sm truncate">{a?.short} vs {b?.short}</span>
      <TeamBadge team={b} size="sm" />
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
        <Link to="/fantasy" className="text-xs text-slate-500 hover:text-white inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4 rtl-flip" /> {t('Dream XI')}</Link>
        {header}
        {!ft ? (
          <Notice>{t('Lineups are locked for this match and you did not pick a team.')}</Notice>
        ) : (
          <Card>
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-black text-white">{t('Your Dream XI')}</span>
              {ft.points !== undefined && ft.scoredAt ? <span className="font-black text-amber-400">{t('{n} pts', { n: ft.points })} · #{ft.rank}</span> : <Pill>{t('Waiting for the result')}</Pill>}
            </div>
            <div className="divide-y divide-slate-800">
              {(ft.breakdown || ft.playerIds.map(pid => ({ playerId: pid, name: byId.get(pid)?.name || pid, base: 0, multiplier: pid === ft.captainId ? 2 : pid === ft.viceCaptainId ? 1.5 : 1, total: 0, detail: '' }))).map(line => (
                <div key={line.playerId} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={line.name} src={byId.get(line.playerId)?.photoUrl} size={32} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white truncate">
                      {line.name} {line.playerId === ft.captainId && <Pill tone="amber">C</Pill>} {line.playerId === ft.viceCaptainId && <Pill tone="blue">VC</Pill>}
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
      <Link to="/fantasy" className="text-xs text-slate-500 hover:text-white inline-flex items-center gap-1"><ChevronLeft className="w-4 h-4 rtl-flip" /> {t('Dream XI')}</Link>
      {header}
      {!user && <Notice>{t('You can build a team now; sign in to save it.')}</Notice>}
      {err && <ErrorBox message={err} />}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center" data-testid="xi-counters">
        <Card className="p-2"><p className="text-lg font-black text-white tabular-nums">{picked.length}/{rules.size}</p><p className="text-[11px] text-slate-400">{t('Players')}</p></Card>
        <Card className="p-2"><p className={cx('text-lg font-black tabular-nums', credits > rules.creditCap ? 'text-red-400' : 'text-amber-400')}>{(rules.creditCap - credits).toFixed(1)}</p><p className="text-[11px] text-slate-400">{t('Credits left')}</p></Card>
        <Card className="p-2"><p className="text-lg font-black text-white tabular-nums">{perTeam(m.teamA)}</p><p className="text-[11px] text-slate-400">{a?.short}</p></Card>
        <Card className="p-2"><p className="text-lg font-black text-white tabular-nums">{perTeam(m.teamB)}</p><p className="text-[11px] text-slate-400">{b?.short}</p></Card>
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {ROLES.map(r => (
          <span key={r} className={cx('px-2 py-1 rounded-lg text-[11px] font-bold border', perRole(r) >= rules.roleMin ? 'border-emerald-500/40 text-emerald-300' : 'border-slate-700 text-slate-400')}>
            {ROLE_SHORT[r]} {perRole(r)}
          </span>
        ))}
        <span className="text-[11px] text-slate-500 self-center">{t('1–{max} of each role', { max: rules.roleMax })}</span>
      </div>

      {step === 'pick' ? (
        <>
          <Tabs value={role} onChange={setRole as any} items={[{ id: 'all', label: t('All') }, ...ROLES.map(r => ({ id: r, label: `${ROLE_SHORT[r]} (${perRole(r)})` }))]} />
          <Tabs value={teamFilter} onChange={setTeamFilter} items={[{ id: 'all', label: t('Both teams') }, { id: m.teamA, label: a?.short || m.teamA }, { id: m.teamB, label: b?.short || m.teamB }]} />
          <div className="space-y-1.5" data-testid="player-pool">
            {visible.map(p => {
              const on = picked.includes(p.id);
              const blocked = !on && Boolean(why(p));
              const tm = teamById(p.teamId);
              return (
                <button key={p.id} type="button" onClick={() => toggle(p)} className={cx('w-full flex items-center gap-3 p-2.5 rounded-xl border text-start transition-colors min-h-[56px]', on ? 'bg-amber-400/10 border-amber-400/60' : blocked ? 'bg-slate-950/40 border-slate-900 opacity-50' : 'bg-slate-900/80 border-slate-800 hover:border-slate-600')} data-player={p.id} aria-pressed={on}>
                  <Avatar name={p.name} src={p.photoUrl} size={38} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      <span className="inline-block w-2 h-2 rounded-full me-1 align-middle" style={{ background: tm?.color }} />
                      {tm?.short} · {ROLE_SHORT[p.role]}{p.category ? ` · ${p.category}` : ''}{typeof p.selectedBy === 'number' && data.lineups > 0 ? ` · ${t('{pct}% picked', { pct: p.selectedBy })}` : ''}
                    </span>
                  </span>
                  <span className="text-sm font-black text-slate-200 tabular-nums w-10 text-end">{p.credits}</span>
                  <span className={cx('w-9 h-9 rounded-full flex items-center justify-center shrink-0', on ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300')}>
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
          <p className="text-sm text-slate-400 mb-3">{t('Captain scores {c}x points, vice-captain {vc}x.', { c: rules.captainMultiplier, vc: rules.viceCaptainMultiplier })}</p>
          <div className="space-y-1.5" data-testid="captain-list">
            {chosen.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                <Avatar name={p.name} src={p.photoUrl} size={36} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                  <span className="block text-[11px] text-slate-400">{teamById(p.teamId)?.short} · {ROLE_SHORT[p.role]}</span>
                </span>
                <button type="button" onClick={() => { setCaptain(p.id); if (vice === p.id) setVice(''); }} className={cx('w-11 h-11 rounded-full font-black text-sm border', captain === p.id ? 'bg-amber-400 text-slate-950 border-amber-400' : 'border-slate-600 text-slate-300')} aria-pressed={captain === p.id} aria-label={t('Make {name} captain', { name: p.name })} data-role="captain">
                  C
                </button>
                <button type="button" onClick={() => { setVice(p.id); if (captain === p.id) setCaptain(''); }} className={cx('w-11 h-11 rounded-full font-black text-xs border', vice === p.id ? 'bg-sky-400 text-slate-950 border-sky-400' : 'border-slate-600 text-slate-300')} aria-pressed={vice === p.id} aria-label={t('Make {name} vice-captain', { name: p.name })} data-role="vice">
                  VC
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="fixed bottom-[calc(58px+env(safe-area-inset-bottom))] lg:bottom-0 inset-x-0 z-30 bg-slate-950/95 backdrop-blur border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2">
          {step === 'pick' ? (
            <>
              <Button variant="ghost" onClick={() => { setPicked([]); setCaptain(''); setVice(''); }} disabled={!picked.length} aria-label={t('Clear')}>
                <RotateCcw className="w-4 h-4" />
              </Button>
              {data.fantasyTeam && (
                <Button variant="ghost" onClick={remove} aria-label={t('Delete team')}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              <span className="flex-1 text-xs text-slate-400">{complete ? t('XI complete') : t('{n} more to pick', { n: rules.size - picked.length })}</span>
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
                <Crown className="w-3.5 h-3.5 text-amber-400" /> {captain ? byId.get(captain)?.name : t('pick a captain')}
              </span>
              <Button disabled={!captain || !vice} loading={saving} onClick={save} data-testid="xi-save">
                <Check className="w-4 h-4" /> {t('Save team')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
