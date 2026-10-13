import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useApp } from '../state';
import { useT } from '../i18n';
import { usePageMeta } from '../router';
import { ButtonLink, EmptyState, PageHeader, SectionTitle, Tabs } from '../components/ui';
import { MatchCard, sortMatches } from '../components/matches';

export default function MatchesPage() {
  const { matches, teams, config } = useApp();
  const t = useT();
  usePageMeta(t('{season} fixtures, results and live scores', { season: config?.seasonLabel || 'Abu Dhabi T10' }), t('Every fixture with start times, live scores, results and scorecards.'), config?.brandName);
  const [team, setTeam] = useState<string>('all');
  const list = team === 'all' ? matches : matches.filter(m => m.teamA === team || m.teamB === team);
  const { live, upcoming, done } = sortMatches(list);

  return (
    <div>
      <PageHeader eyebrow={config?.seasonLabel} title={t('Matches')} subtitle={t('Times are shown in your local time zone. Scores update automatically during play.')} />
      <Tabs value={team} onChange={setTeam} className="mb-5" items={[{ id: 'all', label: t('All teams') }, ...teams.map(x => ({ id: x.id, label: x.short }))]} />
      {matches.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-6 h-6" />}
          title={t('Fixtures are not out yet')}
          body={t('The {season} runs from {start} to {end}. Fixtures appear here as soon as the league publishes them.', { season: config?.seasonLabel || '', start: config?.seasonStart || '', end: config?.seasonEnd || '' })}
          action={<ButtonLink to="/teams" variant="secondary">{t('See the squads')}</ButtonLink>}
        />
      ) : (
        <div className="space-y-8">
          {live.length > 0 && (
            <section>
              <SectionTitle title={t('Live now')} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{live.map(m => <MatchCard key={m.id} m={m} />)}</div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section>
              <SectionTitle title={t('Upcoming')} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{upcoming.map(m => <MatchCard key={m.id} m={m} />)}</div>
            </section>
          )}
          {done.length > 0 && (
            <section>
              <SectionTitle title={t('Results')} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{done.map(m => <MatchCard key={m.id} m={m} />)}</div>
            </section>
          )}
          {!live.length && !upcoming.length && !done.length && <EmptyState title={t('No matches for this team yet')} />}
        </div>
      )}
    </div>
  );
}
