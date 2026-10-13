import React from 'react';
import { useT } from '../i18n';
import { usePageMeta } from '../router';
import { ButtonLink, EmptyState } from '../components/ui';

export default function NotFoundPage() {
  const t = useT();
  usePageMeta(t('Page not found'));
  return <EmptyState title={t('Page not found')} body={t('The page you asked for does not exist or has moved.')} action={<ButtonLink to="/">{t('Go home')}</ButtonLink>} />;
}
