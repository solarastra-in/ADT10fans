import React, { useState } from 'react';
import { BookOpen, ExternalLink, Flame, LineChart, Share2, Sparkles, Trophy } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, Card, ErrorBox, Pill, ROLE_LABEL, SectionTitle, Spinner, TeamBadge, cx, useFormat } from '../components/ui';
import { PlatformIcon } from '../components/social';
import type { PlayerFormatStats } from '../types';

export default function PlayerPage({ id }: { id: string }) {
  const { teamById, config, toast } = useApp();
  const t = useT();
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => api.getPlayer(id), [id]);
  const [activeFormat, setActiveFormat] = useState<'t10' | 't20_2025_2026' | 't20_career'>('t10');

  const p = data?.player;
  const team = data ? teamById(data.team.id) || data.team : null;

  usePageMeta(
    p ? `${p.name} – ${team?.name || 'Abu Dhabi T10'}` : null,
    p ? t('{name} plays for {team} as a {role}.', { name: p.name, team: team?.name || '', role: t(ROLE_LABEL[p.role]).toLowerCase() }) : undefined,
    config?.brandName,
  );

  if (loading && !data) return <Spinner />;
  if (error || !p || !data || !team) return <ErrorBox message={error || t('Player not found')} onRetry={reload} />;

  const scoredFixtures = data.fixtures.filter(x => x.fantasyPoints !== null);
  const avgFantasyPoints = scoredFixtures.length
    ? Math.round((scoredFixtures.reduce((s, x) => s + (x.fantasyPoints || 0), 0) / scoredFixtures.length) * 10) / 10
    : null;
  const lastPick = [...data.fixtures].reverse().find(x => x.selectedBy !== null);

  const stats = data.stats || p.stats;
  const currentFormatStats: PlayerFormatStats | undefined = stats?.[activeFormat];

  // Social handles list
  const socials = data.socials || p.socials || {};
  const socialEntries: { key: string; label: string; url: string; platform: string; handle: string }[] = [];

  const addSocial = (key: string, label: string, platform: string, rawUrl?: string) => {
    if (!rawUrl) return;
    const url = rawUrl.trim();
    let handle = url.split('/').filter(Boolean).pop() || label;
    if (handle.startsWith('@')) handle = handle.slice(1);
    socialEntries.push({ key, label, url, platform, handle: `@${handle}` });
  };

  addSocial('instagram', 'Instagram', 'Instagram', socials.instagram);
  addSocial('x', 'X', 'X', socials.x);
  addSocial('youtube', 'YouTube', 'YouTube', socials.youtube);
  addSocial('tiktok', 'TikTok', 'TikTok', socials.tiktok);
  addSocial('threads', 'Threads', 'Threads', socials.threads);
  addSocial('facebook', 'Facebook', 'Facebook', socials.facebook);

  // Fallback to data.links if socials object had fewer items
  for (const l of data.links) {
    if (!socialEntries.some(s => s.key === l.key) && ['instagram', 'x', 'youtube', 'tiktok', 'threads', 'facebook'].includes(l.key)) {
      socialEntries.push({
        key: l.key,
        label: l.label,
        url: l.url,
        platform: l.label,
        handle: l.handle || `@${p.name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      });
    }
  }

  const careerLinks = data.links.filter(l => l.key === 'espncricinfo' || l.key === 'cricbuzz' || l.key === 'wikipedia');

  const shareProfile = async () => {
    const url = window.location.href;
    const title = `${p.name} · ${team.name}`;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t('Profile link copied'));
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="space-y-6 max-w-3xl pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5 flex-wrap" aria-label={t('Breadcrumb')}>
        <Link to="/players" className="hover:text-white transition-colors">{t('Players')}</Link>
        <span>/</span>
        <Link to={`/teams/${team.id}`} className="hover:text-white transition-colors">{team.name}</Link>
        <span>/</span>
        <span className="text-slate-300 font-bold">{p.name}</span>
      </nav>

      {/* Main Profile Header Hero */}
      <Card className="overflow-hidden p-0 border border-slate-800 shadow-2xl">
        <header
          className="relative px-6 pt-7 pb-6 text-white"
          style={{ background: `linear-gradient(135deg, ${team.color}dd 0%, ${team.secondaryColor || '#0f172a'}fa 60%, #0f172a 100%)` }}
        >
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            <div className="relative rounded-2xl ring-4 ring-black/30 overflow-hidden bg-slate-900 shrink-0 w-28 h-28 shadow-xl">
              <Avatar name={p.name} src={p.photoUrl} size={112} />
              {p.category && (
                <span className="absolute bottom-1 end-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow">
                  {p.category}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Pill tone={p.category === 'Icon' ? 'amber' : 'blue'}>{t('{category} signing', { category: t(p.category || 'Official') })}</Pill>
                {p.isCaptain && <Pill tone="green">{t('Captain')}</Pill>}
                {p.isKeeper && <Pill tone="blue">{t('Wicketkeeper')}</Pill>}
              </div>

              <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-white">{p.name}</h1>

              <p className="text-sm sm:text-base text-white/90 mt-1 font-medium flex items-center gap-2 flex-wrap">
                <span>{t(ROLE_LABEL[p.role])}</span>
                {p.nationality && <span>· 🌍 {p.nationality}</span>}
                {(p.battingStyle || p.bowlingStyle) && <span>· {[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' / ')}</span>}
              </p>

              <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                <Link
                  to={`/teams/${team.id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 hover:bg-black/60 text-xs font-bold text-white transition-colors border border-white/10"
                >
                  <TeamBadge team={team} size="sm" />
                  <span>{team.name}</span>
                </Link>

                <button
                  type="button"
                  onClick={shareProfile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors border border-white/10"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>{t('Share Profile')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Player Skills Badges */}
          {p.skills && p.skills.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/10">
              <span className="block text-[11px] font-black uppercase tracking-wider text-white/60 mb-2">{t('Verified Player Specialties')}</span>
              <div className="flex flex-wrap gap-2">
                {p.skills.map(s => (
                  <span key={s} className="px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-xs text-xs font-semibold text-amber-300 border border-amber-400/30 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" /> {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </header>

        {/* Pick XI Fantasy Quick Metrics */}
        <div className="p-5 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {t('Pick XI Fantasy Profile')}
            </h2>
            <Link to="/fantasy" className="text-xs font-bold text-amber-400 hover:text-amber-300">
              {t('Pick XI Hub')} →
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Credits')}</span>
              <span className="block text-xl font-black text-amber-400 tabular-nums">{p.credits ?? 9.5}</span>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Avg Points')}</span>
              <span className="block text-xl font-black text-white tabular-nums">{avgFantasyPoints ?? '—'}</span>
            </div>
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 text-center">
              <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Selected By')}</span>
              <span className="block text-xl font-black text-white tabular-nums">{lastPick?.selectedBy != null ? `${lastPick.selectedBy}%` : '—'}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Official Social Media Channels Section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle title={t('Official Social Media Handles')} />
          <span className="text-xs text-slate-500">{t('{n} official channels', { n: socialEntries.length })}</span>
        </div>
        <Card className="p-4 sm:p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {socialEntries.map(s => (
              <a
                key={s.key}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-amber-400/60 hover:bg-slate-800/60 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <PlatformIcon platform={s.platform} className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                    {s.label}
                  </span>
                  <span className="block text-[11px] font-mono text-slate-400 truncate">
                    {s.handle}
                  </span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors shrink-0" />
              </a>
            ))}
          </div>
        </Card>
      </section>

      {/* Format Statistics: T10, T20 (2025/2026), and T20 Lifetime Career */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionTitle title={t('Career & Format Statistics')} />
          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveFormat('t10')}
              className={cx(
                'px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5',
                activeFormat === 't10' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white',
              )}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{t('T10 Career')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFormat('t20_2025_2026')}
              className={cx(
                'px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5',
                activeFormat === 't20_2025_2026' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white',
              )}
            >
              <span>{t('T20 (2025/26)')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveFormat('t20_career')}
              className={cx(
                'px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5',
                activeFormat === 't20_career' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white',
              )}
            >
              <span>{t('T20 Lifetime')}</span>
            </button>
          </div>
        </div>

        {currentFormatStats ? (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {activeFormat === 't10'
                  ? t('Abu Dhabi T10 & International T10 Figures')
                  : activeFormat === 't20_2025_2026'
                  ? t('T20 Franchise & International (2025/2026 Season)')
                  : t('All-Time Professional T20 Career')}
              </span>
              <span className="text-xs font-black text-amber-400">
                {currentFormatStats.matches} {t('Matches')}
              </span>
            </div>

            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Runs')}</span>
                <span className="block text-2xl font-black text-amber-300 tabular-nums">{currentFormatStats.runs}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Strike Rate')}</span>
                <span className="block text-2xl font-black text-white tabular-nums">{currentFormatStats.strikeRate}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Batting Avg')}</span>
                <span className="block text-2xl font-black text-white tabular-nums">{currentFormatStats.average}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
                <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">{t('Wickets')}</span>
                <span className="block text-2xl font-black text-emerald-400 tabular-nums">{currentFormatStats.wickets ?? 0}</span>
              </div>
            </div>

            {/* Detailed Figures Table */}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
              <div>
                <dt className="text-slate-500 font-semibold">{t('Highest Score')}</dt>
                <dd className="text-sm font-black text-white tabular-nums mt-0.5">{currentFormatStats.highestScore}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-semibold">{t('Boundaries (4s / 6s)')}</dt>
                <dd className="text-sm font-black text-white tabular-nums mt-0.5">{currentFormatStats.fours || 0} / {currentFormatStats.sixes || 0}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-semibold">{t('Milestones (50s / 100s)')}</dt>
                <dd className="text-sm font-black text-white tabular-nums mt-0.5">{currentFormatStats.fifties || 0} / {currentFormatStats.hundreds || 0}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-semibold">{t('Best Bowling')}</dt>
                <dd className="text-sm font-black text-white tabular-nums mt-0.5">{currentFormatStats.bestBowling || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-semibold">{t('Economy Rate')}</dt>
                <dd className="text-sm font-black text-white tabular-nums mt-0.5">{currentFormatStats.economy ? `${currentFormatStats.economy} rpo` : '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500 font-semibold">{t('Innings Batted')}</dt>
                <dd className="text-sm font-black text-white tabular-nums mt-0.5">{currentFormatStats.innings}</dd>
              </div>
            </dl>
          </Card>
        ) : (
          <Card className="p-6 text-center text-slate-400 text-sm">
            {t('Format figures will update once matches are verified.')}
          </Card>
        )}
      </section>

      {/* External Verified Stats Portals */}
      {careerLinks.length > 0 && (
        <section className="space-y-3">
          <SectionTitle title={t('Career Archives & Portals')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {careerLinks.map(l => (
              <a
                key={l.key}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-850 transition-colors"
              >
                {l.key === 'wikipedia' ? <BookOpen className="w-4 h-4 text-slate-300 shrink-0" /> : <LineChart className="w-4 h-4 text-amber-400 shrink-0" />}
                <span className="flex-1 text-xs font-bold text-white truncate">
                  {l.key === 'wikipedia' ? t('Player Biography on Wikipedia') : t('Career records on {site}', { site: l.label })}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
