import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { navigate, usePageMeta } from '../router';
import { Button, EmptyState, ErrorBox, Spinner } from '../components/ui';
import { AdminPortal } from '../components/AdminPortal';
import type { AgentRun, Approval, Contest, FeedItem, NotificationItem, PrizeDraw, SocialHandle, SystemSettings } from '../types';

interface AdminData {
  handles: SocialHandle[];
  feedItems: FeedItem[];
  contests: Contest[];
  draws: PrizeDraw[];
  settings: SystemSettings;
  approvals: Approval[];
  agentRuns: AgentRun[];
  notifications: NotificationItem[];
}

export default function AdminPage({ section }: { section?: string }) {
  const { user, teams, matches, openAuth, refreshTeams, refreshMatches, refreshUser } = useApp();
  const t = useT();
  usePageMeta(t('Admin console'));
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [dash, handles, feeds, contests, draws, notifs] = await Promise.all([
        api.getAdminDashboard(),
        api.getHandles(),
        api.getFeeds({ limit: 100 }),
        api.getContests(),
        api.getDraws(),
        api.getAdminNotifications().catch(() => ({ notifications: [] as NotificationItem[] })),
      ]);
      setData({
        handles: handles.handles,
        feedItems: feeds.items,
        contests: contests.contests,
        draws: draws.draws,
        settings: dash.settings,
        approvals: dash.pendingApprovals || [],
        agentRuns: dash.agentRuns || [],
        notifications: notifs.notifications,
      });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  // Team admins have their own portal.
  const isTeamAdmin = user?.adminRole === 'team_official';
  useEffect(() => {
    if (isTeamAdmin) navigate('/team-portal', { replace: true });
    else if (user?.role === 'admin') load();
  }, [user?.id, user?.role, isTeamAdmin, load]);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), refreshTeams(), refreshMatches(), refreshUser()]);
  }, [load, refreshTeams, refreshMatches, refreshUser]);

  if (!user) return <EmptyState title={t('Admin console')} body={t('Sign in with an admin account.')} action={<Button onClick={() => openAuth()}>{t('Sign in')}</Button>} />;
  if (user.role !== 'admin') return <EmptyState title={t('Admins only')} body={t('Your account does not have admin access.')} />;
  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner />;
  return (
    <AdminPortal
      currentUser={user}
      teams={teams}
      matches={matches}
      {...data}
      onRefreshAll={refreshAll}
      initialSection={section}
      onSectionChange={id => navigate(`/admin/${id}`, { replace: true, keepScroll: true })}
    />
  );
}
