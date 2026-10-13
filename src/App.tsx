import React, { lazy, Suspense, useEffect } from 'react';
import { AppProvider, useApp } from './state';
import { useRoute } from './router';
import { useT } from './i18n';
import { BottomNav, Footer, Header, Toasts } from './components/Shell';
import { AuthModal, completeRedirectSignIn } from './components/AuthModal';
import { TeamPickerModal } from './components/TeamPickerModal';
import { ErrorBox, Spinner } from './components/ui';

const HomePage = lazy(() => import('./pages/HomePage'));
const MatchesPage = lazy(() => import('./pages/MatchesPage'));
const MatchPage = lazy(() => import('./pages/MatchPage'));
const TeamsPage = lazy(() => import('./pages/TeamsPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const PlayersPage = lazy(() => import('./pages/PlayersPage'));
const PlayerPage = lazy(() => import('./pages/PlayerPage'));
const SocialPage = lazy(() => import('./pages/SocialPage'));
const PlayPage = lazy(() => import('./pages/PlayPage'));
const FantasyPage = lazy(() => import('./pages/FantasyPage'));
const FantasyMatchPage = lazy(() => import('./pages/FantasyMatchPage'));
const GamesPage = lazy(() => import('./pages/GamesPage'));
const ContestsPage = lazy(() => import('./pages/ContestsPage'));
const PrizesPage = lazy(() => import('./pages/PrizesPage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const FansPage = lazy(() => import('./pages/FansPage'));
const ForumPage = lazy(() => import('./pages/ForumPage'));
const ThreadPage = lazy(() => import('./pages/ThreadPage'));
const FanSpacesPage = lazy(() => import('./pages/FanSpacesPage'));
const GrowthPage = lazy(() => import('./pages/GrowthPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const InfoPage = lazy(() => import('./pages/InfoPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ProposalPage = lazy(() => import('./pages/ProposalPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

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
  render() {
    if (this.state.error) {
      const chunk = /Failed to fetch dynamically imported module|Importing a module script failed/i.test(this.state.error.message);
      return <ErrorBox message={chunk ? 'A new version of the site is available. Reload the page to continue.' : 'This page hit a problem. Please reload.'} onRetry={() => window.location.reload()} />;
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
            <Suspense fallback={<Spinner />}>
              <Page />
            </Suspense>
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
