import React, { useState } from 'react';
import { Crown } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, Button, Card, EmptyState, ErrorBox, PageHeader, SectionTitle, Spinner, Tabs, TeamBadge, cx, useFormat } from '../components/ui';

export default function LeaderboardPage() {
  const { user, teams, teamById, openTeamPicker, config } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Fan leaderboard and Fan Wars'), t('The top fans of the season and which franchise has the most active supporters.'), config?.brandName);
  const [team, setTeam] = useState('all');
  const { data, error, loading, reload } = useLoad(() => api.getLeaderboard(team === 'all' ? undefined : team), [team, user?.points]);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const max = Math.max(1, ...(data?.fanWars || []).map(r => r.points));
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Season')} title={t('Leaderboard')} subtitle={t('Every point a fan earns also counts for the team they back.')} actions={user && !user.teamId ? <Button onClick={openTeamPicker}>{t('Choose your team')}</Button> : undefined} />
      <section>
        <SectionTitle title={t('Fan Wars')} />
        {loading && !data ? (
          <Spinner />
        ) : (
          <Card className="p-4 space-y-3">
            {(data?.fanWars || []).map((row, i) => (
              <Link key={row.team.id} to={`/teams/${row.team.id}`} className="block" data-testid="fanwars-row">
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center font-black text-slate-500">{i === 0 && row.points > 0 ? <Crown className="w-5 h-5 text-amber-400 inline" /> : i + 1}</span>
                  <TeamBadge team={teamById(row.team.id)} size="sm" />
                  <span className="flex-1 min-w-0 truncate font-bold text-white">{row.team.name}</span>
                  <span className="text-xs text-slate-400">{t('{n} fans', { n: row.fansCount })}</span>
                  <span className="w-16 text-end font-black text-amber-400 tabular-nums">{f.num(row.points)}</span>
                </div>
                <div className="ms-9 mt-1.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(row.points / max) * 100}%`, background: row.team.color }} />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>
      <section>
        <SectionTitle title={t('Top fans')} action={user && data?.myRank ? <span className="text-sm font-bold text-amber-400">{t('You: #{n}', { n: data.myRank })}</span> : null} />
        <Tabs value={team} onChange={setTeam} className="mb-3" items={[{ id: 'all', label: t('All fans') }, ...teams.map(x => ({ id: x.id, label: x.short }))]} />
        {(data?.topFans || []).length ? (
          <Card className="divide-y divide-slate-800">
            {data!.topFans.map((u, i) => (
              <div key={u.id} className={cx('flex items-center gap-3 px-4 py-2.5', u.id === user?.id && 'bg-amber-400/5')} data-testid="top-fan">
                <span className="w-7 text-center font-black text-slate-500 tabular-nums">{i + 1}</span>
                <Avatar name={u.name} src={u.avatar} size={34} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{u.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                    {u.teamId && teamById(u.teamId) ? (
                      <span className="inline-flex items-center gap-1 font-bold text-slate-300">
                        <TeamBadge team={teamById(u.teamId)} size="sm" />
                        <span>{teamById(u.teamId)?.name}</span>
                      </span>
                    ) : (
                      <span>{t('No team yet')}</span>
                    )}
                    {u.streak > 1 ? ` · 🔥 ${u.streak}` : ''}
                    {u.badges.length ? ` · ${t('{n} badges', { n: u.badges.length })}` : ''}
                  </span>
                </span>
                <span className="font-black text-amber-400 tabular-nums">{f.num(u.points)}</span>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState title={t('No points scored yet')} body={t('Play Dream XI, the daily games or predictions to get on the board.')} action={<Link to="/play" className="text-sm font-bold text-amber-400">{t('Play now')} →</Link>} />
        )}
        <p className="text-xs text-slate-500 mt-2"><Link to="/fantasy" className="text-amber-400">{t('Dream XI season standings')} →</Link></p>
      </section>
    </div>
  );
}
