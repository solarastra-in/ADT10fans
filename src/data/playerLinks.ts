import type { Player, Team } from '../types';

export interface AuthorityLink {
  platform: 'cricbuzz' | 'cricinfo' | 'wikipedia' | 'icc' | 'instagram' | 'twitter' | 'youtube' | 'facebook';
  label: string;
  category: 'cricket' | 'social';
  url: string;
  handle?: string;
  description: string;
  iconTone: 'amber' | 'blue' | 'green' | 'rose' | 'purple' | 'slate';
}

/**
 * Hand-verified handle mappings for key international & draft players in Abu Dhabi T10.
 * For unlisted players, clean search and entity URLs are automatically generated.
 */
const VERIFIED_PLAYER_HANDLES: Record<string, {
  instagram?: string;
  twitter?: string;
  cricinfoSlug?: string;
  wikiSlug?: string;
  nationality?: string;
}> = {
  'kieron pollard': {
    instagram: 'kieron.pollard55',
    twitter: 'KieronPollard55',
    cricinfoSlug: 'kieron-pollard-230559',
    wikiSlug: 'Kieron_Pollard',
    nationality: 'West Indies',
  },
  'sam billings': {
    instagram: 'sambillings',
    twitter: 'sambillings',
    cricinfoSlug: 'sam-billings-297628',
    wikiSlug: 'Sam_Billings',
    nationality: 'England',
  },
  'shadab khan': {
    instagram: 'shadab0800',
    twitter: '76Shadabkhan',
    cricinfoSlug: 'shadab-khan-922943',
    wikiSlug: 'Shadab_Khan',
    nationality: 'Pakistan',
  },
  'romario shepherd': {
    instagram: 'romarioshepherd_',
    twitter: 'romarioshepherd',
    cricinfoSlug: 'romario-shepherd-677077',
    wikiSlug: 'Romario_Shepherd',
    nationality: 'West Indies',
  },
  'sunil narine': {
    instagram: 'sunilnarine24',
    twitter: 'SunineNarine74',
    cricinfoSlug: 'sunil-narine-230558',
    wikiSlug: 'Sunil_Narine',
    nationality: 'West Indies',
  },
  'nicholas pooran': {
    instagram: 'nicholaspooran',
    twitter: 'nicholas_47',
    cricinfoSlug: 'nicholas-pooran-604302',
    wikiSlug: 'Nicholas_Pooran',
    nationality: 'West Indies',
  },
  'trent boult': {
    instagram: 'trrrent_',
    twitter: 'trentboult',
    cricinfoSlug: 'trent-boult-277912',
    wikiSlug: 'Trent_Boult',
    nationality: 'New Zealand',
  },
  'jason roy': {
    instagram: 'jasonroy20',
    twitter: 'JasonRoy20',
    cricinfoSlug: 'jason-roy-298438',
    wikiSlug: 'Jason_Roy',
    nationality: 'England',
  },
  'wanindu hasaranga': {
    instagram: 'wanindu_49_official',
    twitter: 'Wanindu49',
    cricinfoSlug: 'wanindu-hasaranga-789889',
    wikiSlug: 'Wanindu_Hasaranga',
    nationality: 'Sri Lanka',
  },
  'andre fletcher': {
    instagram: 'spiceman72',
    twitter: 'Spiceman_72',
    cricinfoSlug: 'andre-fletcher-272998',
    wikiSlug: 'Andre_Fletcher',
    nationality: 'West Indies',
  },
  'alex hales': {
    instagram: 'alexhales1',
    twitter: 'AlexHales1',
    cricinfoSlug: 'alex-hales-249866',
    wikiSlug: 'Alex_Hales',
    nationality: 'England',
  },
  'mohammad amir': {
    instagram: 'iamamirofficial',
    twitter: 'iamamirofficial',
    cricinfoSlug: 'mohammad-amir-290948',
    wikiSlug: 'Mohammad_Amir',
    nationality: 'Pakistan',
  },
  'azam khan': {
    instagram: 'azam.khan45',
    twitter: 'AzamKhan45',
    cricinfoSlug: 'azam-khan-1123495',
    wikiSlug: 'Azam_Khan_(cricketer,_born_1998)',
    nationality: 'Pakistan',
  },
  'moeen ali': {
    instagram: 'moeenali26',
    twitter: 'MoeenAli',
    cricinfoSlug: 'moeen-ali-8917',
    wikiSlug: 'Moeen_Ali',
    nationality: 'England',
  },
  'chris jordan': {
    instagram: 'cjtops',
    twitter: 'CJordan',
    cricinfoSlug: 'chris-jordan-288992',
    wikiSlug: 'Chris_Jordan_(cricketer)',
    nationality: 'England',
  },
  'colin munro': {
    instagram: 'colin_munro11',
    twitter: 'manuz05',
    cricinfoSlug: 'colin-munro-232359',
    wikiSlug: 'Colin_Munro',
    nationality: 'New Zealand',
  },
  'tim david': {
    instagram: 'timdavid8',
    twitter: 'timdavid8',
    cricinfoSlug: 'tim-david-892749',
    wikiSlug: 'Tim_David',
    nationality: 'Australia',
  },
  'shakib al hasan': {
    instagram: 'shakiba.75',
    twitter: 'Sah75official',
    cricinfoSlug: 'shakib-al-hasan-56143',
    wikiSlug: 'Shakib_Al_Hasan',
    nationality: 'Bangladesh',
  },
  'max bryant': {
    instagram: 'max_bryant',
    twitter: 'MaxBryant_',
    cricinfoSlug: 'max-bryant-927503',
    wikiSlug: 'Max_Bryant',
    nationality: 'Australia',
  },
  'khushdil shah': {
    instagram: 'khushdil_shah',
    twitter: 'KhushdilShah_',
    cricinfoSlug: 'khushdil-shah-835697',
    wikiSlug: 'Khushdil_Shah',
    nationality: 'Pakistan',
  },
};

