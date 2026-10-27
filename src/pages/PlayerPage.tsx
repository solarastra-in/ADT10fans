import React from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, ErrorBox, Spinner, ROLE_LABEL } from '../components/ui';
import { PlayerCardBody } from '../components/PlayerCard';

/**
 * A player's profile: the same card fans see when they tap a player (T10 figures this season from
 * real scorecards, career records, Pick XI numbers, career-stats and official social links). The
 * server renders this page with Person structured data for search engines.
 */
export default function PlayerPage({ id }: { id: string }) {
  const { config } = useApp();
  const t = useT();
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

    </div>
  );
}
