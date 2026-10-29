import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { BookOpen, ExternalLink, LineChart, Share2, X } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link, navigate } from '../router';
import type { PlayerDetail, SeasonStats } from '../types';
import { Avatar, cx, Pill, ROLE_LABEL, Spinner, TeamBadge, useFormat } from './ui';
import { PlatformIcon } from './social';

/**
 * The player card: opens over any page when a player is tapped (players list, squads, Pick XI).
 * Shows who the player is, this season's real figures from the site's scorecards, their Pick XI
 * numbers, links to career statistics (ESPNcricinfo, Cricbuzz, Wikipedia) and their own official
 * social accounts. "Full profile" goes to /players/:id, the page search engines index.
 *
 * Open it from anywhere with openPlayerCard(id); a link with ?player=<id> opens it on load.
 */

let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function openPlayerCard(id: string) {
  current = id;
  emit();
}
export function closePlayerCard() {
  current = null;
  emit();
  // Drop ?player= from the address so going back does not reopen it.
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('player')) {
    const qs = new URLSearchParams(window.location.search);
    qs.delete('player');
    window.history.replaceState(window.history.state, '', window.location.pathname + (qs.toString() ? `?${qs}` : '') + window.location.hash);
  }
}
const usePlayerCardId = () =>
  useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );

/**
 * Props for a link to a player: a real link to /players/:id (crawlable, opens in a new tab with a
 * modifier key) that opens the card on a plain tap.
 */
export function playerLinkProps(id: string) {
  return {
    href: `/players/${encodeURIComponent(id)}`,
    onClick: (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      openPlayerCard(id);
    },
  };
}

const SOCIAL_PLATFORM: Record<string, string> = {
  instagram: 'Instagram',
  x: 'X',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  threads: 'Threads',
};

/** Mounted once in the app shell. */
export function PlayerCardHost() {
  const id = usePlayerCardId();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromUrl = new URLSearchParams(window.location.search).get('player');
    if (fromUrl && /^[\w-]{1,80}$/.test(fromUrl)) openPlayerCard(fromUrl);
  }, []);
  if (!id) return null;
  return <PlayerCardSheet id={id} onClose={closePlayerCard} />;
}

function PlayerCardSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const [data, setData] = useState<PlayerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    api
      .getPlayer(id)
      .then(r => alive && setData(r))
      .catch(e => alive && setError(e?.message || t('Player not found')));
    return () => {
      alive = false;
    };
  }, [id, t]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={data?.player.name || t('Player')}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 end-3 z-10 w-10 h-10 rounded-xl bg-black/30 text-white/90 hover:bg-black/50 inline-flex items-center justify-center"
          aria-label={t('Close')}
        >
          <X className="w-5 h-5" />
        </button>
        {error ? (
          <div className="p-8 text-center text-sm text-slate-300">{error}</div>
        ) : !data ? (
          <div className="py-16">
            <Spinner />
          </div>
        ) : (
          <PlayerCardBody data={data} onClose={onClose} />
        )}
      </div>
    </div>
  );
}

