import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, PageHeader, TeamBadge } from '../components/ui';

export default function TeamsPage() {
  const { teams, config, user } = useApp();
  const t = useT();
  usePageMeta(t('{season} teams and squads', { season: config?.seasonLabel || 'Abu Dhabi T10' }), t('All six franchises and their squads.'), config?.brandName);
  return (
    <div>
      <PageHeader eyebrow={config?.seasonLabel} title={t('Teams & squads')} subtitle={t('Six franchises, {n} players. Tap a team for its squad, fixtures and official channels.', { n: teams.reduce((s, x) => s + x.squad.length, 0) })} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {teams.map(team => (
          <Link key={team.id} to={`/teams/${team.id}`} className="group" data-testid="team-card">
            <Card className="p-5 h-full hover:border-slate-600 transition-colors relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1" style={{ background: team.color }} />
              <div className="flex items-center gap-3">
                <TeamBadge team={team} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-black text-white leading-tight">{team.name}</h2>
                  <p className="text-xs text-slate-400">
                    {t('{n} players', { n: team.squad.length })} · {t('{n} fans', { n: team.fans || 0 })}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 rtl-flip" />
              </div>
              {team.iconPlayer && (
                <p className="mt-4 text-sm text-slate-300">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">{t('Icon')}</span> {team.iconPlayer}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-500 truncate">
                {team.squad.filter(p => p.category === 'Platinum').map(p => p.name).join(' · ')}
              </p>
              {user?.teamId === team.id && <p className="mt-3 text-xs font-black text-amber-400">★ {t('Your team')}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
