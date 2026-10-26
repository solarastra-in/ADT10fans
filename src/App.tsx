import React, { useEffect } from 'react';
import { AppProvider, useApp } from './state';
import { useRoute } from './router';
import { useT } from './i18n';
import { BottomNav, Footer, Header, Toasts } from './components/Shell';
import { AuthModal, completeRedirectSignIn } from './components/AuthModal';
import { TeamPickerModal } from './components/TeamPickerModal';
import { ErrorBox, Spinner } from './components/ui';

import HomePage from './pages/HomePage';
import MatchesPage from './pages/MatchesPage';
import MatchPage from './pages/MatchPage';
import TeamsPage from './pages/TeamsPage';
import TeamPage from './pages/TeamPage';
import PlayersPage from './pages/PlayersPage';
import PlayerPage from './pages/PlayerPage';
import SocialPage from './pages/SocialPage';
import PlayPage from './pages/PlayPage';
import FantasyPage from './pages/FantasyPage';
import FantasyMatchPage from './pages/FantasyMatchPage';
import GamesPage from './pages/GamesPage';
import ContestsPage from './pages/ContestsPage';
import PrizesPage from './pages/PrizesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import FansPage from './pages/FansPage';
import ForumPage from './pages/ForumPage';
import ThreadPage from './pages/ThreadPage';
import FanSpacesPage from './pages/FanSpacesPage';
import GrowthPage from './pages/GrowthPage';
import ProfilePage from './pages/ProfilePage';
import InfoPage from './pages/InfoPage';
import AdminPage from './pages/AdminPage';
import ProposalPage from './pages/ProposalPage';
import NotFoundPage from './pages/NotFoundPage';

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
    case 'admin': return <AdminPage section={p.section} />;
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
            <Page />
          </PageBoundary>
        )}
      </main>
      <Footer />
      <BottomNav route={route} />
      <AuthModal />
      <TeamPickerModal />
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
