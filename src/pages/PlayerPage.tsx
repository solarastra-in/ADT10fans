import React, { useEffect, useMemo } from 'react';
import { ExternalLink, Globe, BarChart2, BookOpen, Award, Share2, Youtube, Sparkles, CheckCircle, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Avatar, ButtonLink, Card, ErrorBox, Pill, SectionTitle, Spinner, StatTile, TeamBadge, ROLE_LABEL, useFormat } from '../components/ui';
import { getPlayerAuthorityLinks, buildPlayerSchemaLdJson, AuthorityLink } from '../data/playerLinks';

export default function PlayerPage({ id }: { id: string }) {
  const { teamById, config } = useApp();
  const t = useT();
  const f = useFormat();
  const { data, error, loading, reload } = useLoad(() => api.getPlayer(id), [id]);
  const p = data?.player;
  const team = data?.team;

  usePageMeta(
    p ? `${p.name} – ${team?.name} (Abu Dhabi T10 2026)` : null,
    p ? t('{name} plays for {team} in the Abu Dhabi T10. Career stats, Cricbuzz profile, social channels, and Pick XI fantasy records.', { name: p.name, team: team?.name || '' }) : undefined,
    config?.brandName
  );

  // SEO: Embed Schema.org Person JSON-LD with sameAs authority links
  useEffect(() => {
    if (!p || !team) return;
    const scriptId = `schema-player-${p.id}`;
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    const schemaData = buildPlayerSchemaLdJson(p, team);
    script.textContent = JSON.stringify(schemaData);

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [p?.id, team?.id]);

  const authorityLinks = useMemo(() => {
    if (!p) return [];
    return getPlayerAuthorityLinks(p, team);
  }, [p, team]);

  const cricketLinks = useMemo(() => authorityLinks.filter(l => l.category === 'cricket'), [authorityLinks]);
  const socialLinks = useMemo(() => authorityLinks.filter(l => l.category === 'social'), [authorityLinks]);

  if (loading && !data) return <Spinner />;
  if (error || !p || !data || !team) return <ErrorBox message={error || t('Player not found')} onRetry={reload} />;

  const scored = data.fixtures.filter(x => x.fantasyPoints !== null);
  const avg = scored.length ? Math.round((scored.reduce((s, x) => s + (x.fantasyPoints || 0), 0) / scored.length) * 10) / 10 : null;

  const renderIcon = (platform: AuthorityLink['platform']) => {
    switch (platform) {
      case 'cricbuzz':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'cricinfo':
        return <BarChart2 className="w-4 h-4 text-blue-400" />;
      case 'wikipedia':
        return <BookOpen className="w-4 h-4 text-slate-300" />;
      case 'icc':
        return <Award className="w-4 h-4 text-amber-400" />;
      case 'youtube':
        return <Youtube className="w-4 h-4 text-rose-400" />;
      default:
        return <Share2 className="w-4 h-4 text-amber-300" />;
    }
  };

  return (
    <div className="space-y-6">
      <nav className="text-xs text-slate-500">
        <Link to="/players" className="hover:text-white">{t('Players')}</Link> / {p.name}
      </nav>

      {/* Main Player Profile Card */}
      <Card className="p-5 sm:p-6 flex flex-col sm:flex-row gap-5 sm:items-center bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-800">
        <Avatar name={p.name} src={p.photoUrl} size={96} />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white">{p.name}</h1>
            {p.isIcon && (
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Icon Player
              </span>
            )}
          </div>
          <Link to={`/teams/${team.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-200 hover:text-amber-300">
            <TeamBadge team={teamById(team.id) || team} size="sm" /> {team.name}
          </Link>
          <div className="flex flex-wrap gap-2">
            <Pill>{t(ROLE_LABEL[p.role])}</Pill>
            {p.category && <Pill tone={p.category === 'Icon' ? 'amber' : 'blue'}>{t('{category} signing', { category: t(p.category) })}</Pill>}
            {p.nationality && <Pill tone="blue">{p.nationality}</Pill>}
          </div>
          <p className="text-sm text-slate-400">{[p.battingStyle, p.bowlingStyle].filter(Boolean).join(' · ')}</p>
        </div>
        {p.cricbuzzProfileUrl && (
          <ButtonLink to={p.cricbuzzProfileUrl} external variant="secondary" className="shrink-0 font-bold border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10">
            <Globe className="w-4 h-4 text-emerald-400" /> {t('Cricbuzz Career Profile')} <ExternalLink className="w-3.5 h-3.5" />
          </ButtonLink>
        )}
      </Card>

      {/* Pick XI Fantasy Overview */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('Pick XI credits')} value={p.credits ?? '—'} accent />
        <StatTile label={t('Matches scored')} value={scored.length} />
        <StatTile label={t('Avg Pick XI points')} value={avg ?? '—'} />
      </div>

      {/* Cricketing Authority & Stats Sites (SEO Anchors) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle title={t('Cricket Stats & Authority Profiles')} />
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> SEO Authority Links
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cricketLinks.map(link => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 transition-all flex items-start gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                {renderIcon(link.platform)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                    {link.label}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{link.description}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Social Media & Highlights Channels */}
      <section className="space-y-3">
        <SectionTitle title={t('Official Social & Fan Channels')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {socialLinks.map(link => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/40 hover:bg-slate-800/40 transition-all flex flex-col justify-between gap-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {renderIcon(link.platform)}
                  <span className="text-xs font-bold text-white group-hover:text-amber-300">{link.label}</span>
                </div>
                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-amber-400" />
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{link.description}</p>
              {link.handle && (
                <span className="text-[11px] font-mono text-amber-400/90 truncate">{link.handle}</span>
              )}
            </a>
          ))}
        </div>
      </section>

      {/* Fixtures & Fantasy Form */}
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
