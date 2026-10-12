import { SocialHandle } from '../types';

export const OFFICIAL_HANDLES: Omit<SocialHandle, 'id' | 'verifiedAt' | 'foundAt' | 'status' | 'source'>[] = [
  // Abu Dhabi T10 League Central
  { teamId: null, platform: 'YouTube', handle: '@T10LeagueOfficial', url: 'https://www.youtube.com/@T10LeagueOfficial', meta: { channelId: 'UCgNs5GVvw5Td-05qp22sPLg' } },
  { teamId: null, platform: 'X', handle: '@T10League', url: 'https://x.com/T10League', meta: {} },
  { teamId: null, platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },
  { teamId: null, platform: 'Facebook', handle: 'T10league', url: 'https://www.facebook.com/T10league', meta: {} },
  { teamId: null, platform: 'TikTok', handle: '@abudhabit10', url: 'https://www.tiktok.com/@abudhabit10', meta: {} },

  // Arabian Aces (Host / Partner Franchise)
  { teamId: 'aces', platform: 'X', handle: '@arabianacesT10', url: 'https://x.com/arabianacesT10', meta: {} },
  { teamId: 'aces', platform: 'Instagram', handle: '@arabianacesofficial', url: 'https://www.instagram.com/arabianacesofficial/', meta: {} },
  { teamId: 'aces', platform: 'YouTube', handle: '@ArabianAcesT10', url: 'https://www.youtube.com/@ArabianAcesT10', meta: {} },
  { teamId: 'aces', platform: 'Threads', handle: '@arabianacesofficial', url: 'https://www.threads.com/@arabianacesofficial', meta: {} },
  { teamId: 'aces', platform: 'Facebook', handle: 'arabianacesofficial', url: 'https://www.facebook.com/arabianacesofficial/', meta: {} },
  { teamId: 'aces', platform: 'TikTok', handle: '@arabianaces', url: 'https://www.tiktok.com/@arabianaces', meta: {} },
  { teamId: 'aces', platform: 'LinkedIn', handle: 'arabianaces', url: 'https://www.linkedin.com/in/arabianaces/', meta: {} },

  // UAE Bulls
  { teamId: 'bulls', platform: 'X', handle: '@UAEBullsT10', url: 'https://x.com/UAEBullsT10', meta: {} },
  { teamId: 'bulls', platform: 'Instagram', handle: '@delhibullst10', url: 'https://www.instagram.com/delhibullst10/', meta: { note: 'Account renamed to UAE Bulls' } },
  { teamId: 'bulls', platform: 'YouTube', handle: '@UAEBullsT10', url: 'https://www.youtube.com/@UAEBullsT10', meta: {} },
  { teamId: 'bulls', platform: 'Facebook', handle: 'UAEBullsT10', url: 'https://www.facebook.com/UAEBullsT10', meta: {} },
  { teamId: 'bulls', platform: 'TikTok', handle: '@uaebullst10', url: 'https://www.tiktok.com/@uaebullst10', meta: {} },

  // Royal Desert Champions
  { teamId: 'champions', platform: 'X', handle: '@DesertChampions', url: 'https://x.com/DesertChampions', meta: {} },
  { teamId: 'champions', platform: 'Instagram', handle: '@royaldesertchampions', url: 'https://www.instagram.com/royaldesertchampions/', meta: {} },
  { teamId: 'champions', platform: 'YouTube', handle: '@RoyalDesertChampions', url: 'https://www.youtube.com/@RoyalDesertChampions', meta: {} },
  { teamId: 'champions', platform: 'Facebook', handle: 'RoyalDesertChampions', url: 'https://www.facebook.com/RoyalDesertChampions', meta: {} },
  { teamId: 'champions', platform: 'TikTok', handle: '@desertchampionst10', url: 'https://www.tiktok.com/@desertchampionst10', meta: {} },

  // Emirates Eagles
  { teamId: 'eagles', platform: 'X', handle: '@EmiratesEaglesT10', url: 'https://x.com/EmiratesEaglesT10', meta: {} },
  { teamId: 'eagles', platform: 'Instagram', handle: '@emirateseaglest10', url: 'https://www.instagram.com/emirateseaglest10/', meta: {} },
  { teamId: 'eagles', platform: 'YouTube', handle: '@EmiratesEaglesT10', url: 'https://www.youtube.com/@EmiratesEaglesT10', meta: {} },
  { teamId: 'eagles', platform: 'Facebook', handle: 'EmiratesEaglesT10', url: 'https://www.facebook.com/EmiratesEaglesT10', meta: {} },
  { teamId: 'eagles', platform: 'TikTok', handle: '@emirateseaglest10', url: 'https://www.tiktok.com/@emirateseaglest10', meta: {} },

  // Yas Lions
  { teamId: 'lions', platform: 'X', handle: '@YasLionsT10', url: 'https://x.com/YasLionsT10', meta: {} },
  { teamId: 'lions', platform: 'Instagram', handle: '@yaslionsofficial', url: 'https://www.instagram.com/yaslionsofficial/', meta: {} },
  { teamId: 'lions', platform: 'YouTube', handle: '@YasLionsT10', url: 'https://www.youtube.com/@YasLionsT10', meta: {} },
  { teamId: 'lions', platform: 'Facebook', handle: 'YasLionsT10', url: 'https://www.facebook.com/YasLionsT10', meta: {} },
  { teamId: 'lions', platform: 'TikTok', handle: '@yaslionst10', url: 'https://www.tiktok.com/@yaslionst10', meta: {} },

  // United Tigers
  { teamId: 'tigers', platform: 'X', handle: '@UnitedTigersT10', url: 'https://x.com/UnitedTigersT10', meta: {} },
  { teamId: 'tigers', platform: 'Instagram', handle: '@unitedtigerst10', url: 'https://www.instagram.com/unitedtigerst10/', meta: {} },
  { teamId: 'tigers', platform: 'YouTube', handle: '@UnitedTigersT10', url: 'https://www.youtube.com/@UnitedTigersT10', meta: {} },
  { teamId: 'tigers', platform: 'Facebook', handle: 'UnitedTigersT10', url: 'https://www.facebook.com/UnitedTigersT10', meta: {} },
  { teamId: 'tigers', platform: 'TikTok', handle: '@unitedtigerst10', url: 'https://www.tiktok.com/@unitedtigerst10', meta: {} },
];

export const FALLBACK_HANDLES: SocialHandle[] = OFFICIAL_HANDLES.map((h, i) => ({
  ...h,
  id: `h-official-${i}`,
  status: 'verified',
  source: 'official-preset',
  verifiedAt: '2026-11-01T00:00:00.000Z',
  foundAt: '2026-11-01T00:00:00.000Z',
}));
