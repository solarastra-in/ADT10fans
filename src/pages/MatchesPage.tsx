import React, { useState } from 'react';
import { CalendarDays, ExternalLink, Globe, Activity, ShieldCheck } from 'lucide-react';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl mb-5">
        <div className="flex items-center gap-3">
          <img
            src="/logos/adt10.png"
            alt="Abu Dhabi T10"
            className="w-12 h-12 object-contain rounded-2xl p-1 bg-slate-950 border border-amber-400/40 shadow-lg shadow-amber-500/20 shrink-0"
          />
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full inline-block">
              {config?.seasonLabel || 'Abu Dhabi T10 2026'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
              {t('Matches & Fixtures')}
            </h1>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <p className="text-xs text-slate-400 max-w-sm">
            {t('Times are shown in your local time zone. Scores update automatically during play.')}
          </p>
          <a
            href="https://www.cricbuzz.com/cricket-series/13307/abu-dhabi-t10-league-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-colors shrink-0"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cricbuzz Series 13307</span>
            <ExternalLink className="w-3 h-3 text-emerald-400" />
          </a>
        </div>
      </div>

      {/* Where Scores Are Shown Guide */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 shadow-md mb-5 text-xs text-slate-300 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="font-extrabold text-white text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" /> {t('Where live scores & scorecards are shown')}
          </span>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {t('Seeded from Cricbuzz Series 13307')}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="font-bold text-amber-300 block mb-0.5">1. Match Cards</span>
            <span className="text-slate-400 text-[11px]">Real-time runs, wickets, and overs with pulse LIVE badge for active matches.</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="font-bold text-emerald-300 block mb-0.5">2. Full Scorecard</span>
            <span className="text-slate-400 text-[11px]">Click any match to see both innings: batters (runs, balls, SR) and bowlers (overs, maidens, econ).</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
            <span className="font-bold text-sky-300 block mb-0.5">3. Pick XI Fantasy</span>
            <span className="text-slate-400 text-[11px]">Player fantasy points recalculate dynamically as match events unfold.</span>
          </div>
        </div>
      </div>
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
