import React from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { Spinner } from '../components/ui';
import HomePage from './HomePage';
import TeamGamesPage from './TeamGamesPage';

/**
 * The landing page: a fan who has checked in at a fan club plays only the team's games, so their
 * home is the Arabian Aces page (where they are checked in today, the club's offers, Pick 5 and the
 * Aces predictions). Everyone else gets the usual home page.
 */
export default function HomeOrAces() {
  const { user } = useApp();
  const checkedIn = Boolean(user?.fanClubCheckIns?.length) && user?.role !== 'admin';
  const st = useLoad(() => (checkedIn ? api.getFanClubStatus() : Promise.resolve(null)), [user?.id, checkedIn]);
  if (!checkedIn) return <HomePage />;
  if (st.loading && !st.data) return <Spinner />;
  return st.data?.gamesTeamId ? (
    <div data-testid="aces-landing">
      <TeamGamesPage />
    </div>
  ) : (
    <HomePage />
  );
}
