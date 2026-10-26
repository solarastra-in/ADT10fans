export interface ScrapedTeamScore {
  name: string;
  shortName?: string;
  score?: string; // e.g. "124/3"
  overs?: string; // e.g. "10.0"
  runs?: number;
  wickets?: number;
}

export interface ScrapedBatsman {
  name: string;
  playerId?: string;
  profileUrl?: string;
  dismissal: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isNotOut: boolean;
}

export interface ScrapedBowler {
  name: string;
  playerId?: string;
  profileUrl?: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface ScrapedInnings {
  inningNo: number;
  teamName: string;
  teamId?: string;
  totalRuns: number;
  wickets: number;
  overs: string;
  batting: ScrapedBatsman[];
  bowling: ScrapedBowler[];
}

export interface ScrapedScorecard {
  matchId: string;
  provider: 'cricbuzz' | 'cricinfo' | 'unified';
  title?: string;
  innings: ScrapedInnings[];
}

export interface ScrapedMatchSummary {
  id: string;
  provider: 'cricbuzz' | 'cricinfo';
  title: string;
  seriesName?: string;
  teamA: ScrapedTeamScore;
  teamB: ScrapedTeamScore;
  status: 'upcoming' | 'live' | 'completed' | 'abandoned';
  statusText?: string;
  venue?: string;
  startsAt?: string;
  toss?: string;
  result?: string;
  currentOver?: string;
  lastCommentary?: string;
  url?: string;
}

export interface ScrapedPlayer {
  name: string;
  role?: 'batter' | 'bowler' | 'allrounder' | 'wicketkeeper';
  cricbuzzId?: string;
  cricinfoId?: string;
  profileUrl?: string;
  photoUrl?: string;
  country?: string;
  battingStyle?: string;
  bowlingStyle?: string;
}

export interface ScrapedTeamSquad {
  name: string;
  teamId?: string;
  players: ScrapedPlayer[];
}
