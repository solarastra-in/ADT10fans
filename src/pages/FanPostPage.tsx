import React from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta } from '../router';
import { ErrorBox, Spinner } from '../components/ui';
import { FanPostCard } from '../components/fanwall';

/** One fan wall post (the link fans share). */
export default function FanPostPage({ id }: { id: string }) {
  const t = useT();
  const { config } = useApp();
  const { data, error, loading, reload } = useLoad(() => api.getFanPost(id), [id]);
  const p = data?.post;
  usePageMeta(p ? t('{name} on the fan wall', { name: p.userName }) : null, p?.text || undefined, config?.brandName);
  if (loading && !data) return <Spinner />;
  if (error || !p) return <ErrorBox message={error || t('Post not found')} onRetry={reload} />;
  return (
    <div className="space-y-4 max-w-2xl">
      <nav className="text-xs text-slate-500">
        <Link to="/fanwall" className="hover:text-white">{t('Fan wall')}</Link> / {p.userName}
      </nav>
      <FanPostCard post={p} big onRemoved={() => navigate('/fanwall')} />
    </div>
  );
}
