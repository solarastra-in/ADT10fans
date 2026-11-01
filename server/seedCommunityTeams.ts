import { AppStore, db, FantasyTeam, Match, User } from './db';

interface SeedFanUser {
  id: string;
  name: string;
  avatar: string;
  city: string;
  country: string;
  teamId: string;
}

const COMMUNITY_FANS: SeedFanUser[] = [
  { id: 'usr-fan-hyd-1', name: 'Charminar Aces Fan', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-hyd-2', name: 'Banjara Hitter XI', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-hyd-3', name: 'Cyberabad Aces Club', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-hyd-4', name: 'Secunderabad Strikers', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'bulls' },
  { id: 'usr-fan-hyd-5', name: 'Deccan Aces XI', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-hyd-6', name: 'Gachibowli T10 Kings', avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'bulls' },
  { id: 'usr-fan-hyd-7', name: 'Jubilee Hills Aces', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-hyd-8', name: 'Old City Aces Fan', avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-dxb-1', name: 'Dubai Marina Aces', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', city: 'Dubai, UAE', country: 'UAE', teamId: 'aces' },
  { id: 'usr-fan-auh-1', name: 'Abu Dhabi Aces Hub', avatar: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=150', city: 'Abu Dhabi, UAE', country: 'UAE', teamId: 'aces' },
  { id: 'usr-fan-hyd-9', name: 'Madina Aces Squad', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
  { id: 'usr-fan-hyd-10', name: 'Kukatpally Smashers', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'lions' },
  { id: 'usr-fan-uk-1', name: 'London Aces FanClub', avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=150', city: 'London, UK', country: 'United Kingdom', teamId: 'aces' },
  { id: 'usr-fan-hyd-11', name: 'Begumpet Aces Club', avatar: 'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=150', city: 'Hyderabad, India', country: 'India', teamId: 'aces' },
];

export function seedCommunityFantasyTeams(store: AppStore, now = new Date().toISOString()): boolean {
  let changed = false;

  // 1. Ensure seed users exist in store.users
  const userMap = new Map(store.users.map(u => [u.id, u]));
  for (const cf of COMMUNITY_FANS) {
    if (!userMap.has(cf.id)) {
      const newUser: User = {
        id: cf.id,
        email: `${cf.id}@arabianaces.fans`,
        name: cf.name,
        avatar: cf.avatar,
        city: cf.city,
        country: cf.country,
        teamId: cf.teamId,
        provider: 'email',
        teamChanges: 0,
        points: 450,
        streak: 3,
        badges: ['founder', 'matchday-scout'],
        role: 'fan',
        createdAt: now,
      };
      store.users.push(newUser);
      userMap.set(cf.id, newUser);
      changed = true;
    } else {
      const u = userMap.get(cf.id)!;
      if (!u.avatar && cf.avatar) {
        u.avatar = cf.avatar;
        changed = true;
      }
      if (!u.city && cf.city) {
        u.city = cf.city;
        changed = true;
      }
    }
  }

  // 2. Configure Match 1 (Bulls vs Lions) with an authentic completed T10 match scorecard
  const m1 = store.matches.find(m => m.id === 'm-1' || m.matchNo === 1);
  if (m1) {
    m1.status = 'completed';
    m1.scoreA = '128/3';
    m1.oversA = '10.0';
    m1.scoreB = '124/5';
    m1.oversB = '10.0';
    m1.winner = 'bulls';
    m1.result = 'UAE Bulls won by 4 runs';
    m1.toss = 'Yas Lions won the toss and elected to bowl';
    m1.playerOfTheMatch = 'Kieron Pollard';
    m1.totalSixes = 14;
    m1.topScorer = 'Kieron Pollard (54 off 20)';
    m1.topWicketTaker = 'Trent Boult (2/18)';
    m1.scorecard = {
      innings1: {
        teamId: 'bulls',
        teamName: 'UAE Bulls',
        totalRuns: 128,
        wickets: 3,
        overs: '10.0',
        runRate: 12.8,
        batting: [
          { batsman: 'Andre Fletcher', dismissal: 'c Gous b Willey', runs: 28, balls: 11, fours: 3, sixes: 2, strikeRate: 254.5 },
          { batsman: 'Khawaja Nafay', dismissal: 'c Vince b Farooqi', runs: 18, balls: 9, fours: 2, sixes: 1, strikeRate: 200.0 },
          { batsman: 'Kieron Pollard', dismissal: 'not out', runs: 54, balls: 20, fours: 4, sixes: 5, strikeRate: 270.0, isNotOut: true },
          { batsman: 'Sunil Narine', dismissal: 'c Holder b Janat', runs: 12, balls: 6, fours: 1, sixes: 1, strikeRate: 200.0 },
          { batsman: 'Romario Shepherd', dismissal: 'not out', runs: 14, balls: 5, fours: 1, sixes: 1, strikeRate: 280.0, isNotOut: true },
        ],
        bowling: [
          { bowler: 'Fazalhaq Farooqi', overs: '2.0', maidens: 0, runs: 22, wickets: 1, economy: 11.0 },
          { bowler: 'David Willey', overs: '2.0', maidens: 0, runs: 24, wickets: 1, economy: 12.0 },
          { bowler: 'Karim Janat', overs: '2.0', maidens: 0, runs: 26, wickets: 1, economy: 13.0 },
          { bowler: 'Jason Holder', overs: '2.0', maidens: 0, runs: 28, wickets: 0, economy: 14.0 },
          { bowler: 'Dasun Shanaka', overs: '2.0', maidens: 0, runs: 28, wickets: 0, economy: 14.0 },
        ],
        didNotBat: ['Muhammad Rohid', 'Muhammad Amir', 'Nuwan Thushara', 'Aneurin Donald', 'Tahir Zaman', 'Romario Shepherd'],
      },
      innings2: {
        teamId: 'lions',
        teamName: 'Yas Lions',
        totalRuns: 124,
        wickets: 5,
        overs: '10.0',
        runRate: 12.4,
        batting: [
          { batsman: 'Andries Gous', dismissal: 'c Fletcher b Amir', runs: 36, balls: 14, fours: 4, sixes: 2, strikeRate: 257.1 },
          { batsman: 'James Vince', dismissal: 'b Pollard', runs: 24, balls: 11, fours: 3, sixes: 1, strikeRate: 218.2 },
          { batsman: 'Jason Holder', dismissal: 'c Pollard b Rohid', runs: 32, balls: 15, fours: 3, sixes: 2, strikeRate: 213.3 },
          { batsman: 'Dasun Shanaka', dismissal: 'c Donald b Thushara', runs: 8, balls: 5, fours: 1, sixes: 0, strikeRate: 160.0 },
          { batsman: 'David Willey', dismissal: 'run out (Fletcher)', runs: 16, balls: 9, fours: 2, sixes: 0, strikeRate: 177.8 },
          { batsman: 'Karim Janat', dismissal: 'not out', runs: 6, balls: 4, fours: 0, sixes: 0, strikeRate: 150.0, isNotOut: true },
        ],
        bowling: [
          { bowler: 'Muhammad Amir', overs: '2.0', maidens: 0, runs: 20, wickets: 1, economy: 10.0 },
          { bowler: 'Kieron Pollard', overs: '2.0', maidens: 0, runs: 22, wickets: 1, economy: 11.0 },
          { bowler: 'Nuwan Thushara', overs: '2.0', maidens: 0, runs: 24, wickets: 1, economy: 12.0 },
          { bowler: 'Muhammad Rohid', overs: '2.0', maidens: 0, runs: 26, wickets: 1, economy: 13.0 },
          { bowler: 'Sunil Narine', overs: '2.0', maidens: 0, runs: 30, wickets: 0, economy: 15.0 },
        ],
        didNotBat: ['Awais Ahmed', 'Ansh Tandon', 'Fazalhaq Farooqi', 'Sanjay Krishnamurthi'],
      },
    };
    changed = true;
  }

  // 3. Seed community registered fantasy teams for Match 1
  const m1Teams = store.fantasyTeams.filter(f => f.matchId === 'm-1');
  if (m1Teams.length < 10) {
    const bullsPool = [
      'bulls-kieron-pollard',
      'bulls-sunil-narine',
      'bulls-romario-shepherd',
      'bulls-muhammad-rohid',
      'bulls-mohammad-amir',
      'bulls-andre-fletcher',
      'bulls-khawaja-nafay',
      'bulls-nuwan-thushara',
    ];
    const lionsPool = [
      'lions-jason-holder',
      'lions-david-willey',
      'lions-andries-gous',
      'lions-james-vince',
      'lions-dasun-shanaka',
      'lions-fazalhaq-farooqi',
      'lions-karim-janat',
    ];

    const teamConfigs: {
      userId: string;
      variationName: string;
      captainId: string;
      viceCaptainId: string;
      playerIds: string[];
    }[] = [
      {
        userId: 'usr-fan-hyd-1',
        variationName: 'Charminar Aces XI',
        captainId: 'bulls-kieron-pollard', // 2x captain = highest points
        viceCaptainId: 'lions-andries-gous',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-khawaja-nafay', 'bulls-sunil-narine', 'bulls-romario-shepherd', 'bulls-mohammad-amir',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-fazalhaq-farooqi'
        ],
      },
      {
        userId: 'usr-fan-hyd-2',
        variationName: 'Banjara Power Hitters',
        captainId: 'lions-jason-holder',
        viceCaptainId: 'bulls-kieron-pollard',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-mohammad-amir', 'bulls-nuwan-thushara', 'bulls-muhammad-rohid',
          'lions-jason-holder', 'lions-andries-gous', 'lions-david-willey', 'lions-james-vince', 'lions-dasun-shanaka', 'lions-karim-janat'
        ],
      },
      {
        userId: 'usr-fan-hyd-3',
        variationName: 'Cyberabad Blasters',
        captainId: 'bulls-andre-fletcher',
        viceCaptainId: 'bulls-kieron-pollard',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-sunil-narine', 'bulls-romario-shepherd', 'bulls-mohammad-amir', 'bulls-nuwan-thushara',
          'lions-jason-holder', 'lions-andries-gous', 'lions-david-willey', 'lions-fazalhaq-farooqi', 'lions-james-vince'
        ],
      },
      {
        userId: 'usr-fan-hyd-4',
        variationName: 'Secunderabad Strikers',
        captainId: 'lions-andries-gous',
        viceCaptainId: 'bulls-kieron-pollard',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-khawaja-nafay', 'bulls-mohammad-amir', 'bulls-muhammad-rohid',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-karim-janat', 'lions-fazalhaq-farooqi'
        ],
      },
      {
        userId: 'usr-fan-hyd-5',
        variationName: 'Deccan Royals XI',
        captainId: 'bulls-kieron-pollard',
        viceCaptainId: 'lions-david-willey',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-sunil-narine', 'bulls-romario-shepherd', 'bulls-muhammad-rohid', 'bulls-nuwan-thushara',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-karim-janat'
        ],
      },
      {
        userId: 'usr-fan-dxb-1',
        variationName: 'Dubai Aces Titans',
        captainId: 'lions-david-willey',
        viceCaptainId: 'bulls-andre-fletcher',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-khawaja-nafay', 'bulls-mohammad-amir', 'bulls-muhammad-rohid',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-fazalhaq-farooqi', 'lions-dasun-shanaka'
        ],
      },
      {
        userId: 'usr-fan-auh-1',
        variationName: 'Abu Dhabi Aces Legion',
        captainId: 'bulls-kieron-pollard',
        viceCaptainId: 'bulls-andre-fletcher',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-sunil-narine', 'bulls-romario-shepherd', 'bulls-mohammad-amir', 'bulls-nuwan-thushara',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-karim-janat'
        ],
      },
      {
        userId: 'usr-fan-hyd-7',
        variationName: 'Jubilee Hills Aces XI',
        captainId: 'lions-jason-holder',
        viceCaptainId: 'lions-andries-gous',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-mohammad-amir', 'bulls-muhammad-rohid', 'bulls-nuwan-thushara',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-dasun-shanaka', 'lions-karim-janat'
        ],
      },
      {
        userId: 'usr-fan-hyd-8',
        variationName: 'Old City Aces Hitter',
        captainId: 'bulls-andre-fletcher',
        viceCaptainId: 'lions-jason-holder',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-khawaja-nafay', 'bulls-sunil-narine', 'bulls-romario-shepherd', 'bulls-mohammad-amir',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-fazalhaq-farooqi'
        ],
      },
      {
        userId: 'usr-fan-uk-1',
        variationName: 'London Aces Knights',
        captainId: 'bulls-mohammad-amir',
        viceCaptainId: 'bulls-kieron-pollard',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-sunil-narine', 'bulls-mohammad-amir', 'bulls-muhammad-rohid', 'bulls-nuwan-thushara',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-fazalhaq-farooqi'
        ],
      },
      {
        userId: 'usr-fan-hyd-11',
        variationName: 'Begumpet Aces Brigade',
        captainId: 'bulls-kieron-pollard',
        viceCaptainId: 'lions-james-vince',
        playerIds: [
          'bulls-kieron-pollard', 'bulls-andre-fletcher', 'bulls-khawaja-nafay', 'bulls-romario-shepherd', 'bulls-mohammad-amir',
          'lions-andries-gous', 'lions-jason-holder', 'lions-david-willey', 'lions-james-vince', 'lions-dasun-shanaka', 'lions-karim-janat'
        ],
      },
    ];

    for (const tc of teamConfigs) {
      if (!store.fantasyTeams.some(f => f.userId === tc.userId && f.matchId === 'm-1')) {
        const ft: FantasyTeam = {
          userId: tc.userId,
          matchId: 'm-1',
          playerIds: tc.playerIds,
          captainId: tc.captainId,
          viceCaptainId: tc.viceCaptainId,
          variationId: 'var-1',
          variationName: tc.variationName,
          createdAt: now,
          updatedAt: now,
        };
        store.fantasyTeams.push(ft);
        changed = true;
      }
    }
  }

  // 4. Also seed community registrations for Match 3 (Tigers vs Arabian Aces)
  const m3Teams = store.fantasyTeams.filter(f => f.matchId === 'm-3');
  if (m3Teams.length < 8) {
    const acesPool = [
      'aces-moeen-ali',
      'aces-andre-russell',
      'aces-liam-livingstone',
      'aces-alishan-sharafu',
      'aces-tom-kohler-cadmore',
      'aces-richard-gleeson',
      'aces-alzarri-joseph',
    ];
    const tigersPool = [
      'tigers-fakhar-zaman',
      'tigers-iftikhar-ahmed',
      'tigers-faheem-ashraf',
      'tigers-azmatullah-omarzai',
      'tigers-joe-clarke',
      'tigers-abbas-afridi',
    ];

    const m3Configs = [
      { userId: 'usr-fan-hyd-1', name: 'Charminar Aces XI', c: 'aces-andre-russell', vc: 'aces-moeen-ali' },
      { userId: 'usr-fan-hyd-2', name: 'Banjara Sixers', c: 'aces-moeen-ali', vc: 'aces-liam-livingstone' },
      { userId: 'usr-fan-hyd-3', name: 'Cyberabad Aces Hub', c: 'aces-liam-livingstone', vc: 'tigers-fakhar-zaman' },
      { userId: 'usr-fan-hyd-5', name: 'Deccan Aces Army', c: 'aces-andre-russell', vc: 'tigers-azmatullah-omarzai' },
      { userId: 'usr-fan-dxb-1', name: 'Dubai Marina Aces', c: 'aces-moeen-ali', vc: 'aces-andre-russell' },
      { userId: 'usr-fan-auh-1', name: 'Abu Dhabi Aces', c: 'aces-tom-kohler-cadmore', vc: 'aces-moeen-ali' },
      { userId: 'usr-fan-hyd-7', name: 'Jubilee Aces XI', c: 'tigers-fakhar-zaman', vc: 'aces-andre-russell' },
      { userId: 'usr-fan-uk-1', name: 'London Aces FanClub', c: 'aces-liam-livingstone', vc: 'aces-moeen-ali' },
    ];

    for (const c of m3Configs) {
      if (!store.fantasyTeams.some(f => f.userId === c.userId && f.matchId === 'm-3')) {
        const playerIds = [
          'aces-moeen-ali', 'aces-andre-russell', 'aces-liam-livingstone', 'aces-alishan-sharafu', 'aces-tom-kohler-cadmore', 'aces-richard-gleeson', 'aces-alzarri-joseph',
          'tigers-fakhar-zaman', 'tigers-iftikhar-ahmed', 'tigers-faheem-ashraf', 'tigers-azmatullah-omarzai'
        ];
        store.fantasyTeams.push({
          userId: c.userId,
          matchId: 'm-3',
          playerIds,
          captainId: c.c,
          viceCaptainId: c.vc,
          variationId: 'var-1',
          variationName: c.name,
          createdAt: now,
          updatedAt: now,
        });
        changed = true;
      }
    }
  }

  return changed;
}
