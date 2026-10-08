import crypto from 'crypto';
import { db, Player, SocialHandle, Team } from './db';

/**
 * Official Abu Dhabi T10 2026 franchises and their confirmed squads (direct signings + draft),
 * matching the 6 official franchises listed on Cricbuzz (series 13307 - Abu Dhabi T10 League 2026):
 * 1. UAE Bulls (Defending Champions) - Icon: Kieron Pollard
 * 2. Royal Desert Champions - Icon & Captain: Nicholas Pooran
 * 3. Emirates Eagles - Icon: Rovman Powell
 * 4. Arabian Aces - Icon & Captain: Moeen Ali
 * 5. Yas Lions - Icon: Jason Holder
 * 6. United Tigers - Icon: Fakhar Zaman
 */
type Signing = { 
  name: string; 
  role: Player['role']; 
  category: 'Icon' | 'Platinum' | 'Gold' | 'Silver' | 'Draft' | 'UAE Local';
  credits?: number;
};

export const OFFICIAL_2026: {
  id: string;
  name: string;
  short: string;
  color: string;
  secondaryColor: string;
  headCoach?: string;
  website?: string;
  cricbuzzSquadId?: number;
  cricbuzzTeamId?: number;
  signings: Signing[];
}[] = [
  {
    id: 'bulls',
    name: 'UAE Bulls',
    short: 'UB',
    color: '#FACC15',
    secondaryColor: '#1C1917',
    cricbuzzSquadId: 133580,
    cricbuzzTeamId: 598,
    signings: [
      { name: 'Kieron Pollard', role: 'allrounder', category: 'Icon', credits: 10 },
      { name: 'Sunil Narine', role: 'allrounder', category: 'Platinum', credits: 9.5 },
      { name: 'Romario Shepherd', role: 'allrounder', category: 'Platinum', credits: 9.5 },
      { name: 'Mohammad Amir', role: 'bowler', category: 'Gold', credits: 9.0 },
      { name: 'Shadab Khan', role: 'allrounder', category: 'Gold', credits: 9.0 },
      { name: 'Andre Fletcher', role: 'batter', category: 'Silver', credits: 8.5 },
      { name: 'Azam Khan', role: 'wicketkeeper', category: 'Silver', credits: 8.5 },
      { name: 'Khushdil Shah', role: 'batter', category: 'Draft', credits: 8.0 },
      { name: 'Khawaja Nafay', role: 'batter', category: 'Draft', credits: 8.0 },
      { name: 'Aneurin Donald', role: 'wicketkeeper', category: 'Draft', credits: 7.5 },
      { name: 'Max Bryan', role: 'batter', category: 'Draft', credits: 7.5 },
      { name: 'Muhammad Rohid', role: 'bowler', category: 'UAE Local', credits: 7.0 },
      { name: 'Wali Muhammad', role: 'allrounder', category: 'UAE Local', credits: 7.0 },
    ],
  },
  {
    id: 'champions',
    name: 'Royal Desert Champions',
    short: 'RDC',
    color: '#FB7185',
    secondaryColor: '#3F0A12',
    cricbuzzSquadId: 133590,
    cricbuzzTeamId: 2885,
    headCoach: 'Robin Singh',
    signings: [
      { name: 'Nicholas Pooran', role: 'wicketkeeper', category: 'Icon', credits: 10 },
      { name: 'Phil Salt', role: 'wicketkeeper', category: 'Platinum', credits: 9.5 },
      { name: 'Sherfane Rutherford', role: 'batter', category: 'Platinum', credits: 9.5 },
      { name: 'Naseem Shah', role: 'bowler', category: 'Gold', credits: 9.0 },
      { name: 'Maheesh Theekshana', role: 'bowler', category: 'Gold', credits: 9.0 },
      { name: 'Chris Jordan', role: 'allrounder', category: 'Gold', credits: 8.5 },
      { name: 'Brandon King', role: 'batter', category: 'Silver', credits: 8.5 },
      { name: 'Dushmantha Chameera', role: 'bowler', category: 'Silver', credits: 8.5 },
      { name: 'Luke Wood', role: 'bowler', category: 'Draft', credits: 8.0 },
      { name: 'Muhammad Waseem', role: 'batter', category: 'UAE Local', credits: 8.5 },
      { name: 'Asif Khan', role: 'batter', category: 'UAE Local', credits: 7.5 },
      { name: 'Zeeshan Naseer', role: 'bowler', category: 'UAE Local', credits: 7.0 },
    ],
  },
  {
    id: 'eagles',
    name: 'Emirates Eagles',
    short: 'EE',
    color: '#F5EBDD',
    secondaryColor: '#292524',
    cricbuzzSquadId: 133600,
    cricbuzzTeamId: 3631,
    headCoach: 'Mickey Arthur',
    signings: [
      { name: 'Rovman Powell', role: 'batter', category: 'Icon', credits: 10 },
      { name: 'Shimron Hetmyer', role: 'batter', category: 'Platinum', credits: 9.5 },
      { name: 'Trent Boult', role: 'bowler', category: 'Platinum', credits: 9.5 },
      { name: 'Kusal Perera', role: 'wicketkeeper', category: 'Gold', credits: 9.0 },
      { name: 'Noor Ahmad', role: 'bowler', category: 'Gold', credits: 9.0 },
      { name: 'Alex Hales', role: 'batter', category: 'Silver', credits: 8.5 },
      { name: 'Chris Green', role: 'allrounder', category: 'Silver', credits: 8.5 },
      { name: 'David Wiese', role: 'allrounder', category: 'Silver', credits: 8.0 },
      { name: 'KS Bharat', role: 'wicketkeeper', category: 'Draft', credits: 8.0 },
      { name: 'Rehan Ahmed', role: 'allrounder', category: 'Draft', credits: 8.0 },
      { name: 'Toby Albert', role: 'batter', category: 'Draft', credits: 7.5 },
      { name: 'Akif Javed', role: 'bowler', category: 'UAE Local', credits: 7.5 },
      { name: 'Harshit Kaushik', role: 'allrounder', category: 'UAE Local', credits: 7.0 },
    ],
  },
  {
    id: 'aces',
    name: 'Arabian Aces',
    short: 'AA',
    color: '#D9A92E',
    secondaryColor: '#2A0610',
    cricbuzzSquadId: 133610,
    cricbuzzTeamId: 3623,
    headCoach: 'Lance Klusener',
    website: 'https://arabianaces.ae',
    signings: [
      { name: 'Moeen Ali', role: 'allrounder', category: 'Icon', credits: 10 },
      { name: 'Andre Russell', role: 'allrounder', category: 'Platinum', credits: 9.5 },
      { name: 'Liam Livingstone', role: 'allrounder', category: 'Platinum', credits: 9.5 },
      { name: 'Alzarri Joseph', role: 'bowler', category: 'Gold', credits: 9.0 },
      { name: 'Sam Billings', role: 'wicketkeeper', category: 'Gold', credits: 9.0 },
      { name: 'Tom Kohler-Cadmore', role: 'batter', category: 'Silver', credits: 8.5 },
      { name: 'Imran Tahir', role: 'bowler', category: 'Silver', credits: 8.5 },
      { name: 'Richard Gleeson', role: 'bowler', category: 'Draft', credits: 8.0 },
      { name: 'Dwaine Pretorius', role: 'allrounder', category: 'Draft', credits: 8.5 },
      { name: 'Dunith Wellalage', role: 'allrounder', category: 'Draft', credits: 8.0 },
      { name: 'Paul Walter', role: 'allrounder', category: 'Draft', credits: 7.5 },
      { name: 'Alishan Sharafu', role: 'batter', category: 'UAE Local', credits: 8.0 },
      { name: 'Vriitya Aravind', role: 'wicketkeeper', category: 'UAE Local', credits: 8.0 },
    ],
  },
  {
    id: 'lions',
    name: 'Yas Lions',
    short: 'YL',
    color: '#22D3EE',
    secondaryColor: '#082F49',
    cricbuzzSquadId: 133620,
    cricbuzzTeamId: 3640,
    headCoach: 'Robin Uthappa (Director)',
    signings: [
      { name: 'Jason Holder', role: 'allrounder', category: 'Icon', credits: 10 },
      { name: 'David Willey', role: 'allrounder', category: 'Platinum', credits: 9.5 },
      { name: 'Andries Gous', role: 'wicketkeeper', category: 'Platinum', credits: 9.5 },
      { name: 'Dasun Shanaka', role: 'allrounder', category: 'Gold', credits: 9.0 },
      { name: 'Akeal Hosein', role: 'bowler', category: 'Gold', credits: 9.0 },
      { name: 'Thisara Perera', role: 'allrounder', category: 'Silver', credits: 8.5 },
      { name: 'Tabraiz Shamsi', role: 'bowler', category: 'Silver', credits: 8.5 },
      { name: 'Hazratullah Zazai', role: 'batter', category: 'Draft', credits: 8.0 },
      { name: 'Dan Lawrence', role: 'allrounder', category: 'Draft', credits: 8.0 },
      { name: 'Bhanuka Rajapaksa', role: 'batter', category: 'Draft', credits: 8.0 },
      { name: 'Ansh Tandon', role: 'batter', category: 'UAE Local', credits: 7.5 },
      { name: 'Haider Ali', role: 'bowler', category: 'UAE Local', credits: 7.5 },
      { name: 'Zaman Khan', role: 'bowler', category: 'Draft', credits: 8.0 },
    ],
  },
  {
    id: 'tigers',
    name: 'United Tigers',
    short: 'UT',
    color: '#EC4899',
    secondaryColor: '#1F0A16',
    cricbuzzSquadId: 133630,
    cricbuzzTeamId: 3647,
    signings: [
      { name: 'Fakhar Zaman', role: 'batter', category: 'Icon', credits: 10 },
      { name: 'Iftikhar Ahmed', role: 'batter', category: 'Platinum', credits: 9.5 },
      { name: 'Faheem Ashraf', role: 'allrounder', category: 'Platinum', credits: 9.5 },
      { name: 'Azmatullah Omarzai', role: 'allrounder', category: 'Gold', credits: 9.0 },
      { name: 'Odean Smith', role: 'allrounder', category: 'Gold', credits: 8.5 },
      { name: 'Sheikh Mahedi Hasan', role: 'allrounder', category: 'Silver', credits: 8.5 },
      { name: 'Abbas Afridi', role: 'bowler', category: 'Silver', credits: 8.5 },
      { name: 'Sufyan Moqim', role: 'bowler', category: 'Draft', credits: 8.0 },
      { name: 'Nurul Hasan Sohan', role: 'wicketkeeper', category: 'Draft', credits: 8.0 },
      { name: 'Shamim Hossain Patwary', role: 'batter', category: 'Draft', credits: 7.5 },
      { name: 'Habibur Rahman Sohan', role: 'batter', category: 'Draft', credits: 7.5 },
      { name: 'Paul van Meekeren', role: 'bowler', category: 'Draft', credits: 8.0 },
      { name: 'Awais Ali Shah', role: 'batter', category: 'UAE Local', credits: 7.0 },
      { name: 'Adithya Shetty', role: 'bowler', category: 'UAE Local', credits: 7.0 },
    ],
  },
];

