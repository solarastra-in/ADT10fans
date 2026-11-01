import { useEffect } from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { navigate } from '../router';

/**
 * Whether this fan plays only the team games right now: from their fan club check-in until that
 * match ends. Other game links are hidden while it is true.
 */
export function useTeamGamesOnly(): boolean {
  const { user } = useApp();
  const v = useLoad(() => (user?.fanClubCheckIns?.length ? api.teamGames() : Promise.resolve(null)), [user?.id, user?.fanClubCheckIns?.length]);
  // Check again every minute, so the other games come back when the match ends.
  useEffect(() => {
    if (!user?.fanClubCheckIns?.length) return;
    const id = setInterval(() => v.reload(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.fanClubCheckIns?.length]);
  return Boolean(v.data?.onlyTeamGames && v.data.team);
}

/** On other game pages: a fan checked in at a fan club goes to the team games instead. */
export function TeamGamesOnlyNotice() {
  const only = useTeamGamesOnly();
  useEffect(() => {
    if (only) navigate('/team-games', { replace: true });
  }, [only]);
  return null;
}
