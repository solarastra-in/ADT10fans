import React, { useState } from 'react';
import { Copy, LogOut, Plus, Trophy, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, Button, Card, Countdown, EmptyState, ErrorBox, Field, Notice, PageHeader, Pill, SectionTitle, Spinner, Tabs, TeamBadge, inputCls, cx, useFormat } from '../components/ui';
import type { LeaderRow } from '../types';

function Standings({ rows, meId }: { rows: LeaderRow[]; meId?: string }) {
  const { teamById } = useApp();
  const t = useT();
  if (!rows.length) return <p className="text-sm text-slate-400 p-4">{t('No scored matches yet.')}</p>;
  return (
    <div className="divide-y divide-slate-800">
      {rows.map(r => (
        <div key={r.userId} className={cx('flex items-center gap-3 px-4 py-2.5', r.userId === meId && 'bg-amber-400/5')}>
          <span className="w-7 text-center font-black text-slate-500 tabular-nums">{r.rank}</span>
          <Avatar name={r.name} src={r.avatar} size={30} />
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-bold text-white truncate">{r.name}</span>
            {r.teamId && <span className="text-[11px] text-slate-500">{teamById(r.teamId)?.short}</span>}
          </span>
          {r.matches !== undefined && <span className="text-[11px] text-slate-500">{t('{n} matches', { n: r.matches })}</span>}
          <span className="w-16 text-end font-black text-amber-400 tabular-nums">{r.points}</span>
        </div>
      ))}
    </div>
  );
}