/** Fantasy credits default fallback */
const CREDITS: Record<string, number> = { 
  Icon: 10, 
  Platinum: 9.5, 
  Gold: 9.0, 
  Silver: 8.5, 
  Draft: 8.0, 
  'UAE Local': 7.5 
};

/** Official accounts verified across social channels */
export const OFFICIAL_HANDLES: Omit<SocialHandle, 'id' | 'verifiedAt' | 'foundAt' | 'status' | 'source'>[] = [
  // Abu Dhabi T10 league
  { teamId: null, platform: 'YouTube', handle: '@T10LeagueOfficial', url: 'https://www.youtube.com/@T10LeagueOfficial', meta: { channelId: 'UCgNs5GVvw5Td-05qp22sPLg' } },
  { teamId: null, platform: 'X', handle: '@T10League', url: 'https://x.com/T10League', meta: {} },
  { teamId: null, platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },
  { teamId: null, platform: 'Facebook', handle: 'T10league', url: 'https://www.facebook.com/T10league', meta: {} },
  { teamId: null, platform: 'TikTok', handle: '@abudhabit10', url: 'https://www.tiktok.com/@abudhabit10', meta: {} },
  // UAE Bulls
  { teamId: 'bulls', platform: 'X', handle: '@UAEBullsT10', url: 'https://x.com/UAEBullsT10', meta: {} },
  { teamId: 'bulls', platform: 'Instagram', handle: '@delhibullst10', url: 'https://www.instagram.com/delhibullst10/', meta: { note: 'Account renamed to UAE Bulls; original username kept' } },
  // Arabian Aces
  { teamId: 'aces', platform: 'X', handle: '@arabianacesT10', url: 'https://x.com/arabianacesT10', meta: {} },
  { teamId: 'aces', platform: 'Instagram', handle: '@arabianacesofficial', url: 'https://www.instagram.com/arabianacesofficial/', meta: {} },
  { teamId: 'aces', platform: 'Threads', handle: '@arabianacesofficial', url: 'https://www.threads.com/@arabianacesofficial', meta: {} },
  { teamId: 'aces', platform: 'Facebook', handle: 'arabianacesofficial', url: 'https://www.facebook.com/arabianacesofficial/', meta: {} },
  { teamId: 'aces', platform: 'TikTok', handle: '@arabianaces', url: 'https://www.tiktok.com/@arabianaces', meta: {} },
  { teamId: 'aces', platform: 'LinkedIn', handle: 'arabianaces', url: 'https://www.linkedin.com/in/arabianaces/', meta: {} },
  // Royal Desert Champions
  { teamId: 'champions', platform: 'X', handle: '@DesertChampions', url: 'https://x.com/DesertChampions', meta: {} },
  { teamId: 'champions', platform: 'Instagram', handle: '@royaldesertchampions', url: 'https://www.instagram.com/royaldesertchampions/', meta: {} },
  // Emirates Eagles
  { teamId: 'eagles', platform: 'X', handle: '@EmiratesEaglesT10', url: 'https://x.com/EmiratesEaglesT10', meta: {} },
  { teamId: 'eagles', platform: 'Instagram', handle: '@emirateseaglest10', url: 'https://www.instagram.com/emirateseaglest10/', meta: {} },
  // Yas Lions
  { teamId: 'lions', platform: 'X', handle: '@YasLionsT10', url: 'https://x.com/YasLionsT10', meta: {} },
  { teamId: 'lions', platform: 'Instagram', handle: '@yaslionsofficial', url: 'https://www.instagram.com/yaslionsofficial/', meta: {} },
  // United Tigers
  { teamId: 'tigers', platform: 'X', handle: '@UnitedTigersT10', url: 'https://x.com/UnitedTigersT10', meta: {} },
  { teamId: 'tigers', platform: 'Instagram', handle: '@unitedtigerst10', url: 'https://www.instagram.com/unitedtigerst10/', meta: {} },
];

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function buildTeam(def: (typeof OFFICIAL_2026)[number], sort: number, existing?: Team): Team {
  const now = new Date().toISOString();
  const seededSquad: Player[] = def.signings.map(s => ({
    id: `${def.id}-${slug(s.name)}`,
    teamId: def.id,
    name: s.name,
    role: s.role,
    category: s.category,
    credits: s.credits ?? (CREDITS[s.category] || 8.0),
    isIcon: s.category === 'Icon',
  }));
  // Keep any custom players added by admin; refresh official squad roster
  const extra = (existing?.squad || []).filter(p => !seededSquad.some(sp => sp.id === p.id || sp.name.toLowerCase() === p.name.toLowerCase()));
  return {
    ...(existing || {}),
    id: def.id,
    name: def.name,
    short: def.short,
    color: existing?.color || def.color,
    secondaryColor: existing?.secondaryColor || def.secondaryColor,
    home: existing?.home || db.get().settings.venue || 'Zayed Cricket Stadium, Abu Dhabi',
    iconPlayer: def.signings.find(s => s.category === 'Icon')?.name || def.signings[0].name,
    headCoach: def.headCoach ?? existing?.headCoach,
    website: def.website ?? existing?.website,
    sort,
    squad: [...seededSquad, ...extra],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

export function seedOfficialTeams(overwrite = false) {
  const store = db.get();
  const created: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];

  OFFICIAL_2026.forEach((def, i) => {
    const idx = store.teams.findIndex(t => t.id === def.id || t.name.toLowerCase() === def.name.toLowerCase());
    if (idx === -1) {
      store.teams.push(buildTeam(def, i + 1));
      created.push(def.name);
    } else if (overwrite) {
      const prevId = store.teams[idx].id;
      store.teams[idx] = buildTeam(def, i + 1, store.teams[idx]);
      if (prevId !== def.id) {
        for (const u of store.users) if (u.teamId === prevId) u.teamId = def.id;
      }
      updated.push(def.name);
    } else {
      skipped.push(def.name);
    }
  });
  store.teams.sort((a, b) => a.sort - b.sort);

  const now = new Date().toISOString();
  let handlesAdded = 0;
  for (const h of OFFICIAL_HANDLES) {
    const existing = store.handles.find(x => x.url.toLowerCase() === h.url.toLowerCase());
    if (existing) {
      if (overwrite) Object.assign(existing, { ...h, status: 'verified', source: 'official-preset', verifiedAt: now });
      continue;
    }
    store.handles.push({
      ...h,
      id: 'h-' + crypto.randomUUID().slice(0, 8),
      status: 'verified',
      source: 'official-preset',
      verifiedAt: now,
      foundAt: now,
    });
    handlesAdded++;
  }

  if (!store.settings.seasonLabel) store.settings.seasonLabel = 'Abu Dhabi T10 2026';
  if (!store.settings.seasonStart) store.settings.seasonStart = '2026-11-07';
  if (!store.settings.seasonEnd) store.settings.seasonEnd = '2026-11-20';
  if (!store.settings.venue) store.settings.venue = 'Zayed Cricket Stadium, Abu Dhabi';
  for (const t of store.teams) if (!t.home) t.home = store.settings.venue;

  db.save();
  const summary = `Seeded ${created.length} new teams, updated ${updated.length}, kept ${skipped.length} existing teams; added ${handlesAdded} official social handles.`;
  return { teams: store.teams, handles: store.handles, created, updated, skipped, summary };
}
