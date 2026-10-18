import React from 'react';
import { Globe2, MapPin, Users } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, Button, ButtonLink, Card, ErrorBox, PageHeader, SectionTitle, Spinner, StatTile, TeamBadge, useFormat } from '../components/ui';

export default function FansPage() {
  const { user, teamById, openAuth, openTeamPicker, config } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('Fan base: supporters of every team'), t('How many fans back each Abu Dhabi T10 team, where they are, and their top supporters.'), config?.brandName);
  const { data, error, loading, reload } = useLoad(() => api.getFanBase(), []);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const maxFans = Math.max(1, ...data.teams.map(x => x.fans));
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Community')}
        title={t('Fan base')}
        subtitle={t('Who backs which team, and from where. Add your country on your profile to put yourself on the map.')}
        actions={!user ? <Button onClick={() => openAuth()}>{t('Join the fan base')}</Button> : !user.teamId ? <Button onClick={openTeamPicker}>{t('Choose your team')}</Button> : !user.country ? <ButtonLink to="/profile#details" variant="secondary">{t('Add your country')}</ButtonLink> : undefined}
      />
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('Fans')} value={f.num(data.totalFans)} accent />
        <StatTile label={t('Countries')} value={data.countries.length} />
        <StatTile label={t('Still choosing a team')} value={data.unaffiliated} />
      </div>
      <section>
        <SectionTitle title={t('Fans by team')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.teams
            .slice()
            .sort((a, b) => b.fans - a.fans)
            .map(row => {
              const team = teamById(row.teamId);
              return (
                <Card key={row.teamId} className="p-4 space-y-3" data-testid="fanbase-team">
                  <Link to={`/teams/${row.teamId}`} className="flex items-center gap-3">
                    <TeamBadge team={team} />
                    <span className="flex-1 min-w-0">
                      <span className="block font-black text-white truncate">{team?.name}</span>
                      <span className="block text-xs text-slate-400">
                        {t('{n} fans', { n: row.fans })} · {t('{n} active this week', { n: row.activeThisWeek })} · {t('{n} threads', { n: row.threads })}
                      </span>
                    </span>
                  </Link>
                  <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(row.fans / maxFans) * 100}%`, background: team?.color }} />
                  </div>
                  {row.topFans.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {row.topFans.map(u => (
                        <span key={u.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-xs text-slate-200">
                          <Avatar name={u.name} src={u.avatar} size={20} /> {u.name} <span className="text-amber-400 font-bold">{u.points}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">{t('No top fans yet.')}</p>
                  )}
                </Card>
              );
            })}
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionTitle title={t('Where fans are')} />
          {data.countries.length ? (
            <Card className="divide-y divide-slate-800">
              {data.countries.map(c => (
                <div key={c.country} className="flex items-center gap-3 px-4 py-2.5">
                  <Globe2 className="w-4 h-4 text-slate-500" />
                  <span className="flex-1 text-sm text-white">{c.country}</span>
                  <span className="text-sm font-bold text-amber-400 tabular-nums">{c.fans}</span>
                </div>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-slate-400">{t('No fan has added a country yet.')}</p>
          )}
        </section>
        <section>
          <SectionTitle title={t('Newest fans')} />
          {data.recent.length ? (
            <Card className="divide-y divide-slate-800">
              {data.recent.map((u, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={u.name} src={u.avatar} size={30} />
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
                      {u.country ? <> · <MapPin className="w-3 h-3 inline" /> {u.country}</> : ''}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500">{f.ago(u.joinedAt)}</span>
                </div>
              ))}
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <Users className="w-6 h-6 mx-auto text-amber-400" />
              <p className="mt-2 text-sm text-slate-300">{t('Be the first fan to join.')}</p>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
