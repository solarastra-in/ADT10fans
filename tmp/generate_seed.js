const fs = require('fs');
const path = require('path');

const squads = JSON.parse(fs.readFileSync('./data/t10_squads_official.json', 'utf-8'));

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const TEAM_METADATA = {
  bulls: {
    name: 'UAE Bulls',
    short: 'UB',
    color: '#FACC15',
    secondaryColor: '#1C1917',
    iconPlayer: 'Kieron Pollard',
    cricbuzzSquadId: 133580,
    cricbuzzTeamId: 598
  },
  champions: {
    name: 'Royal Desert Champions',
    short: 'RDC',
    color: '#FB7185',
    secondaryColor: '#3F0A12',
    iconPlayer: 'Nicholas Pooran',
    headCoach: 'Robin Singh',
    cricbuzzSquadId: 133590,
    cricbuzzTeamId: 2885
  },
  eagles: {
    name: 'Emirates Eagles',
    short: 'EE',
    color: '#F5EBDD',
    secondaryColor: '#292524',
    iconPlayer: 'Rovman Powell',
    headCoach: 'Mickey Arthur',
    cricbuzzSquadId: 133600,
    cricbuzzTeamId: 3631
  },
  aces: {
    name: 'Arabian Aces',
    short: 'AA',
    color: '#D9A92E',
    secondaryColor: '#2A0610',
    iconPlayer: 'Moeen Ali',
    headCoach: 'Lance Klusener',
    website: 'https://arabianaces.ae',
    cricbuzzSquadId: 133610,
    cricbuzzTeamId: 3623
  },
  lions: {
    name: 'Yas Lions',
    short: 'YL',
    color: '#22D3EE',
    secondaryColor: '#082F49',
    iconPlayer: 'Jason Holder',
    headCoach: 'Robin Uthappa (Director)',
    cricbuzzSquadId: 133620,
    cricbuzzTeamId: 3640
  },
  tigers: {
    name: 'United Tigers',
    short: 'UT',
    color: '#EC4899',
    secondaryColor: '#1F0A16',
    iconPlayer: 'Fakhar Zaman',
    cricbuzzSquadId: 133630,
    cricbuzzTeamId: 3647
  }
};

const processedTeams = squads.map((s, idx) => {
  const meta = TEAM_METADATA[s.teamId];
  return {
    id: s.teamId,
    name: meta.name,
    short: meta.short,
    color: meta.color,
    secondaryColor: meta.secondaryColor,
    iconPlayer: meta.iconPlayer,
    headCoach: meta.headCoach,
    website: meta.website,
    sort: idx + 1,
    squad: s.players.map(p => {
      let role = 'batter';
      if (p.role === 'Bowler') role = 'bowler';
      else if (p.role.includes('Allrounder')) role = 'allrounder';
      else if (p.role.includes('WK') || p.role.includes('Keeper')) role = 'wicketkeeper';

      const isIcon = p.name === meta.iconPlayer;
      const isCaptain = isIcon || Boolean(p.captain);
      const isKeeper = role === 'wicketkeeper' || Boolean(p.keeper);

      return {
        id: `${s.teamId}-${slug(p.name)}`,
        teamId: s.teamId,
        cricbuzzId: String(p.id),
        name: p.name,
        role,
        cricbuzzRole: p.role,
        battingStyle: p.battingStyle || undefined,
        bowlingStyle: p.bowlingStyle || undefined,
        imageId: p.imageId,
        photoUrl: p.imageId ? `https://static.cricbuzz.com/a/img/v1/i1/c${p.imageId}/i.jpg` : undefined,
        cricbuzzProfileUrl: `https://www.cricbuzz.com/profiles/${p.id}/${slug(p.name)}`,
        isIcon,
        isCaptain,
        isKeeper,
        stats: p.stats,
        credits: 8.0
      };
    })
  };
});