export default function FantasyPage() {
  const { user, teamById, openAuth, toast, config } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Dream XI fantasy cricket'), t('Pick 11 players for every Abu Dhabi T10 match within 100 credits. Free to play.'), config?.brandName);
  const hub = useLoad(() => api.getFantasyHub(), [user?.id]);
  const board = useLoad(() => api.getFantasyLeaderboard(), []);
  const leagues = useLoad(() => (user ? api.getLeagues() : Promise.resolve({ leagues: [] })), [user?.id]);
  const [tab, setTab] = useState<'matches' | 'season' | 'leagues'>('matches');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (hub.loading && !hub.data) return <Spinner />;
  if (hub.error) return <ErrorBox message={hub.error} onRetry={hub.reload} />;
  const rules = hub.data!.rules;
  const matches = hub.data!.matches;
  const open = matches.filter(m => !m.locked);
  const closed = matches.filter(m => m.locked).reverse();

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.createLeague(name);
      toast(t('League created. Share the code {code} with friends.', { code: r.league.code }));
      setName('');
      leagues.reload();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.joinLeague(code);
      toast(r.already ? t('You are already in {name}', { name: r.league.name }) : t('You joined {name}', { name: r.league.name }));
      setCode('');
      leagues.reload();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const matchRow = (m: (typeof matches)[number]) => {
    const a = teamById(m.teamA);
    const b = teamById(m.teamB);
    return (
      <Link key={m.matchId} to={`/fantasy/${m.matchId}`} className="block" data-testid="fantasy-match">
        <Card className="p-4 flex items-center gap-3 hover:border-slate-600">
          <div className="flex -space-x-2 rtl:space-x-reverse">
            <TeamBadge team={a} size="sm" />
            <TeamBadge team={b} size="sm" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {a?.short} vs {b?.short} · {t('Match {n}', { n: m.matchNo })}
            </p>
            <p className="text-[11px] text-slate-400">
              {m.locked ? (m.status === 'completed' ? t('Completed') : t('Locked')) : <><Countdown to={m.startsAt} prefix="locks in {time}" /> · {f.dateTime(m.startsAt)}</>} · {t('{n} teams', { n: m.lineups })}
            </p>
          </div>
          {m.mine?.points !== null && m.mine?.points !== undefined ? (
            <span className="text-end">
              <span className="block font-black text-amber-400">{t('{n} pts', { n: m.mine.points })}</span>
              <span className="block text-[11px] text-slate-400">#{m.mine.rank}</span>
            </span>
          ) : m.mine?.saved ? (
            <Pill tone="green">
              {m.mine.variationsCount && m.mine.variationsCount > 1
                ? t('{n} variations', { n: m.mine.variationsCount })
                : m.locked ? t('Waiting for result') : t('Saved')}
            </Pill>
          ) : !m.locked ? (
            <Pill tone="amber">{t('Pick XI')}</Pill>
          ) : null}
        </Card>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Fantasy')}
        title={t('Dream XI')}
        subtitle={t('Pick {size} players from the two teams within {cap} credits, at most {max} from one team. Captain scores {c}x, vice-captain {vc}x. Lineups lock at the first ball.', { size: rules.size, cap: rules.creditCap, max: rules.maxFromOneTeam, c: rules.captainMultiplier, vc: rules.viceCaptainMultiplier })}
        actions={<Link to="/rules#dream-xi" className="text-sm font-bold text-amber-400">{t('Scoring rules')}</Link>}
      />
      {hub.data!.season && (
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3"><p className="text-xl font-black text-amber-400">{hub.data!.season.points}</p><p className="text-[11px] text-slate-400">{t('Season Dream XI points')}</p></Card>
          <Card className="p-3"><p className="text-xl font-black text-white">{hub.data!.season.matches}</p><p className="text-[11px] text-slate-400">{t('Matches played')}</p></Card>
          <Card className="p-3"><p className="text-xl font-black text-white">{hub.data!.season.best}</p><p className="text-[11px] text-slate-400">{t('Best score')}</p></Card>
        </div>
      )}
      <Tabs value={tab} onChange={setTab} items={[{ id: 'matches', label: t('Matches') }, { id: 'season', label: t('Season standings') }, { id: 'leagues', label: t('Private leagues') }]} />

      {tab === 'matches' &&
        (matches.length === 0 ? (
          <EmptyState icon={<Trophy className="w-6 h-6" />} title={t('Dream XI opens with the fixtures')} body={t('As soon as the league publishes fixtures you can pick a team for every match. The season starts on {date}.', { date: f.date(config?.seasonStart, { day: 'numeric', month: 'long' }) })} action={<Link to="/players" className="text-sm font-bold text-amber-400">{t('Study the players')} →</Link>} />
        ) : (
          <div className="space-y-6">
            {open.length > 0 && (
              <section>
                <SectionTitle title={t('Open for picks')} />
                <div className="space-y-2">{open.map(matchRow)}</div>
              </section>
            )}
            {closed.length > 0 && (
              <section>
                <SectionTitle title={t('Locked and completed')} />
                <div className="space-y-2">{closed.map(matchRow)}</div>
              </section>
            )}
          </div>
        ))}

      {tab === 'season' && <Card>{board.loading ? <Spinner /> : <Standings rows={board.data?.rows || []} meId={user?.id} />}</Card>}

      {tab === 'leagues' &&
        (!user ? (
          <EmptyState icon={<UserPlus className="w-6 h-6" />} title={t('Play against your friends')} body={t('Create a private league and share its code. Everyone’s Dream XI points are added up across the season.')} action={<Button onClick={() => openAuth(t('Sign in to create or join a private league.'))}>{t('Sign in')}</Button>} />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Card as="form" className="p-4 space-y-3" onSubmit={create}>
                <Field label={t('New league name')}>
                  <input value={name} onChange={e => setName(e.target.value)} className={inputCls} minLength={3} maxLength={40} required placeholder={t('e.g. Office XI')} />
                </Field>
                <Button type="submit" loading={busy} className="w-full"><Plus className="w-4 h-4" /> {t('Create league')}</Button>
              </Card>
              <Card as="form" className="p-4 space-y-3" onSubmit={join}>
                <Field label={t('Join with a code')}>
                  <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className={`${inputCls} font-mono tracking-widest uppercase`} required maxLength={12} placeholder="ABC123" />
                </Field>
                <Button type="submit" variant="secondary" loading={busy} className="w-full">{t('Join league')}</Button>
              </Card>
            </div>
            {(leagues.data?.leagues || []).length === 0 ? (
              <Notice>{t('You are not in any private leagues yet.')}</Notice>
            ) : (
              leagues.data!.leagues.map(l => (
                <Card key={l.id} data-testid="league-card">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800">
                    <span className="font-black text-white flex-1 min-w-0 truncate">{l.name}</span>
                    <button type="button" className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-300 min-h-[36px] px-2 rounded-lg bg-slate-950" onClick={() => navigator.clipboard?.writeText(l.code).then(() => toast(t('Code copied')))}>
                      {l.code} <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" className="text-slate-500 hover:text-red-300 min-h-[36px] px-2" aria-label={t('Leave league')} onClick={async () => { await api.leaveLeague(l.id); leagues.reload(); }}>
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                  <Standings rows={l.members} meId={user.id} />
                </Card>
              ))
            )}
          </div>
        ))}
    </div>
  );
}
