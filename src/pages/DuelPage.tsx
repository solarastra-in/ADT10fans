import React from 'react';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, PageHeader } from '../components/ui';
import { DuelRunner } from '../components/SkillGames';

/** A Stat Wars duel opened from an invite link. */
export default function DuelPage({ code }: { code: string }) {
  const { config } = useApp();
  const t = useT();
  usePageMeta(t('Stat Wars duel'), t('Same questions, 60 seconds each. The higher score wins.'), config?.brandName);
  return (
    <div className="space-y-5 max-w-xl">
      <nav className="text-xs text-slate-500">
        <Link to="/games" className="hover:text-white">{t('Games')}</Link> / {t('Stat Wars duel')}
      </nav>
      <PageHeader eyebrow={t('Stat Wars')} title={t('Stat Wars duel')} subtitle={t('Same questions, 60 seconds each. The higher score wins.')} />
      <Card className="p-5">
        <DuelRunner code={code} />
      </Card>
    </div>
  );
}
