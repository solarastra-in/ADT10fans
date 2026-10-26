import React from 'react';
import { ExternalLink } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, ButtonLink, Card, ErrorBox, Pill, SectionTitle, Spinner, StatTile, TeamBadge, ROLE_LABEL, useFormat } from '../components/ui';

export default function PlayerPage({ id }: { id: string }) {
  const { teamById, config } = useApp();
  const t = useT();
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => api.getPlayer(id), [id]);
  const p = data?.player;
  usePageMeta(p ? `${p.name} – ${data!.team.name}` : null, p ? t('{name} plays for {team} as a {role}.', { name: p.name, team: data!.team.name, role: t(ROLE_LABEL[p.role]).toLowerCase() }) : undefined, config?.brandName);
  if (loading && !data) return <Spinner />;
  if (error || !p || !data) return <ErrorBox message={error || t('Player not found')} onRetry={reload} />;
  const team = data.team;
  const scored = data.fixtures.filter(x => x.fantasyPoints !== null);
  const avg = scored.length ? Math.round((scored.reduce((s, x) => s + (x.fantasyPoints || 0), 0) / scored.length) * 10) / 10 : null;

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link to="/players" className="hover:text-white">{t('Players')}</Link> / {p.name}
      </nav>
      <Card className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-center">
        <Avatar name={p.name} src={p.photoUrl} size={96} />
        <div className="flex-1 min-w-0 space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-white">{p.name}</h1>
          <Link to={`/teams/${team.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-200 hover:text-amber-300">
            <TeamBadge team={teamById(team.id) || team} size="sm" /> {team.name}
          </Link>
          <div className="flex flex-wrap gap-2">
            <Pill>{t(ROLE_LABEL[p.role])}</Pill>
            {p.category && <Pill tone={p.category === 'Icon' ? 'amber' : 'blue'}>{t('{category} signing', { category: t(p.category) })}</Pill>}
            {p.nationality && <Pill>{p.nationality}</Pill>}
          </div>
          <p className="text-sm text-slate-400">{[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' · ')}</p>
        </div>
        {p.cricbuzzProfileUrl && (
          <ButtonLink to={p.cricbuzzProfileUrl} external variant="secondary">
            {t('Career stats on Cricbuzz')} <ExternalLink className="w-4 h-4" />
          </ButtonLink>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('Pick XI credits')} value={p.credits ?? '—'} accent />
        <StatTile label={t('Matches scored')} value={scored.length} />
        <StatTile label={t('Avg Pick XI points')} value={avg ?? '—'} />
      </div>

      <section>
        <SectionTitle title={t('Fixtures')} />
        {data.fixtures.length ? (
          <Card className="divide-y divide-slate-800">
            {data.fixtures.map(fx => {
              const opp = teamById(fx.opponent);
              return (
                <Link key={fx.matchId} to={`/matches/${fx.matchId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40">
                  <span className="text-xs text-slate-500 w-14 shrink-0">{t('Match {n}', { n: fx.matchNo })}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-white truncate">vs {opp?.name || fx.opponent}</span>
                    <span className="block text-[11px] text-slate-500 truncate">{fx.status === 'completed' ? fx.result : f.dateTime(fx.startsAt)}</span>
                  </span>
                  <span className="text-end">
                    {fx.fantasyPoints !== null ? <span className="block text-sm font-black text-amber-400">{t('{n} pts', { n: fx.fantasyPoints })}</span> : null}
                    {fx.selectedBy !== null ? <span className="block text-[11px] text-slate-500">{t('in {pct}% of teams', { pct: fx.selectedBy })}</span> : null}
                  </span>
                </Link>
              );
            })}
          </Card>
        ) : (
          <p className="text-sm text-slate-400">{t('Fixtures are not out yet.')}</p>
        )}
      </section>
    </div>
  );
}
