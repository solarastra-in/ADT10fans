import React from 'react';
import { ExternalLink, GraduationCap, Headphones, Star, Video } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { usePageMeta } from '../router';
import { Avatar, Button, Card, EmptyState, ErrorBox, PageHeader, Pill, SectionTitle, Spinner } from '../components/ui';

export default function GrowthPage() {
  const { user, openAuth, toast, config } = useApp();
  const t = useT();
  usePageMeta(t('Youth cup and creators'), t('The schools youth cup, creator partners and commentary feeds.'), config?.brandName);
  const { data, error, loading, reload } = useLoad(() => api.getGrowthCatalysts(), []);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const empty = !data.youthSchools.length && !data.creatorPartners.length && !data.commentaryFeeds.length && !data.passportTiers.length;
  const join = async (tierId: string) => {
    if (!user) return openAuth(t('Sign in to register your interest.'));
    try {
      const r = await api.subscribeSuperfanPassport(tierId);
      toast(r.alreadyRegistered ? t('You are already on the list') : t('Thanks! We will be in touch.'));
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  return (
    <div className="space-y-8">
      <PageHeader eyebrow={t('Community programmes')} title={t('Youth cup, creators & more')} />
      {empty && <EmptyState title={t('Programmes will be announced soon')} body={t('School tournaments, creator watch-alongs and commentary in more languages are on the way.')} />}
      {data.creatorPartners.length > 0 && (
        <section>
          <SectionTitle title={t('Creator partners')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.creatorPartners.map(c => (
              <a key={c.id} href={c.streamUrl} target="_blank" rel="noopener noreferrer">
                <Card className="p-4 flex items-center gap-3 hover:border-slate-600">
                  <Avatar name={c.name} src={c.avatar} size={44} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-white truncate">{c.name}</span>
                    <span className="block text-xs text-slate-400 truncate">{c.platform} · {c.specialty}</span>
                  </span>
                  {c.status === 'live' ? <Pill tone="red">{t('LIVE')}</Pill> : <Video className="w-4 h-4 text-slate-500" />}
                </Card>
              </a>
            ))}
          </div>
        </section>
      )}
      {data.commentaryFeeds.length > 0 && (
        <section>
          <SectionTitle title={t('Commentary in your language')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.commentaryFeeds.map(fd => (
              <a key={fd.id} href={fd.streamUrl} target="_blank" rel="noopener noreferrer">
                <Card className="p-4 flex items-center gap-3 hover:border-slate-600">
                  <Headphones className="w-6 h-6 text-amber-400" />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-white">{fd.language}</span>
                    <span className="block text-xs text-slate-400 truncate">{fd.commentator}{fd.description ? ` · ${fd.description}` : ''}</span>
                  </span>
                  {fd.status === 'live' ? <Pill tone="red">{t('LIVE')}</Pill> : <ExternalLink className="w-4 h-4 text-slate-500" />}
                </Card>
              </a>
            ))}
          </div>
        </section>
      )}
      {data.youthSchools.length > 0 && (
        <section>
          <SectionTitle title={t('Schools youth cup')} />
          <Card className="divide-y divide-slate-800">
            {data.youthSchools.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <GraduationCap className="w-5 h-5 text-amber-400" />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-white truncate">{s.name}</span>
                  <span className="block text-xs text-slate-400">{[s.city, s.region].filter(Boolean).join(', ')}{s.tapeBallTeam ? ` · ${s.tapeBallTeam}` : ''}</span>
                </span>
                <Pill tone={s.status === 'champion' ? 'amber' : s.status === 'bracket_qualified' ? 'green' : 'slate'}>{s.status === 'champion' ? t('Champion') : s.status === 'bracket_qualified' ? t('Qualified') : t('Registered')}</Pill>
              </div>
            ))}
          </Card>
        </section>
      )}
      {data.passportTiers.length > 0 && (
        <section>
          <SectionTitle title={t('Superfan membership')} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.passportTiers.map(tier => (
              <Card key={tier.id} className="p-5 space-y-2">
                <div className="flex items-center gap-2"><Star className="w-5 h-5 text-amber-400" /><h3 className="font-black text-white">{tier.tierName}</h3></div>
                {tier.description && <p className="text-sm text-slate-400">{tier.description}</p>}
                <p className="text-sm text-slate-300">{tier.annualFeeAed ? `AED ${tier.annualFeeAed}` : ''}{tier.annualFeeUsd ? ` / USD ${tier.annualFeeUsd}` : ''} {t('per year')}</p>
                {tier.signupUrl ? (
                  <a href={tier.signupUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center px-4 rounded-xl bg-amber-400 text-slate-950 font-bold text-sm">{t('Sign up')}</a>
                ) : (
                  <Button variant="secondary" onClick={() => join(tier.id)}>{t('Register interest')}</Button>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
