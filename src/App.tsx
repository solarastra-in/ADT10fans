import React, { useEffect } from 'react';
import { AppProvider, useApp } from './state';
import { useRoute } from './router';
import { useT } from './i18n';
import { BottomNav, FloatingQRButton, Footer, Header, Toasts } from './components/Shell';
import { AuthModal, completeRedirectSignIn } from './components/AuthModal';
import { TeamPickerModal } from './components/TeamPickerModal';
import { PlayerCardHost } from './components/PlayerCard';
import { ErrorBox, Spinner } from './components/ui';

import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import { QuickQRPassModal } from './components/QuickQRPassModal';

// Resilient lazy loader that retries failed chunk fetches (e.g. during server restarts or transient drops)
function safeLazy<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T } | T>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      const mod = await importer();
      return 'default' in mod ? (mod as { default: T }) : { default: mod as T };
    } catch (err: any) {
      console.warn('Dynamic import chunk failed, retrying after backoff...', err);
      await new Promise(res => setTimeout(res, 500));
      try {
        const mod = await importer();
        return 'default' in mod ? (mod as { default: T }) : { default: mod as T };
      } catch (err2: any) {
        await new Promise(res => setTimeout(res, 1000));
        const mod = await importer();
        return 'default' in mod ? (mod as { default: T }) : { default: mod as T };
      }
    }
  });
}


// Every page except the home page is its own chunk, loaded when it is first opened: visitors no
// longer download the admin console, the Pick XI analytics and the charts just to read a score.
const MatchesPage = safeLazy(() => import('./pages/MatchesPage'));
const MatchPage = safeLazy(() => import('./pages/MatchPage'));
const TeamsPage = safeLazy(() => import('./pages/TeamsPage'));
const TeamPage = safeLazy(() => import('./pages/TeamPage'));
const PlayersPage = safeLazy(() => import('./pages/PlayersPage'));
const PlayerPage = safeLazy(() => import('./pages/PlayerPage'));
const SocialPage = safeLazy(() => import('./pages/SocialPage'));
const PlayPage = safeLazy(() => import('./pages/PlayPage'));
const FantasyPage = safeLazy(() => import('./pages/FantasyPage'));
const FantasyMatchPage = safeLazy(() => import('./pages/FantasyMatchPage'));
const GamesPage = safeLazy(() => import('./pages/GamesPage'));
const DuelPage = safeLazy(() => import('./pages/DuelPage'));
const FanWallPage = safeLazy(() => import('./pages/FanWallPage'));
const FanPostPage = safeLazy(() => import('./pages/FanPostPage'));
const ContestsPage = safeLazy(() => import('./pages/ContestsPage'));
const PrizesPage = safeLazy(() => import('./pages/PrizesPage'));
const LeaderboardPage = safeLazy(() => import('./pages/LeaderboardPage'));
const FansPage = safeLazy(() => import('./pages/FansPage'));
const ForumPage = safeLazy(() => import('./pages/ForumPage'));
const ThreadPage = safeLazy(() => import('./pages/ThreadPage'));
const FanSpacesPage = safeLazy(() => import('./pages/FanSpacesPage'));
const GrowthPage = safeLazy(() => import('./pages/GrowthPage'));
const ProfilePage = safeLazy(() => import('./pages/ProfilePage'));
const InfoPage = safeLazy(() => import('./pages/InfoPage'));
const AdminPage = safeLazy(() => import('./pages/AdminPage'));
const FanClubAdminPage = safeLazy(() => import('./components/admin/FanClubDesk').then(m => ({ default: m.FanClubAdminPage })));
const TeamPortalPage = safeLazy(() => import('./pages/TeamPortalPage'));
const TeamInvitePage = safeLazy(() => import('./pages/TeamInvitePage'));
const ProposalPage = safeLazy(() => import('./pages/ProposalPage'));
const TeamGamesPage = safeLazy(() => import('./pages/TeamGamesPage'));
const Pick5Page = safeLazy(() => import('./pages/TeamGamesPage').then(m => ({ default: m.Pick5Page })));
const FanClubPage = safeLazy(() => import('./pages/FanClubPage'));
const StaffPage = safeLazy(() => import('./pages/StaffPage'));
import { InstagramGate } from './components/InstagramGate';

