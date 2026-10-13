import { SocialHandle } from '../types';

export const OFFICIAL_HANDLES: Omit<SocialHandle, 'id' | 'verifiedAt' | 'foundAt' | 'status' | 'source'>[] = [
  // Abu Dhabi T10 League Central
  { teamId: null, platform: 'Website', handle: 'ttensports.com', url: 'https://ttensports.com/', meta: {} },
  { teamId: null, platform: 'YouTube', handle: '@T10LeagueOfficial', url: 'https://www.youtube.com/@T10LeagueOfficial', meta: { channelId: 'UCgNs5GVvw5Td-05qp22sPLg' } },
  { teamId: null, platform: 'X', handle: '@T10League', url: 'https://x.com/T10League', meta: {} },
  { teamId: null, platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },
  { teamId: null, platform: 'Facebook', handle: 'T10league', url: 'https://www.facebook.com/T10league', meta: {} },
  { teamId: null, platform: 'TikTok', handle: '@abudhabit10', url: 'https://www.tiktok.com/@abudhabit10', meta: {} },

  // Arabian Aces (Host / Partner Franchise - www.arabianaces.ae)
  { teamId: 'aces', platform: 'Website', handle: 'arabianaces.ae', url: 'https://www.arabianaces.ae', meta: {} },
  { teamId: 'aces', platform: 'Instagram', handle: '@arabianacesofficial', url: 'https://www.instagram.com/arabianacesofficial/', meta: {} },
  { teamId: 'aces', platform: 'Facebook', handle: 'arabianacesofficial', url: 'https://www.facebook.com/arabianacesofficial/', meta: {} },
  { teamId: 'aces', platform: 'X', handle: '#ArabianAces', url: 'https://x.com/search?q=%23ArabianAces&f=live', meta: {} },

  // UAE Bulls (formerly Delhi Bulls - verified official accounts)
  { teamId: 'bulls', platform: 'Website', handle: 'delhibulls.com', url: 'https://delhibulls.com/', meta: {} },
  { teamId: 'bulls', platform: 'Instagram', handle: '@delhibullst10', url: 'https://www.instagram.com/delhibullst10/', meta: {} },
  { teamId: 'bulls', platform: 'Facebook', handle: 'DelhiBullsT10', url: 'https://www.facebook.com/DelhiBullsT10', meta: {} },
  { teamId: 'bulls', platform: 'YouTube', handle: '@DelhiBulls', url: 'https://www.youtube.com/@DelhiBulls', meta: {} },
  { teamId: 'bulls', platform: 'X', handle: '@DelhiBullsT10', url: 'https://x.com/DelhiBullsT10', meta: {} },

  // United Tigers (Bangla Tigers - verified official accounts)
  { teamId: 'tigers', platform: 'Facebook', handle: 'OfficialBanglaTigers', url: 'https://www.facebook.com/OfficialBanglaTigers', meta: {} },
  { teamId: 'tigers', platform: 'Instagram', handle: '@banglatigers.official', url: 'https://www.instagram.com/banglatigers.official/', meta: {} },
  { teamId: 'tigers', platform: 'X', handle: '@BanglaTigers_ae', url: 'https://x.com/BanglaTigers_ae', meta: {} },
  { teamId: 'tigers', platform: 'YouTube', handle: '@BanglaTigersOfficial', url: 'https://www.youtube.com/@BanglaTigersOfficial', meta: {} },

  // Royal Desert Champions
  { teamId: 'champions', platform: 'Website', handle: 'ttensports.com', url: 'https://ttensports.com/', meta: {} },
  { teamId: 'champions', platform: 'YouTube', handle: 'T10 Highlights', url: 'https://www.youtube.com/@T10LeagueOfficial/videos', meta: {} },
  { teamId: 'champions', platform: 'X', handle: '#RoyalChamps', url: 'https://x.com/search?q=%23RoyalChamps%20T10&f=live', meta: {} },
  { teamId: 'champions', platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },

  // Emirates Eagles
  { teamId: 'eagles', platform: 'Website', handle: 'ttensports.com', url: 'https://ttensports.com/', meta: {} },
  { teamId: 'eagles', platform: 'YouTube', handle: 'T10 Highlights', url: 'https://www.youtube.com/@T10LeagueOfficial/videos', meta: {} },
  { teamId: 'eagles', platform: 'X', handle: '#EmiratesEagles', url: 'https://x.com/search?q=%23EmiratesEagles%20T10&f=live', meta: {} },
  { teamId: 'eagles', platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },

  // Yas Lions
  { teamId: 'lions', platform: 'Website', handle: 'ttensports.com', url: 'https://ttensports.com/', meta: {} },
  { teamId: 'lions', platform: 'YouTube', handle: 'T10 Highlights', url: 'https://www.youtube.com/@T10LeagueOfficial/videos', meta: {} },
  { teamId: 'lions', platform: 'X', handle: '#YasLions', url: 'https://x.com/search?q=%23YasLions%20T10&f=live', meta: {} },
  { teamId: 'lions', platform: 'Instagram', handle: '@t10league', url: 'https://www.instagram.com/t10league/', meta: {} },
];

export const FALLBACK_HANDLES: SocialHandle[] = OFFICIAL_HANDLES.map((h, i) => ({
  ...h,
  id: `h-official-${i}`,
  status: 'verified',
  source: 'official-preset',
  verifiedAt: '2026-11-01T00:00:00.000Z',
  foundAt: '2026-11-01T00:00:00.000Z',
}));
