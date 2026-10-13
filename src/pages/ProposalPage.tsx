import React from 'react';
import { useApp } from '../state';
import { useT } from '../i18n';
import { navigate, usePageMeta } from '../router';
import { Button, EmptyState } from '../components/ui';
import { LeagueProposalView } from '../components/LeagueProposalView';

/** The confidential league proposal: admins only (the API behind it is admin-only too). */
export default function ProposalPage() {
  const { user, openAuth } = useApp();
  const t = useT();
  usePageMeta(t('League proposal'));
  if (!user) return <EmptyState title={t('Admins only')} action={<Button onClick={() => openAuth()}>{t('Sign in')}</Button>} />;
  if (user.role !== 'admin') return <EmptyState title={t('Admins only')} body={t('This page is not available.')} />;
  return (
    <LeagueProposalView
      isAdmin
      onNavigateToForum={() => navigate('/forum')}
      onNavigateToContests={() => navigate('/contests')}
      onNavigateToSocial={() => navigate('/social')}
      onNavigateToDraws={() => navigate('/prizes')}
      onNavigateToFanSpaces={() => navigate('/fanspaces')}
      onNavigateToGrowth={() => navigate('/growth')}
      onOpenAdmin={() => navigate('/admin')}
    />
  );
}