function Page() {
  const route = useRoute();
  const p = route.params;
  switch (route.name) {
    case 'home': return <HomePage />;
    case 'matches': return <MatchesPage />;
    case 'match': return <MatchPage id={p.id} />;
    case 'teams': return <TeamsPage />;
    case 'team': return <TeamPage id={p.id} />;
    case 'players': return <PlayersPage />;
    case 'player': return <PlayerPage id={p.id} />;
    case 'social': return <SocialPage mode="social" />;
    case 'videos': return <SocialPage mode="videos" />;
    case 'news': return <SocialPage mode="news" />;
    case 'play': return <PlayPage />;
    case 'teamGames': return <TeamGamesPage />;
    case 'pick5': return <Pick5Page id={p.id} />;
    case 'fanclub': return <FanClubPage />;
    case 'staff': return <StaffPage />;
    case 'fantasy': return <FantasyPage />;
    case 'fantasyMatch': return <FantasyMatchPage id={p.id} />;
    case 'games': return <GamesPage />;
    case 'duel': return <DuelPage code={p.code} />;
    case 'fanwall': return <FanWallPage />;
    case 'fanPost': return <FanPostPage id={p.id} />;
    case 'contests': return <ContestsPage />;
    case 'prizes': return <PrizesPage />;
    case 'leaderboard': return <LeaderboardPage />;
    case 'fans': return <FansPage />;
    case 'forum': return <ForumPage />;
    case 'thread': return <ThreadPage id={p.id} />;
    case 'fanspaces': return <FanSpacesPage />;
    case 'growth': return <GrowthPage />;
    case 'profile': return <ProfilePage />;
    case 'rules':
    case 'privacy':
    case 'terms': return <InfoPage kind={route.name} />;
    case 'adminFanclub': return <FanClubAdminPage />;
    case 'admin': return p.section === 'fanclub' ? <FanClubAdminPage /> : <AdminPage section={p.section} />;
    case 'teamPortal': return <TeamPortalPage section={p.section} />;
    case 'teamInvite': return <TeamInvitePage token={p.token} />;
    case 'proposal': return <ProposalPage />;
    default: return <NotFoundPage />;
  }
}

class PageBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { error: Error | null; retrySeq: number }> {
  state = { error: null as Error | null, retrySeq: 0 };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, retrySeq: 0 });
    }
  }
  componentDidCatch(error: Error) {
    const msg = error?.message || String(error);
    const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|valid JavaScript MIME type/i.test(msg);
    if (isChunkError && typeof window !== 'undefined') {
      const nowBucket = Math.floor(Date.now() / 15000);
      if (sessionStorage.getItem('auto_reload_chunk') !== String(nowBucket)) {
        sessionStorage.setItem('auto_reload_chunk', String(nowBucket));
        window.location.reload();
      }
    }
  }
  handleRetry = () => {
    sessionStorage.removeItem('auto_reload_chunk');
    this.setState(s => ({ error: null, retrySeq: s.retrySeq + 1 }));
  };
  render() {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error);
      const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|valid JavaScript MIME type/i.test(msg);
      return (
        <div className="py-6">
          <ErrorBox
            message={isChunkError ? 'This page is updating. Click Retry to load the latest version.' : `This page hit an issue: ${msg}`}
            onRetry={this.handleRetry}
          />
        </div>
      );
    }
    return <React.Fragment key={this.state.retrySeq}>{this.props.children}</React.Fragment>;
  }
}

function Shell() {
  const route = useRoute();
  const { ready, bootError, reloadAll, setUser, toast, qrPassOpen, closeQrPass } = useApp();
  const t = useT();

  useEffect(() => {
    completeRedirectSignIn()
      .then(r => {
        if (r) {
          setUser(r.user);
          toast(t('Signed in as {name}', { name: r.user.name }));
          reloadAll().catch(() => undefined);
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-amber-400 focus:text-slate-950">
        {t('Skip to content')}
      </a>
      <Header route={route} />
      <main id="main" className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 sm:py-8 pb-28 lg:pb-12 overflow-x-hidden">
        {!ready ? (
          <Spinner />
        ) : bootError ? (
          <ErrorBox message={t('Could not load the site: {error}', { error: bootError })} onRetry={() => window.location.reload()} />
        ) : (
          <PageBoundary resetKey={route.path}>
            <React.Suspense fallback={<Spinner />}>
              <Page />
            </React.Suspense>
          </PageBoundary>
        )}
      </main>
      <Footer />
      <BottomNav route={route} />
      <FloatingQRButton route={route} />
      <QuickQRPassModal isOpen={qrPassOpen} onClose={closeQrPass} />
      <InstagramGate />
      <AuthModal />
      <TeamPickerModal />
      <PlayerCardHost />
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
