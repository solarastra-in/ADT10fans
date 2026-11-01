import React from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link } from '../router';

/** Shown on other game pages to fans who checked in at a fan club: their games are the team games. */
export function TeamGamesOnlyNotice() {
  const { user } = useApp();
  const t = useT();
  const v = useLoad(() => (user?.fanClubCheckIns?.length ? api.teamGames() : Promise.resolve(null)), [user?.id, user?.fanClubCheckIns?.length]);
  if (!v.data?.onlyTeamGames || !v.data.team) return null;
  return (
    <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100" data-testid="team-games-only-notice">
      {t('As a fan club member you play the {team} games.', { team: v.data.team.name })}{' '}
      <Link to="/team-games" className="font-black underline">{t('Go to the {team} games', { team: v.data.team.short })}</Link>
    </div>
  );
}
