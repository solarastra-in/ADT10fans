import type { Contest } from '../db';
import { OFFICIAL_2026_MATCHES } from './officialMatches';

/**
 * Generates verified prediction contests for every match in the Abu Dhabi T10 2026 tournament.
 * Each match features a prediction contest covering:
 *  1. Match Winner (50 pts)
 *  2. Highest Powerplay Score (overs 1-3) (30 pts)
 *  3. Sixes Milestone: 10+ Sixes in the match (30 pts)
 *  4. Top Strike-Rate Batter or Bowler of the Match (30 pts)
 *
 * Contests lock exactly at the match start time (`startsAt`), allowing users to play all 2 or 3 matches
 * scheduled on the same day simultaneously 24+ hours in advance!
 */
export function generateOfficialMatchContests(): Contest[] {
  const contests: Contest[] = [];

  const teamNames: Record<string, string> = {
    aces: 'Arabian Aces',
    bulls: 'UAE Bulls',
    lions: 'Yas Lions',
    eagles: 'Emirates Eagles',
    champions: 'Royal Desert Champions',
    tigers: 'United Tigers',
  };

  OFFICIAL_2026_MATCHES.forEach(m => {
    const aName = teamNames[m.teamA] || m.teamA;
    const bName = teamNames[m.teamB] || m.teamB;
    const matchId = `m-${m.matchNo}`;

    contests.push({
      id: `contest-m${m.matchNo}`,
      type: 'predictor',
      matchId,
      title: `Match ${m.matchNo}: ${aName} vs ${bName} – Matchday Predictions`,
      description: `Predict the outcome, powerplay domination, and boundary milestones for Match ${m.matchNo}. Open 24h prior, locks at the first delivery.`,
      status: 'open',
      locksAt: m.startsAt,
      instant: false,
      prize: '140 Fan Points + Leaderboard Boost',
      questions: [
        {
          id: `q-m${m.matchNo}-1`,
          prompt: `Who will win Match ${m.matchNo} between ${aName} and ${bName}?`,
          options: [aName, bName],
          points: 50,
        },
        {
          id: `q-m${m.matchNo}-2`,
          prompt: 'Which team will score more runs in the 3-over Powerplay?',
          options: [aName, bName, 'Equal / Tied'],
          points: 30,
        },
        {
          id: `q-m${m.matchNo}-3`,
          prompt: 'Will there be 10 or more maximum sixes hit in this 10-over contest?',
          options: ['Yes (10+ Sixes)', 'No (Under 10 Sixes)'],
          points: 30,
        },
        {
          id: `q-m${m.matchNo}-4`,
          prompt: 'Which team will hit the longest maximum boundary?',
          options: [aName, bName],
          points: 30,
        },
      ],
      createdAt: new Date().toISOString(),
    });
  });

  return contests;
}
