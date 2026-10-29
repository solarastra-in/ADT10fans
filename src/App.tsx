import React, { useEffect } from 'react';
import { AppProvider, useApp } from './state';
import { useRoute } from './router';
import { useT } from './i18n';
import { BottomNav, Footer, Header, Toasts } from './components/Shell';
import { AuthModal, completeRedirectSignIn } from './components/AuthModal';
import { TeamPickerModal } from './components/TeamPickerModal';
import { PlayerCardHost } from './components/PlayerCard';
import { ErrorBox, Spinner } from './components/ui';

import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';

// Every page except the home page is its own chunk, loaded when it is first opened: visitors no
// longer download the admin console, the Pick XI analytics and the charts just to read a score.
const MatchesPage = React.lazy(() => import('./pages/MatchesPage'));
const MatchPage = React.lazy(() => import('./pages/MatchPage'));
const TeamsPage = React.lazy(() => import('./pages/TeamsPage'));
const TeamPage = React.lazy(() => import('./pages/TeamPage'));
const PlayersPage = React.lazy(() => import('./pages/PlayersPage'));
const PlayerPage = React.lazy(() => import('./pages/PlayerPage'));
const SocialPage = React.lazy(() => import('./pages/SocialPage'));
const PlayPage = React.lazy(() => import('./pages/PlayPage'));
const FantasyPage = React.lazy(() => import('./pages/FantasyPage'));
const FantasyMatchPage = React.lazy(() => import('./pages/FantasyMatchPage'));
const GamesPage = React.lazy(() => import('./pages/GamesPage'));
const DuelPage = React.lazy(() => import('./pages/DuelPage'));
const FanWallPage = React.lazy(() => import('./pages/FanWallPage'));
const FanPostPage = React.lazy(() => import('./pages/FanPostPage'));
const ContestsPage = React.lazy(() => import('./pages/ContestsPage'));
const PrizesPage = React.lazy(() => import('./pages/PrizesPage'));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'));
const FansPage = React.lazy(() => import('./pages/FansPage'));
const ForumPage = React.lazy(() => import('./pages/ForumPage'));
const ThreadPage = React.lazy(() => import('./pages/ThreadPage'));
const FanSpacesPage = React.lazy(() => import('./pages/FanSpacesPage'));
const GrowthPage = React.lazy(() => import('./pages/GrowthPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const InfoPage = React.lazy(() => import('./pages/InfoPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const FanClubAdminPage = React.lazy(() => import('./pages/FanClubAdminPage').then(m => ({ default: m.FanClubAdminPage })));
const ProposalPage = React.lazy(() => import('./pages/ProposalPage'));
import { InstagramFollowModal } from './components/InstagramFollowModal';

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
    case 'proposal': return <ProposalPage />;
    default: return <NotFoundPage />;
  }
}

class PageBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
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
  render() {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error);
      const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|valid JavaScript MIME type/i.test(msg);
      return (
        <ErrorBox
          message={isChunkError ? 'A fresh version of this page is ready. Reload to load the latest updates.' : `This page hit an issue: ${msg}`}
          onRetry={() => {
            sessionStorage.removeItem('auto_reload_chunk');
            this.setState({ error: null });
            if (isChunkError) window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}

function Shell() {
  const route = useRoute();
  const { ready, bootError, reloadAll, setUser, toast } = useApp();
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
      <InstagramFollowModal />
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
