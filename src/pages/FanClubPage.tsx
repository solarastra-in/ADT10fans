import React from 'react';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { PageHeader } from '../components/ui';
import { FanClubCheckInCard } from '../components/FanClubCheckInCard';

/** The fan's fan club pass, and a way in for fan club admins. */
export default function FanClubPage() {
  const { user, config } = useApp();
  const t = useT();
  usePageMeta(t('Fan club pass'), undefined, config?.brandName);
  const runsClubs = user?.role === 'admin' && (user.isSuperAdmin || user.permissions?.includes('all') || user.permissions?.includes('fanclubs'));
  return (
    <div className="space-y-5">
      <PageHeader eyebrow={t('Fan clubs')} title={t('Fan club pass')} subtitle={t('Check in at a fan club on matchdays for points and offers.')} />
      {runsClubs && (
        <Link to="/admin/fanclub" className="inline-flex rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950" data-testid="fanclub-admin-link">
          {t('Open the fan club check-in desk')}
        </Link>
      )}
      <FanClubCheckInCard />
    </div>
  );
}