/**
 * Returns structured authority and social links for any player, with verified profile overrides.
 */
export function getPlayerAuthorityLinks(player: Player, team?: Team): AuthorityLink[] {
  const normName = player.name.toLowerCase().trim();
  const verified = VERIFIED_PLAYER_HANDLES[normName];
  const slug = player.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const encodedName = encodeURIComponent(player.name);

  // Cricbuzz profile
  let cricbuzzUrl = player.cricbuzzProfileUrl;
  if (!cricbuzzUrl) {
    if (player.cricbuzzId) {
      cricbuzzUrl = `https://www.cricbuzz.com/profiles/${player.cricbuzzId}/${slug}`;
    } else {
      cricbuzzUrl = `https://www.cricbuzz.com/search?q=${encodedName}`;
    }
  }

  // ESPNcricinfo
  const cricinfoUrl = verified?.cricinfoSlug
    ? `https://www.espncricinfo.com/cricketers/${verified.cricinfoSlug}`
    : `https://www.espncricinfo.com/search?q=${encodedName}`;

  // Wikipedia
  const wikiSlug = verified?.wikiSlug || player.name.replace(/\s+/g, '_');
  const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`;

  // ICC
  const iccUrl = `https://www.icc-cricket.com/search?query=${encodedName}`;

  // Instagram
  const instaUrl = verified?.instagram
    ? `https://www.instagram.com/${verified.instagram}/`
    : `https://www.instagram.com/explore/tags/${encodeURIComponent(player.name.toLowerCase().replace(/[^a-z0-9]/g, ''))}/`;

  // X / Twitter
  const xUrl = verified?.twitter
    ? `https://x.com/${verified.twitter}`
    : `https://x.com/search?q=${encodeURIComponent(player.name + ' cricket')}`;

  // YouTube
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(player.name + ' T10 cricket highlights')}`;

  // Facebook
  const facebookUrl = `https://www.facebook.com/search/top?q=${encodeURIComponent(player.name + ' cricketer')}`;

  return [
    {
      platform: 'cricbuzz',
      label: 'Cricbuzz Profile & Career Stats',
      category: 'cricket',
      url: cricbuzzUrl,
      description: 'Official Abu Dhabi T10 stats, runs, strike rate and ball-by-ball record on Cricbuzz',
      iconTone: 'green',
    },
    {
      platform: 'cricinfo',
      label: 'ESPNcricinfo Record',
      category: 'cricket',
      url: cricinfoUrl,
      description: 'Career batting & bowling averages, debut dates and international stats on ESPNcricinfo',
      iconTone: 'blue',
    },
    {
      platform: 'wikipedia',
      label: 'Wikipedia Biography',
      category: 'cricket',
      url: wikiUrl,
      description: 'Player biography, franchise history, honours and career timeline on Wikipedia',
      iconTone: 'slate',
    },
    {
      platform: 'icc',
      label: 'ICC Cricket Hub',
      category: 'cricket',
      url: iccUrl,
      description: 'International rankings, tournament performances and ICC tournament records',
      iconTone: 'purple',
    },
    {
      platform: 'instagram',
      label: 'Instagram',
      category: 'social',
      url: instaUrl,
      handle: verified?.instagram ? `@${verified.instagram}` : undefined,
      description: 'Behind-the-scenes training, gym sessions and matchday photos',
      iconTone: 'rose',
    },
    {
      platform: 'twitter',
      label: 'X (Twitter)',
      category: 'social',
      url: xUrl,
      handle: verified?.twitter ? `@${verified.twitter}` : undefined,
      description: 'Official fan interactions, post-match thoughts and news',
      iconTone: 'slate',
    },
    {
      platform: 'youtube',
      label: 'YouTube Highlights',
      category: 'social',
      url: youtubeUrl,
      description: 'Sixes, wickets, fielding stunners and match winning cameos',
      iconTone: 'rose',
    },
    {
      platform: 'facebook',
      label: 'Facebook',
      category: 'social',
      url: facebookUrl,
      description: 'Player fan page and global community discussions',
      iconTone: 'blue',
    },
  ];
}

/**
 * Builds Schema.org Person JSON-LD for rich Google Search indexing and Knowledge Panel discovery.
 */
export function buildPlayerSchemaLdJson(player: Player, team?: Team) {
  const links = getPlayerAuthorityLinks(player, team);
  const sameAsUrls = links.map(l => l.url);

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: player.name,
    alternateName: player.cricbuzzRole || player.role,
    jobTitle: 'Professional Cricket Player',
    sport: 'Cricket',
    athlete: true,
    nationality: player.nationality || undefined,
    image: player.photoUrl || undefined,
    affiliation: team ? {
      '@type': 'SportsTeam',
      name: team.name,
      sport: 'Cricket',
      url: typeof window !== 'undefined' ? `${window.location.origin}/teams/${team.id}` : undefined,
    } : undefined,
    sameAs: sameAsUrls,
  };
}
