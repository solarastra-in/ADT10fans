import React from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, ErrorBox, SectionTitle, Spinner, ROLE_LABEL, useFormat } from '../components/ui';
import { PlayerCardBody } from '../components/PlayerCard';

/**
 * A player's profile: the same card fans see when they tap a player (season figures from real
 * scorecards, Pick XI numbers, career-stats and official social links), plus every fixture with the
 * player's Pick XI points. The server renders this page with Person structured data for search engines.
 */
export default function PlayerPage({ id }: { id: string }) {
  const { teamById, config } = useApp();
  const t = useT();
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => api.getPlayer(id), [id]);
  const p = data?.player;
  usePageMeta(
    p ? `${p.name} – ${data!.team.name}` : null,
    p ? t('{name} plays for {team} as a {role}.', { name: p.name, team: data!.team.name, role: t(ROLE_LABEL[p.role]).toLowerCase() }) : undefined,
    config?.brandName,
  );
  if (loading && !data) return <Spinner />;
  if (error || !p || !data) return <ErrorBox message={error || t('Player not found')} onRetry={reload} />;

  return (
    <div className="space-y-6 max-w-2xl">
      <nav className="text-xs text-slate-500" aria-label={t('Breadcrumb')}>
        <Link to="/players" className="hover:text-white">{t('Players')}</Link> / <Link to={`/teams/${data.team.id}`} className="hover:text-white">{data.team.name}</Link> / <span className="text-slate-300">{p.name}</span>
      </nav>
      <Card className="overflow-hidden p-0">
        <PlayerCardBody data={data} onPage />
      </Card>

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