const tsLines = [
  "import crypto from 'crypto';",
  "import { db, Player, SocialHandle, Team } from './db';",
  "",
  "/**",
  " * Official Abu Dhabi T10 2026 franchises and confirmed 18-player squads from Cricbuzz",
  " * Series 13307: https://www.cricbuzz.com/cricket-series/13307/abu-dhabi-t10-league-2026/squads",
  " * Amounts/credits have been removed; real Cricbuzz player stats are attached.",
  " */",
  "",
  `export const OFFICIAL_2026_TEAMS: Team[] = ${JSON.stringify(processedTeams, null, 2)};`,
  "",
  "export const OFFICIAL_HANDLES: Omit<SocialHandle, 'id' | 'verifiedAt' | 'foundAt' | 'status' | 'source'>[] = [",
  "  { teamId: null, platform: 'YouTube', handle: '@T10LeagueOfficial', url: 'https://www.youtube.com/@T10LeagueOfficial', meta: { channelId: 'UCgNs5GVvw5Td-05qp22sPLg' } },",
  "  { teamId: null, platform: 'X', handle: '@T10League', url: 'https://x.com/T10League', meta: {} },",
  "  { teamId: null, platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },",
  "  { teamId: null, platform: 'Facebook', handle: 'T10league', url: 'https://www.facebook.com/T10league', meta: {} },",
  "  { teamId: null, platform: 'TikTok', handle: '@abudhabit10', url: 'https://www.tiktok.com/@abudhabit10', meta: {} },",
  "  { teamId: 'bulls', platform: 'X', handle: '@UAEBullsT10', url: 'https://x.com/UAEBullsT10', meta: {} },",
  "  { teamId: 'bulls', platform: 'Instagram', handle: '@delhibullst10', url: 'https://www.instagram.com/delhibullst10/', meta: { note: 'Account renamed to UAE Bulls' } },",
  "  { teamId: 'aces', platform: 'X', handle: '@arabianacesT10', url: 'https://x.com/arabianacesT10', meta: {} },",
  "  { teamId: 'aces', platform: 'Instagram', handle: '@arabianacesofficial', url: 'https://www.instagram.com/arabianacesofficial/', meta: {} },",
  "  { teamId: 'aces', platform: 'Threads', handle: '@arabianacesofficial', url: 'https://www.threads.com/@arabianacesofficial', meta: {} },",
  "  { teamId: 'aces', platform: 'Facebook', handle: 'arabianacesofficial', url: 'https://www.facebook.com/arabianacesofficial/', meta: {} },",
  "  { teamId: 'aces', platform: 'TikTok', handle: '@arabianaces', url: 'https://www.tiktok.com/@arabianaces', meta: {} },",
  "  { teamId: 'aces', platform: 'LinkedIn', handle: 'arabianaces', url: 'https://www.linkedin.com/in/arabianaces/', meta: {} },",
  "  { teamId: 'champions', platform: 'X', handle: '@DesertChampions', url: 'https://x.com/DesertChampions', meta: {} },",
  "  { teamId: 'champions', platform: 'Instagram', handle: '@royaldesertchampions', url: 'https://www.instagram.com/royaldesertchampions/', meta: {} },",
  "  { teamId: 'eagles', platform: 'X', handle: '@EmiratesEaglesT10', url: 'https://x.com/EmiratesEaglesT10', meta: {} },",
  "  { teamId: 'eagles', platform: 'Instagram', handle: '@emirateseaglest10', url: 'https://www.instagram.com/emirateseaglest10/', meta: {} },",
  "  { teamId: 'lions', platform: 'X', handle: '@YasLionsT10', url: 'https://x.com/YasLionsT10', meta: {} },",
  "  { teamId: 'lions', platform: 'Instagram', handle: '@yaslionsofficial', url: 'https://www.instagram.com/yaslionsofficial/', meta: {} },",
  "  { teamId: 'tigers', platform: 'X', handle: '@UnitedTigersT10', url: 'https://x.com/UnitedTigersT10', meta: {} },",
  "  { teamId: 'tigers', platform: 'Instagram', handle: '@unitedtigerst10', url: 'https://www.instagram.com/unitedtigerst10/', meta: {} },",
  "];",
  "",
  "export function seedOfficialTeams(overwrite = false) {",
  "  const store = db.get();",
  "  const created: string[] = [];",
  "  const updated: string[] = [];",
  "  const skipped: string[] = [];",
  "  const now = new Date().toISOString();",
  "",
  "  OFFICIAL_2026_TEAMS.forEach((officialTeam, i) => {",
  "    const idx = store.teams.findIndex(t => t.id === officialTeam.id || t.name.toLowerCase() === officialTeam.name.toLowerCase());",
  "    const completeTeam: Team = {",
  "      ...officialTeam,",
  "      home: store.settings.venue || 'Zayed Cricket Stadium, Abu Dhabi',",
  "      createdAt: now,",
  "      updatedAt: now,",
  "    };",
  "",
  "    if (idx === -1) {",
  "      store.teams.push(completeTeam);",
  "      created.push(officialTeam.name);",
  "    } else if (overwrite) {",
  "      const prevId = store.teams[idx].id;",
  "      store.teams[idx] = {",
  "        ...store.teams[idx],",
  "        ...completeTeam,",
  "        squad: officialTeam.squad,",
  "        updatedAt: now,",
  "      };",
  "      if (prevId !== officialTeam.id) {",
  "        for (const u of store.users) if (u.teamId === prevId) u.teamId = officialTeam.id;",
  "      }",
  "      updated.push(officialTeam.name);",
  "    } else {",
  "      skipped.push(officialTeam.name);",
  "    }",
  "  });",
  "",
  "  store.teams.sort((a, b) => a.sort - b.sort);",
  "",
  "  let handlesAdded = 0;",
  "  for (const h of OFFICIAL_HANDLES) {",
  "    const existing = store.handles.find(x => x.url.toLowerCase() === h.url.toLowerCase());",
  "    if (existing) {",
  "      if (overwrite) Object.assign(existing, { ...h, status: 'verified', source: 'official-preset', verifiedAt: now });",
  "      continue;",
  "    }",
  "    store.handles.push({",
  "      ...h,",
  "      id: 'h-' + crypto.randomUUID().slice(0, 8),",
  "      status: 'verified',",
  "      source: 'official-preset',",
  "      verifiedAt: now,",
  "      foundAt: now,",
  "    });",
  "    handlesAdded++;",
  "  }",
  "",
  "  if (!store.settings.seasonLabel) store.settings.seasonLabel = 'Abu Dhabi T10 2026';",
  "  if (!store.settings.seasonStart) store.settings.seasonStart = '2026-11-07';",
  "  if (!store.settings.seasonEnd) store.settings.seasonEnd = '2026-11-20';",
  "  if (!store.settings.venue) store.settings.venue = 'Zayed Cricket Stadium, Abu Dhabi';",
  "  for (const t of store.teams) if (!t.home) t.home = store.settings.venue;",
  "",
  "  db.save();",
  "  const summary = `Seeded ${created.length} new teams, updated ${updated.length}, kept ${skipped.length} existing teams (all 18 players per squad, stats included, amounts removed); added ${handlesAdded} official social handles.`;",
  "  return { teams: store.teams, handles: store.handles, created, updated, skipped, summary };",
  "}",
  ""
];

fs.writeFileSync('./server/seedOfficial.ts', tsLines.join('\n'), 'utf-8');
console.log('SUCCESS: Written ./server/seedOfficial.ts');