export function PlayerCardBody({ data, onClose, onPage }: { data: PlayerDetail; onClose?: () => void; /** On the profile page itself: no "Full profile" button. */ onPage?: boolean }) {
  const t = useT();
  const f = useFormat();
  const { teamById, toast } = useApp();
  const { player: p, season, links, fixtures } = data;
  const team = teamById(data.team.id) || data.team;
  const scored = fixtures.filter(x => x.fantasyPoints !== null);
  const avg = scored.length ? Math.round((scored.reduce((s, x) => s + (x.fantasyPoints || 0), 0) / scored.length) * 10) / 10 : null;
  const next = fixtures.find(x => x.status === 'upcoming' || x.status === 'live');
  const lastPick = [...fixtures].reverse().find(x => x.selectedBy !== null);
  const statsLinks = links.filter(l => l.key === 'espncricinfo' || l.key === 'cricbuzz' || l.key === 'wikipedia');
  const socialLinks = links.filter(l => SOCIAL_PLATFORM[l.key]);
  const profilePath = `/players/${encodeURIComponent(p.id)}`;

  const share = async () => {
    const url = `${window.location.origin}${profilePath}`;
    const title = t('{name} – {team}', { name: p.name, team: team.name });
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t('Link copied'));
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <article>
      {/* Header in the team's colours */}
      <header
        className="relative px-5 pt-6 pb-5 text-white"
        style={{ background: `linear-gradient(135deg, ${team.color}cc 0%, ${team.secondaryColor || '#0f172a'}ee 55%, #0f172a 100%)` }}
      >
        <div className="flex items-end gap-4">
          <div className="rounded-2xl ring-4 ring-black/20 overflow-hidden bg-slate-800 shrink-0">
            <Avatar name={p.name} src={p.photoUrl} size={92} />
          </div>
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {p.category && <Pill tone={p.category === 'Icon' ? 'amber' : 'blue'}>{t('{category} signing', { category: t(p.category) })}</Pill>}
              {p.isCaptain && <Pill tone="green">{t('Captain')}</Pill>}
            </div>
            <h2 className="text-2xl font-black leading-tight break-words">{p.name}</h2>
            <p className="text-sm text-white/85 mt-0.5">
              {t(ROLE_LABEL[p.role])}
              {p.nationality ? ` · ${p.nationality}` : ''}
            </p>
          </div>
        </div>
        <Link to={`/teams/${team.id}`} onClick={() => onClose?.()} className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-white/95 hover:text-white">
          <TeamBadge team={team} size="sm" /> {team.name}
        </Link>
        {(p.battingStyle || p.bowlingStyle) && <p className="mt-2 text-xs text-white/75">{[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' · ')}</p>}
        {p.skills && p.skills.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {p.skills.map(s => (
              <span key={s} className="px-2 py-0.5 rounded-md bg-black/30 backdrop-blur-xs text-[11px] font-semibold text-white/95 border border-white/20">
                ⚡ {s}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="p-5 space-y-5">
        {/* This season */}
        <section>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">{t('This season')}</h3>
          {season && season.matches > 0 ? (
            <SeasonGrid s={season} />
          ) : (
            <p className="text-sm text-slate-400">
              {next ? t('No matches yet. First up: {date}.', { date: f.dateTime(next.startsAt) }) : t('No matches yet this season.')}
            </p>
          )}
        </section>

        {/* Pick XI */}
        <section>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">{t('Pick XI')}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t('Credits')} value={p.credits ?? '—'} accent />
            <Stat label={t('Avg points')} value={avg ?? '—'} />
            <Stat label={t('Picked by')} value={lastPick?.selectedBy != null ? `${lastPick.selectedBy}%` : '—'} />
          </div>
        </section>

        {/* Tournament & Format Stats: T10, T20 2025/26, Lifetime */}
        <FormatStatsBlock stats={data.stats || p.stats} />

        {/* Career stats and reading */}
        {statsLinks.length > 0 && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">{t('Career stats')}</h3>
            <div className="grid grid-cols-1 gap-2">
              {statsLinks.map(l => (
                <a
                  key={l.key}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 hover:border-slate-600"
                >
                  {l.key === 'wikipedia' ? <BookOpen className="w-4 h-4 text-slate-300" /> : <LineChart className="w-4 h-4 text-amber-300" />}
                  <span className="flex-1 text-sm font-bold text-white">{l.key === 'wikipedia' ? t('Biography on Wikipedia') : t('Career stats on {site}', { site: l.label })}</span>
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Official social accounts */}
        {socialLinks.length > 0 && (
          <section>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">{t('Follow {name}', { name: p.name.split(' ').slice(-1)[0] })}</h3>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map(l => (
                <a
                  key={l.key}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950/60 ps-2.5 pe-3.5 py-2 text-sm font-bold text-white hover:border-slate-500"
                  aria-label={t('{name} on {site}', { name: p.name, site: l.label })}
                >
                  <PlatformIcon platform={SOCIAL_PLATFORM[l.key]} className="w-4 h-4" />
                  <span>{l.handle || l.label}</span>
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="flex gap-2 pt-1">
          {!onPage && (
          <a
            href={profilePath}
            onClick={e => {
              if (e.metaKey || e.ctrlKey || e.shiftKey) return;
              e.preventDefault();
              onClose?.();
              navigate(profilePath);
            }}
            className="flex-1 inline-flex items-center justify-center min-h-[44px] rounded-xl bg-amber-400 text-slate-950 text-sm font-black hover:bg-amber-300"
          >
            {t('Full profile')}
          </a>
          )}
          <button type="button" onClick={share} className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl border border-slate-700 text-sm font-bold text-white hover:bg-slate-800">
            <Share2 className="w-4 h-4" /> {t('Share')}
          </button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">{t('Season figures come from this season\'s scorecards on this site. Career figures open on the sites linked above.')}</p>
      </div>
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-950/70 border border-slate-800 px-2 py-2.5 text-center">
      <span className="block text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <span className={cx('block text-lg font-black tabular-nums', accent ? 'text-amber-300' : 'text-white')}>{value}</span>
    </div>
  );
}

export function SeasonGrid({ s }: { s: SeasonStats }) {
  const t = useT();
  const batted = s.innings > 0;
  const bowled = s.ballsBowled > 0;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        <Stat label={t('Matches')} value={s.matches} />
        <Stat label={t('Runs')} value={batted ? s.runs : '—'} accent={batted} />
        <Stat label={t('Wickets')} value={bowled ? s.wickets : '—'} accent={bowled} />
        <Stat label={t('Catches')} value={s.catches + s.stumpings} />
      </div>
      {(batted || bowled) && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5 text-xs">
          {batted && (
            <>
              <Row k={t('Highest')} v={`${s.highest}${s.highestNotOut ? '*' : ''}`} />
              <Row k={t('Strike rate')} v={s.strikeRate ?? '—'} />
              <Row k={t('Average')} v={s.average ?? '—'} />
              <Row k={t('4s / 6s')} v={`${s.fours} / ${s.sixes}`} />
            </>
          )}
          {bowled && (
            <>
              <Row k={t('Economy')} v={s.economy ?? '—'} />
              <Row k={t('Best bowling')} v={s.best ? `${s.best.wickets}/${s.best.runs}` : '—'} />
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-slate-400">{k}</dt>
      <dd className="font-bold text-white tabular-nums">{v}</dd>
    </div>
  );
}

export function FormatStatsBlock({ stats }: { stats?: PlayerDetail['stats'] }) {
  const t = useT();
  const [format, setFormat] = useState<'t10' | 't20_2025_2026' | 't20_career'>('t10');
  if (!stats) return null;
  const current = stats[format];
  if (!current) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">{t('Career & Format Stats')}</h3>
        <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setFormat('t10')}
            className={cx('px-2.5 py-1 rounded-md transition-colors', format === 't10' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
          >
            T10
          </button>
          <button
            type="button"
            onClick={() => setFormat('t20_2025_2026')}
            className={cx('px-2.5 py-1 rounded-md transition-colors', format === 't20_2025_2026' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
          >
            2025/26
          </button>
          <button
            type="button"
            onClick={() => setFormat('t20_career')}
            className={cx('px-2.5 py-1 rounded-md transition-colors', format === 't20_career' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
          >
            T20 Career
          </button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <Stat label={t('Matches')} value={current.matches} />
        <Stat label={t('Runs')} value={current.runs} accent />
        <Stat label={t('Str Rate')} value={current.strikeRate} />
        <Stat label={t('Wickets')} value={current.wickets ?? 0} accent={Boolean(current.wickets)} />
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-2.5 text-xs">
        <Row k={t('Highest score')} v={current.highestScore} />
        <Row k={t('Average')} v={current.average} />
        <Row k={t('4s / 6s')} v={`${current.fours || 0} / ${current.sixes || 0}`} />
        <Row k={t('Economy')} v={current.economy ? `${current.economy}` : '—'} />
        {current.bestBowling && current.bestBowling !== '—' && <Row k={t('Best bowling')} v={current.bestBowling} />}
        {current.fifties !== undefined && <Row k={t('50s / 100s')} v={`${current.fifties} / ${current.hundreds || 0}`} />}
      </dl>
    </section>
  );
}

