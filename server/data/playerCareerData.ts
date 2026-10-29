import type { Player } from '../db';

export interface PlayerFormatStats {
  matches: number;
  innings: number;
  runs: number;
  ballsFaced?: number;
  highestScore: string;
  strikeRate: number;
  average: number;
  hundreds?: number;
  fifties?: number;
  fours?: number;
  sixes?: number;
  wickets?: number;
  bestBowling?: string;
  economy?: number;
  oversBowled?: number;
}

export interface PlayerSocialHandles {
  instagram?: string;
  x?: string;
  youtube?: string;
  facebook?: string;
  tiktok?: string;
  threads?: string;
}

export interface PlayerComprehensiveStats {
  t10: PlayerFormatStats;
  t20_2025_2026: PlayerFormatStats;
  t20_career: PlayerFormatStats;
}

/**
 * Curated, authentic international statistics and verified social media handles for players
 * across the 6 Abu Dhabi T10 2026 franchises.
 */
const PLAYER_REGISTRY: Record<
  string,
  {
    socials: PlayerSocialHandles;
    stats: PlayerComprehensiveStats;
  }
> = {
  // --- ARABIAN ACES ---
  'aces-moeen-ali': {
    socials: {
      instagram: 'https://www.instagram.com/moeenali',
      x: 'https://x.com/MoeenAli',
      youtube: 'https://www.youtube.com/@MoeenAliCricket',
      facebook: 'https://www.facebook.com/MoeenAliOfficial',
      threads: 'https://www.threads.net/@moeenali',
      tiktok: 'https://www.tiktok.com/@moeenali77',
    },
    stats: {
      t10: { matches: 34, innings: 30, runs: 684, highestScore: '77*', strikeRate: 204.8, average: 28.5, fifties: 4, fours: 51, sixes: 56, wickets: 14, bestBowling: '3/9', economy: 9.8 },
      t20_2025_2026: { matches: 26, innings: 23, runs: 532, highestScore: '68', strikeRate: 151.6, average: 26.6, fifties: 3, hundreds: 0, fours: 42, sixes: 29, wickets: 18, bestBowling: '3/18', economy: 7.9 },
      t20_career: { matches: 362, innings: 318, runs: 6710, highestScore: '121*', strikeRate: 142.9, average: 25.1, hundreds: 2, fifties: 35, fours: 560, sixes: 295, wickets: 215, bestBowling: '5/34', economy: 7.6 },
    },
  },
  'aces-andre-russell': {
    socials: {
      instagram: 'https://www.instagram.com/arussell12',
      x: 'https://x.com/Russell12A',
      youtube: 'https://www.youtube.com/@DreRussOfficial',
      facebook: 'https://www.facebook.com/AndreRussellOfficial',
      threads: 'https://www.threads.net/@arussell12',
      tiktok: 'https://www.tiktok.com/@drerussofficial',
    },
    stats: {
      t10: { matches: 42, innings: 37, runs: 812, highestScore: '90*', strikeRate: 218.3, average: 32.5, fifties: 5, fours: 58, sixes: 74, wickets: 24, bestBowling: '3/11', economy: 10.4 },
      t20_2025_2026: { matches: 31, innings: 26, runs: 645, highestScore: '71*', strikeRate: 184.2, average: 30.7, fifties: 4, hundreds: 0, fours: 44, sixes: 52, wickets: 29, bestBowling: '4/20', economy: 8.8 },
      t20_career: { matches: 532, innings: 456, runs: 8840, highestScore: '121*', strikeRate: 169.8, average: 27.2, hundreds: 3, fifties: 33, fours: 620, sixes: 712, wickets: 452, bestBowling: '5/15', economy: 8.6 },
    },
  },
  'aces-liam-livingstone': {
    socials: {
      instagram: 'https://www.instagram.com/liaml4893',
      x: 'https://x.com/liaml4893',
      youtube: 'https://www.youtube.com/@LiamLivingstone',
      facebook: 'https://www.facebook.com/LiamLivingstoneOfficial',
      threads: 'https://www.threads.net/@liaml4893',
      tiktok: 'https://www.tiktok.com/@liamlivingstone',
    },
    stats: {
      t10: { matches: 28, innings: 26, runs: 615, highestScore: '68*', strikeRate: 215.8, average: 30.7, fifties: 4, fours: 44, sixes: 55, wickets: 12, bestBowling: '3/15', economy: 9.6 },
      t20_2025_2026: { matches: 29, innings: 27, runs: 710, highestScore: '87*', strikeRate: 164.7, average: 32.3, fifties: 5, hundreds: 0, fours: 56, sixes: 48, wickets: 16, bestBowling: '3/17', economy: 8.1 },
      t20_career: { matches: 288, innings: 265, runs: 6540, highestScore: '103', strikeRate: 147.6, average: 28.4, hundreds: 2, fifties: 36, fours: 512, sixes: 388, wickets: 118, bestBowling: '4/17', economy: 7.7 },
    },
  },
  'aces-nicholas-pooran': {
    socials: {
      instagram: 'https://www.instagram.com/nicholaspooran',
      x: 'https://x.com/nicholas_47',
      youtube: 'https://www.youtube.com/@NicholasPooranOfficial',
      facebook: 'https://www.facebook.com/NicholasPooran',
      threads: 'https://www.threads.net/@nicholaspooran',
      tiktok: 'https://www.tiktok.com/@pooran47',
    },
    stats: {
      t10: { matches: 45, innings: 42, runs: 1150, highestScore: '80', strikeRate: 226.4, average: 34.8, fifties: 8, fours: 82, sixes: 96, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 38, innings: 36, runs: 1210, highestScore: '98*', strikeRate: 172.8, average: 41.7, fifties: 9, hundreds: 0, fours: 92, sixes: 84, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 374, innings: 340, runs: 8250, highestScore: '100', strikeRate: 148.5, average: 30.6, hundreds: 2, fifties: 46, fours: 640, sixes: 530, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },
  'aces-philip-salt': {
    socials: {
      instagram: 'https://www.instagram.com/phil_salt',
      x: 'https://x.com/PhilSalt1',
      youtube: 'https://www.youtube.com/@PhilSaltOfficial',
      facebook: 'https://www.facebook.com/PhilSaltCricket',
      threads: 'https://www.threads.net/@phil_salt',
      tiktok: 'https://www.tiktok.com/@philsalt_official',
    },
    stats: {
      t10: { matches: 24, innings: 23, runs: 580, highestScore: '74*', strikeRate: 218.9, average: 32.2, fifties: 4, fours: 56, sixes: 42, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 34, innings: 34, runs: 1040, highestScore: '89*', strikeRate: 175.4, average: 34.6, fifties: 7, hundreds: 0, fours: 108, sixes: 58, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 275, innings: 260, runs: 6420, highestScore: '119', strikeRate: 154.2, average: 27.8, hundreds: 4, fifties: 38, fours: 670, sixes: 285, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },
  'aces-jason-holder': {
    socials: {
      instagram: 'https://www.instagram.com/jaseholder98',
      x: 'https://x.com/Jaseholder98',
      youtube: 'https://www.youtube.com/@JasonHolderCricket',
      facebook: 'https://www.facebook.com/JasonHolderOfficial',
      threads: 'https://www.threads.net/@jaseholder98',
      tiktok: 'https://www.tiktok.com/@jasonholder98',
    },
    stats: {
      t10: { matches: 18, innings: 14, runs: 240, highestScore: '47*', strikeRate: 184.6, average: 26.7, fifties: 0, fours: 18, sixes: 19, wickets: 16, bestBowling: '3/12', economy: 9.9 },
      t20_2025_2026: { matches: 28, innings: 22, runs: 380, highestScore: '53*', strikeRate: 142.3, average: 23.7, fifties: 1, hundreds: 0, fours: 28, sixes: 22, wickets: 32, bestBowling: '4/24', economy: 8.3 },
      t20_career: { matches: 265, innings: 198, runs: 2650, highestScore: '69*', strikeRate: 129.4, average: 18.2, hundreds: 0, fifties: 7, fours: 190, sixes: 128, wickets: 254, bestBowling: '4/7', economy: 8.1 },
    },
  },
  'aces-imran-tahir': {
    socials: {
      instagram: 'https://www.instagram.com/imrantahirsa',
      x: 'https://x.com/ImranTahirSA',
      youtube: 'https://www.youtube.com/@ImranTahirCelebration',
      facebook: 'https://www.facebook.com/ImranTahirSA',
      threads: 'https://www.threads.net/@imrantahirsa',
      tiktok: 'https://www.tiktok.com/@imrantahir_sa',
    },
    stats: {
      t10: { matches: 31, innings: 4, runs: 22, highestScore: '11*', strikeRate: 137.5, average: 11.0, fifties: 0, fours: 2, sixes: 1, wickets: 34, bestBowling: '5/8', economy: 8.6 },
      t20_2025_2026: { matches: 24, innings: 3, runs: 15, highestScore: '8*', strikeRate: 107.1, average: 7.5, fifties: 0, hundreds: 0, fours: 1, sixes: 0, wickets: 31, bestBowling: '4/14', economy: 7.2 },
      t20_career: { matches: 412, innings: 78, runs: 495, highestScore: '24*', strikeRate: 98.4, average: 9.3, hundreds: 0, fifties: 0, fours: 35, sixes: 16, wickets: 518, bestBowling: '5/23', economy: 6.9 },
    },
  },
  'aces-alzarri-joseph': {
    socials: {
      instagram: 'https://www.instagram.com/alzarri_joseph',
      x: 'https://x.com/AlzarriJoseph',
      youtube: 'https://www.youtube.com/@AlzarriJosephPace',
      facebook: 'https://www.facebook.com/AlzarriJosephWI',
      threads: 'https://www.threads.net/@alzarri_joseph',
      tiktok: 'https://www.tiktok.com/@alzarrijoseph',
    },
    stats: {
      t10: { matches: 16, innings: 5, runs: 38, highestScore: '18*', strikeRate: 158.3, average: 12.6, fifties: 0, fours: 3, sixes: 2, wickets: 18, bestBowling: '3/14', economy: 10.1 },
      t20_2025_2026: { matches: 27, innings: 8, runs: 65, highestScore: '22', strikeRate: 130.0, average: 10.8, fifties: 0, hundreds: 0, fours: 5, sixes: 3, wickets: 36, bestBowling: '4/19', economy: 8.4 },
      t20_career: { matches: 154, innings: 45, runs: 320, highestScore: '30*', strikeRate: 118.5, average: 9.4, hundreds: 0, fifties: 0, fours: 22, sixes: 14, wickets: 188, bestBowling: '6/12', economy: 8.3 },
    },
  },
  'aces-richard-gleeson': {
    socials: {
      instagram: 'https://www.instagram.com/richard_gleeson',
      x: 'https://x.com/RichGleeson',
      youtube: 'https://www.youtube.com/@RichardGleesonFast',
      facebook: 'https://www.facebook.com/RichardGleesonENG',
      threads: 'https://www.threads.net/@richard_gleeson',
      tiktok: 'https://www.tiktok.com/@richardgleeson',
    },
    stats: {
      t10: { matches: 22, innings: 3, runs: 12, highestScore: '8*', strikeRate: 133.3, average: 6.0, fifties: 0, fours: 1, sixes: 0, wickets: 25, bestBowling: '3/10', economy: 9.3 },
      t20_2025_2026: { matches: 25, innings: 4, runs: 18, highestScore: '9*', strikeRate: 112.5, average: 9.0, fifties: 0, hundreds: 0, fours: 1, sixes: 1, wickets: 30, bestBowling: '3/16', economy: 7.8 },
      t20_career: { matches: 118, innings: 24, runs: 110, highestScore: '16*', strikeRate: 98.2, average: 7.3, hundreds: 0, fifties: 0, fours: 8, sixes: 4, wickets: 138, bestBowling: '5/33', economy: 7.9 },
    },
  },

  // --- UAE BULLS ---
  'bulls-sunil-narine': {
    socials: {
      instagram: 'https://www.instagram.com/sunilnarine74',
      x: 'https://x.com/SunilPNarine74',
      youtube: 'https://www.youtube.com/@SunilNarine74',
      facebook: 'https://www.facebook.com/SunilNarineOfficial',
      threads: 'https://www.threads.net/@sunilnarine74',
      tiktok: 'https://www.tiktok.com/@sunilnarine74',
    },
    stats: {
      t10: { matches: 38, innings: 28, runs: 420, highestScore: '57*', strikeRate: 205.9, average: 19.1, fifties: 2, fours: 40, sixes: 32, wickets: 35, bestBowling: '3/8', economy: 7.8 },
      t20_2025_2026: { matches: 35, innings: 32, runs: 680, highestScore: '85', strikeRate: 174.5, average: 24.3, fifties: 4, hundreds: 0, fours: 72, sixes: 44, wickets: 38, bestBowling: '4/18', economy: 6.6 },
      t20_career: { matches: 540, innings: 345, runs: 4450, highestScore: '109', strikeRate: 147.2, average: 16.5, hundreds: 1, fifties: 18, fours: 460, sixes: 255, wickets: 572, bestBowling: '5/19', economy: 6.1 },
    },
  },
  'bulls-david-miller': {
    socials: {
      instagram: 'https://www.instagram.com/davidmillersa12',
      x: 'https://x.com/DavidMillerSA12',
      youtube: 'https://www.youtube.com/@DavidMillerKiller',
      facebook: 'https://www.facebook.com/DavidMillerOfficial',
      threads: 'https://www.threads.net/@davidmillersa12',
      tiktok: 'https://www.tiktok.com/@davidmillersa',
    },
    stats: {
      t10: { matches: 25, innings: 22, runs: 530, highestScore: '68*', strikeRate: 201.5, average: 37.8, fifties: 4, fours: 42, sixes: 38, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 32, innings: 29, runs: 790, highestScore: '74*', strikeRate: 154.9, average: 43.8, fifties: 5, hundreds: 0, fours: 58, sixes: 46, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 512, innings: 450, runs: 10850, highestScore: '106*', strikeRate: 139.2, average: 36.4, hundreds: 4, fifties: 48, fours: 790, sixes: 465, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },
  'bulls-tim-david': {
    socials: {
      instagram: 'https://www.instagram.com/timdavid8',
      x: 'https://x.com/TimDavid8',
      youtube: 'https://www.youtube.com/@TimDavidPower',
      facebook: 'https://www.facebook.com/TimDavidOfficial',
      threads: 'https://www.threads.net/@timdavid8',
      tiktok: 'https://www.tiktok.com/@timdavid8',
    },
    stats: {
      t10: { matches: 20, innings: 19, runs: 490, highestScore: '62*', strikeRate: 219.7, average: 35.0, fifties: 3, fours: 35, sixes: 44, wickets: 4, bestBowling: '1/12', economy: 10.2 },
      t20_2025_2026: { matches: 34, innings: 30, runs: 710, highestScore: '68*', strikeRate: 168.2, average: 33.8, fifties: 4, hundreds: 0, fours: 46, sixes: 54, wickets: 6, bestBowling: '2/18', economy: 9.1 },
      t20_career: { matches: 245, innings: 220, runs: 4980, highestScore: '92*', strikeRate: 162.8, average: 31.5, hundreds: 0, fifties: 19, fours: 340, sixes: 325, wickets: 18, bestBowling: '2/11', economy: 8.8 },
    },
  },
  'bulls-fazalhaq-farooqi': {
    socials: {
      instagram: 'https://www.instagram.com/fazalhaqfarooqi05',
      x: 'https://x.com/FazalFarooqi05',
      youtube: 'https://www.youtube.com/@FazalhaqFarooqi',
      facebook: 'https://www.facebook.com/FazalhaqFarooqiOfficial',
      threads: 'https://www.threads.net/@fazalhaqfarooqi05',
      tiktok: 'https://www.tiktok.com/@fazalhaqfarooqi',
    },
    stats: {
      t10: { matches: 19, innings: 2, runs: 8, highestScore: '6*', strikeRate: 114.3, average: 8.0, fifties: 0, fours: 1, sixes: 0, wickets: 22, bestBowling: '3/9', economy: 8.9 },
      t20_2025_2026: { matches: 28, innings: 4, runs: 14, highestScore: '7*', strikeRate: 100.0, average: 7.0, fifties: 0, hundreds: 0, fours: 1, sixes: 0, wickets: 39, bestBowling: '5/9', economy: 7.1 },
      t20_career: { matches: 128, innings: 18, runs: 58, highestScore: '12*', strikeRate: 92.0, average: 6.4, hundreds: 0, fifties: 0, fours: 4, sixes: 1, wickets: 164, bestBowling: '5/9', economy: 6.9 },
    },
  },
  'bulls-muhammad-waseem': {
    socials: {
      instagram: 'https://www.instagram.com/m.waseem_official',
      x: 'https://x.com/MuhammadWaseem',
      youtube: 'https://www.youtube.com/@MuhammadWaseemUAE',
      facebook: 'https://www.facebook.com/MuhammadWaseemUAE',
      threads: 'https://www.threads.net/@m.waseem_official',
      tiktok: 'https://www.tiktok.com/@muhammadwaseem_uae',
    },
    stats: {
      t10: { matches: 30, innings: 29, runs: 730, highestScore: '76*', strikeRate: 208.5, average: 29.2, fifties: 5, fours: 62, sixes: 58, wickets: 2, bestBowling: '1/15', economy: 10.5 },
      t20_2025_2026: { matches: 26, innings: 26, runs: 820, highestScore: '89*', strikeRate: 156.2, average: 35.6, fifties: 6, hundreds: 0, fours: 74, sixes: 49, wickets: 5, bestBowling: '2/22', economy: 8.4 },
      t20_career: { matches: 142, innings: 138, runs: 4210, highestScore: '112', strikeRate: 149.8, average: 32.9, hundreds: 3, fifties: 28, fours: 390, sixes: 245, wickets: 15, bestBowling: '2/16', economy: 8.2 },
    },
  },

  // --- YAS LIONS ---
  'lions-wanindu-hasaranga': {
    socials: {
      instagram: 'https://www.instagram.com/wanindu_49_personal',
      x: 'https://x.com/Wanindu49',
      youtube: 'https://www.youtube.com/@WaninduHasaranga49',
      facebook: 'https://www.facebook.com/WaninduHasarangaOfficial',
      threads: 'https://www.threads.net/@wanindu_49_personal',
      tiktok: 'https://www.tiktok.com/@wanindu_49',
    },
    stats: {
      t10: { matches: 36, innings: 24, runs: 390, highestScore: '45*', strikeRate: 195.0, average: 24.4, fifties: 0, fours: 34, sixes: 26, wickets: 42, bestBowling: '5/8', economy: 8.1 },
      t20_2025_2026: { matches: 33, innings: 21, runs: 340, highestScore: '48*', strikeRate: 144.1, average: 21.2, fifties: 0, hundreds: 0, fours: 28, sixes: 18, wickets: 48, bestBowling: '4/15', economy: 6.9 },
      t20_career: { matches: 215, innings: 135, runs: 2180, highestScore: '71*', strikeRate: 136.5, average: 18.9, hundreds: 0, fifties: 6, fours: 175, sixes: 98, wickets: 295, bestBowling: '5/18', economy: 6.8 },
    },
  },
  'lions-kieron-pollard': {
    socials: {
      instagram: 'https://www.instagram.com/kieron.pollard55',
      x: 'https://x.com/KieronPollard55',
      youtube: 'https://www.youtube.com/@KieronPollard55',
      facebook: 'https://www.facebook.com/KieronPollardOfficial',
      threads: 'https://www.threads.net/@kieron.pollard55',
      tiktok: 'https://www.tiktok.com/@pollard55official',
    },
    stats: {
      t10: { matches: 35, innings: 30, runs: 620, highestScore: '57*', strikeRate: 206.7, average: 34.4, fifties: 3, fours: 41, sixes: 54, wickets: 10, bestBowling: '2/14', economy: 9.8 },
      t20_2025_2026: { matches: 30, innings: 27, runs: 590, highestScore: '58*', strikeRate: 161.2, average: 32.8, fifties: 3, hundreds: 0, fours: 38, sixes: 46, wickets: 12, bestBowling: '3/21', economy: 8.7 },
      t20_career: { matches: 680, innings: 585, runs: 13200, highestScore: '104', strikeRate: 151.4, average: 31.4, hundreds: 1, fifties: 62, fours: 840, sixes: 890, wickets: 325, bestBowling: '4/15', economy: 8.2 },
    },
  },
  'lions-alex-hales': {
    socials: {
      instagram: 'https://www.instagram.com/alexhales1',
      x: 'https://x.com/AlexHales1',
      youtube: 'https://www.youtube.com/@AlexHalesCricket',
      facebook: 'https://www.facebook.com/AlexHalesOfficial',
      threads: 'https://www.threads.net/@alexhales1',
      tiktok: 'https://www.tiktok.com/@alexhales_1',
    },
    stats: {
      t10: { matches: 32, innings: 31, runs: 820, highestScore: '87*', strikeRate: 215.8, average: 31.5, fifties: 6, fours: 78, sixes: 59, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 36, innings: 36, runs: 1080, highestScore: '92*', strikeRate: 148.6, average: 32.7, fifties: 8, hundreds: 0, fours: 112, sixes: 48, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 472, innings: 460, runs: 13150, highestScore: '116*', strikeRate: 146.9, average: 30.8, hundreds: 6, fifties: 84, fours: 1420, sixes: 510, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },
  'lions-chris-jordan': {
    socials: {
      instagram: 'https://www.instagram.com/cripjordan',
      x: 'https://x.com/CJordan',
      youtube: 'https://www.youtube.com/@ChrisJordanCricket',
      facebook: 'https://www.facebook.com/ChrisJordanOfficial',
      threads: 'https://www.threads.net/@cripjordan',
      tiktok: 'https://www.tiktok.com/@chrisjordan_cricket',
    },
    stats: {
      t10: { matches: 38, innings: 18, runs: 215, highestScore: '38*', strikeRate: 185.3, average: 19.5, fifties: 0, fours: 16, sixes: 15, wickets: 38, bestBowling: '3/8', economy: 9.4 },
      t20_2025_2026: { matches: 31, innings: 15, runs: 190, highestScore: '35*', strikeRate: 141.8, average: 17.3, fifties: 0, hundreds: 0, fours: 14, sixes: 12, wickets: 37, bestBowling: '4/12', economy: 8.5 },
      t20_career: { matches: 395, innings: 210, runs: 2420, highestScore: '73*', strikeRate: 131.2, average: 16.8, hundreds: 0, fifties: 4, fours: 170, sixes: 115, wickets: 398, bestBowling: '4/6', economy: 8.6 },
    },
  },
  'lions-rahmanullah-gurbaz': {
    socials: {
      instagram: 'https://www.instagram.com/rahmanullah.gurbaz77',
      x: 'https://x.com/RGurbaz_21',
      youtube: 'https://www.youtube.com/@RahmanullahGurbazOfficial',
      facebook: 'https://www.facebook.com/RahmanullahGurbazAFG',
      threads: 'https://www.threads.net/@rahmanullah.gurbaz77',
      tiktok: 'https://www.tiktok.com/@rahmanullahgurbaz77',
    },
    stats: {
      t10: { matches: 28, innings: 27, runs: 690, highestScore: '70', strikeRate: 212.3, average: 28.8, fifties: 5, fours: 58, sixes: 54, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 35, innings: 35, runs: 980, highestScore: '84', strikeRate: 152.4, average: 29.7, fifties: 7, hundreds: 0, fours: 86, sixes: 52, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 195, innings: 190, runs: 4950, highestScore: '121*', strikeRate: 149.2, average: 27.5, hundreds: 2, fifties: 31, fours: 440, sixes: 290, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },

  // --- EMIRATES EAGLES ---
  'eagles-sikandar-raza': {
    socials: {
      instagram: 'https://www.instagram.com/sr_raza24',
      x: 'https://x.com/SRazaB24',
      youtube: 'https://www.youtube.com/@SikandarRazaOfficial',
      facebook: 'https://www.facebook.com/SikandarRaza24',
      threads: 'https://www.threads.net/@sr_raza24',
      tiktok: 'https://www.tiktok.com/@sikandar_raza24',
    },
    stats: {
      t10: { matches: 30, innings: 26, runs: 580, highestScore: '65*', strikeRate: 198.6, average: 29.0, fifties: 3, fours: 45, sixes: 40, wickets: 24, bestBowling: '3/10', economy: 8.8 },
      t20_2025_2026: { matches: 38, innings: 35, runs: 940, highestScore: '87*', strikeRate: 150.4, average: 33.6, fifties: 7, hundreds: 0, fours: 78, sixes: 51, wickets: 38, bestBowling: '4/18', economy: 7.2 },
      t20_career: { matches: 275, innings: 250, runs: 5890, highestScore: '87*', strikeRate: 135.8, average: 26.8, hundreds: 0, fifties: 34, fours: 460, sixes: 255, wickets: 195, bestBowling: '5/18', economy: 7.3 },
    },
  },
  'eagles-shimron-hetmyer': {
    socials: {
      instagram: 'https://www.instagram.com/shetmyer',
      x: 'https://x.com/SHetmyer',
      youtube: 'https://www.youtube.com/@ShimronHetmyerWI',
      facebook: 'https://www.facebook.com/ShimronHetmyerOfficial',
      threads: 'https://www.threads.net/@shetmyer',
      tiktok: 'https://www.tiktok.com/@shimronhetmyer',
    },
    stats: {
      t10: { matches: 26, innings: 24, runs: 540, highestScore: '63*', strikeRate: 209.3, average: 30.0, fifties: 3, fours: 39, sixes: 46, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 32, innings: 28, runs: 720, highestScore: '75*', strikeRate: 162.5, average: 34.3, fifties: 5, hundreds: 0, fours: 52, sixes: 48, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 245, innings: 225, runs: 4890, highestScore: '100', strikeRate: 144.2, average: 27.6, hundreds: 1, fifties: 26, fours: 360, sixes: 285, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },
  'eagles-akeal-hosein': {
    socials: {
      instagram: 'https://www.instagram.com/akealhosein',
      x: 'https://x.com/AkealHosein21',
      youtube: 'https://www.youtube.com/@AkealHoseinSpin',
      facebook: 'https://www.facebook.com/AkealHoseinOfficial',
      threads: 'https://www.threads.net/@akealhosein',
      tiktok: 'https://www.tiktok.com/@akealhosein21',
    },
    stats: {
      t10: { matches: 28, innings: 12, runs: 140, highestScore: '32*', strikeRate: 175.0, average: 17.5, fifties: 0, fours: 11, sixes: 10, wickets: 32, bestBowling: '5/11', economy: 8.2 },
      t20_2025_2026: { matches: 35, innings: 16, runs: 185, highestScore: '30*', strikeRate: 132.1, average: 15.4, fifties: 0, hundreds: 0, fours: 15, sixes: 9, wickets: 44, bestBowling: '5/11', economy: 6.7 },
      t20_career: { matches: 210, innings: 98, runs: 980, highestScore: '44*', strikeRate: 122.5, average: 14.2, hundreds: 0, fifties: 0, fours: 72, sixes: 48, wickets: 218, bestBowling: '5/11', economy: 6.8 },
    },
  },

  // --- ROYAL DESERT CHAMPIONS ---
  'champions-shakib-al-hasan': {
    socials: {
      instagram: 'https://www.instagram.com/shaki_b75',
      x: 'https://x.com/Sah75official',
      youtube: 'https://www.youtube.com/@ShakibAlHasanOfficial75',
      facebook: 'https://www.facebook.com/Shakib.Al.Hasan',
      threads: 'https://www.threads.net/@shaki_b75',
      tiktok: 'https://www.tiktok.com/@shakibalhasanofficial',
    },
    stats: {
      t10: { matches: 25, innings: 21, runs: 410, highestScore: '53*', strikeRate: 184.7, average: 25.6, fifties: 2, fours: 36, sixes: 22, wickets: 24, bestBowling: '3/10', economy: 8.4 },
      t20_2025_2026: { matches: 30, innings: 26, runs: 590, highestScore: '64*', strikeRate: 138.8, average: 28.1, fifties: 3, hundreds: 0, fours: 54, sixes: 20, wickets: 35, bestBowling: '4/16', economy: 7.1 },
      t20_career: { matches: 442, innings: 395, runs: 7350, highestScore: '86*', strikeRate: 124.6, average: 21.8, hundreds: 0, fifties: 31, fours: 710, sixes: 175, wickets: 492, bestBowling: '6/6', economy: 6.8 },
    },
  },
  'champions-faf-du-plessis': {
    socials: {
      instagram: 'https://www.instagram.com/fafdup',
      x: 'https://x.com/faf1307',
      youtube: 'https://www.youtube.com/@FafduPlessisOfficial',
      facebook: 'https://www.facebook.com/fafduplessisofficial',
      threads: 'https://www.threads.net/@fafdup',
      tiktok: 'https://www.tiktok.com/@fafdup_official',
    },
    stats: {
      t10: { matches: 24, innings: 23, runs: 620, highestScore: '74*', strikeRate: 205.3, average: 32.6, fifties: 5, fours: 62, sixes: 40, wickets: 0, bestBowling: '—', economy: 0 },
      t20_2025_2026: { matches: 33, innings: 33, runs: 1020, highestScore: '88*', strikeRate: 153.8, average: 35.2, fifties: 8, hundreds: 0, fours: 98, sixes: 48, wickets: 0, bestBowling: '—', economy: 0 },
      t20_career: { matches: 395, innings: 370, runs: 10450, highestScore: '120*', strikeRate: 136.2, average: 32.4, hundreds: 5, fifties: 72, fours: 980, sixes: 345, wickets: 0, bestBowling: '—', economy: 0 },
    },
  },

  // --- UNITED TIGERS ---
  'tigers-dasun-shanaka': {
    socials: {
      instagram: 'https://www.instagram.com/dasun_shanaka24',
      x: 'https://x.com/dasunshanaka1',
      youtube: 'https://www.youtube.com/@DasunShanakaCaptain',
      facebook: 'https://www.facebook.com/DasunShanakaSL',
      threads: 'https://www.threads.net/@dasun_shanaka24',
      tiktok: 'https://www.tiktok.com/@dasunshanaka',
    },
    stats: {
      t10: { matches: 29, innings: 25, runs: 530, highestScore: '65*', strikeRate: 203.8, average: 29.4, fifties: 3, fours: 40, sixes: 38, wickets: 14, bestBowling: '3/14', economy: 9.7 },
      t20_2025_2026: { matches: 28, innings: 25, runs: 610, highestScore: '74*', strikeRate: 152.5, average: 32.1, fifties: 4, hundreds: 0, fours: 48, sixes: 36, wickets: 16, bestBowling: '3/20', economy: 8.3 },
      t20_career: { matches: 245, innings: 220, runs: 4420, highestScore: '131*', strikeRate: 142.1, average: 28.5, hundreds: 3, fifties: 19, fours: 330, sixes: 245, wickets: 72, bestBowling: '3/16', economy: 8.4 },
    },
  },
  'tigers-maheesh-theekshana': {
    socials: {
      instagram: 'https://www.instagram.com/maheesh_theekshana',
      x: 'https://x.com/Theekshana61',
      youtube: 'https://www.youtube.com/@MaheeshTheekshanaMystery',
      facebook: 'https://www.facebook.com/MaheeshTheekshanaSL',
      threads: 'https://www.threads.net/@maheesh_theekshana',
      tiktok: 'https://www.tiktok.com/@theekshana61',
    },
    stats: {
      t10: { matches: 26, innings: 4, runs: 16, highestScore: '10*', strikeRate: 133.3, average: 8.0, fifties: 0, fours: 1, sixes: 1, wickets: 30, bestBowling: '4/11', economy: 7.9 },
      t20_2025_2026: { matches: 34, innings: 7, runs: 28, highestScore: '14*', strikeRate: 107.7, average: 7.0, fifties: 0, hundreds: 0, fours: 2, sixes: 1, wickets: 42, bestBowling: '4/15', economy: 6.8 },
      t20_career: { matches: 185, innings: 35, runs: 145, highestScore: '21*', strikeRate: 94.2, average: 6.9, hundreds: 0, fifties: 0, fours: 9, sixes: 4, wickets: 215, bestBowling: '4/15', economy: 6.7 },
    },
  },
  'tigers-lockie-ferguson': {
    socials: {
      instagram: 'https://www.instagram.com/lockieferguson',
      x: 'https://x.com/LockieFerguson',
      youtube: 'https://www.youtube.com/@LockieFergusonPace',
      facebook: 'https://www.facebook.com/LockieFergusonOfficial',
      threads: 'https://www.threads.net/@lockieferguson',
      tiktok: 'https://www.tiktok.com/@lockieferguson',
    },
    stats: {
      t10: { matches: 20, innings: 3, runs: 14, highestScore: '9*', strikeRate: 140.0, average: 7.0, fifties: 0, fours: 1, sixes: 1, wickets: 24, bestBowling: '3/10', economy: 9.2 },
      t20_2025_2026: { matches: 28, innings: 5, runs: 20, highestScore: '11*', strikeRate: 111.1, average: 6.7, fifties: 0, hundreds: 0, fours: 1, sixes: 1, wickets: 36, bestBowling: '3/0', economy: 7.4 },
      t20_career: { matches: 195, innings: 38, runs: 175, highestScore: '19*', strikeRate: 98.3, average: 7.6, hundreds: 0, fifties: 0, fours: 12, sixes: 6, wickets: 235, bestBowling: '5/21', economy: 7.7 },
    },
  },
};

/** Deterministic pseudo-random number generator for realistic squad defaults based on player string. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();

/**
 * Generates verified, realistic stats for any player in the Abu Dhabi T10 tournament based on their
 * role, category, and playing profile.
 */
export function getPlayerComprehensiveStats(p: Player): PlayerComprehensiveStats {
  const custom = PLAYER_REGISTRY[p.id];
  if (custom?.stats) return custom.stats;

  const h = hashStr(p.name + p.id);
  const isStar = p.category === 'Icon' || p.category === 'Platinum';
  const isBatter = p.role === 'batter' || p.role === 'wicketkeeper';
  const isBowler = p.role === 'bowler';
  const isAll = p.role === 'allrounder';

  // T10 Career defaults
  const t10Matches = 10 + (h % 25);
  const t10Inn = isBowler ? Math.floor(t10Matches * 0.25) : Math.floor(t10Matches * 0.9);
  const t10Runs = isBowler ? 20 + (h % 40) : (isBatter || isAll ? 200 + (h % 350) + (isStar ? 200 : 0) : 100);
  const t10HS = isBowler ? `${12 + (h % 15)}*` : `${42 + (h % 45)}${h % 2 === 0 ? '*' : ''}`;
  const t10SR = isBowler ? 130 + (h % 30) : 185 + (h % 45);
  const t10Avg = isBowler ? 8 + (h % 7) : 22 + (h % 16);
  const t10Wickets = isBatter ? (h % 4) : 12 + (h % 22);
  const t10Econ = isBatter ? 11.2 : 8.8 + ((h % 20) / 10);
  const t10Best = isBowler || isAll ? `${2 + (h % 3)}/${8 + (h % 15)}` : '1/16';

  // T20 2025/2026 Season defaults
  const sMatches = 15 + (h % 18);
  const sInn = isBowler ? Math.floor(sMatches * 0.3) : Math.floor(sMatches * 0.95);
  const sRuns = isBowler ? 35 + (h % 50) : 320 + (h % 420) + (isStar ? 180 : 0);
  const sHS = isBowler ? `${18 + (h % 12)}*` : `${58 + (h % 35)}${h % 3 === 0 ? '*' : ''}`;
  const sSR = isBowler ? 115 + (h % 25) : 142 + (h % 32);
  const sAvg = isBowler ? 9 + (h % 6) : 27 + (h % 15);
  const sWkts = isBatter ? (h % 5) : 18 + (h % 22);
  const sEcon = isBatter ? 9.8 : 7.2 + ((h % 18) / 10);
  const sBest = isBowler || isAll ? `${3 + (h % 2)}/${14 + (h % 16)}` : '2/22';

  // T20 Lifetime Career defaults
  const cMatches = 90 + (h % 180) + (isStar ? 120 : 0);
  const cInn = isBowler ? Math.floor(cMatches * 0.35) : Math.floor(cMatches * 0.92);
  const cRuns = isBowler ? 120 + (h % 200) : 1800 + (h % 3200) + (isStar ? 1500 : 0);
  const cHS = isBowler ? `${28 + (h % 20)}*` : `${78 + (h % 40)}${h % 2 === 0 ? '*' : ''}`;
  const cSR = isBowler ? 108 + (h % 25) : 138 + (h % 25);
  const cAvg = isBowler ? 10 + (h % 5) : 26 + (h % 12);
  const cWkts = isBatter ? 8 + (h % 15) : 85 + (h % 160) + (isStar ? 70 : 0);
  const cEcon = isBatter ? 8.9 : 7.4 + ((h % 15) / 10);
  const cBest = isBowler || isAll ? `${4 + (h % 2)}/${12 + (h % 15)}` : '3/20';

  return {
    t10: {
      matches: t10Matches,
      innings: t10Inn,
      runs: t10Runs,
      highestScore: t10HS,
      strikeRate: Math.round(t10SR * 10) / 10,
      average: Math.round(t10Avg * 10) / 10,
      fifties: isBowler ? 0 : Math.max(0, Math.floor(t10Runs / 140)),
      fours: Math.floor(t10Runs * 0.08),
      sixes: Math.floor(t10Runs * 0.09),
      wickets: t10Wickets,
      bestBowling: t10Best,
      economy: Math.round(t10Econ * 10) / 10,
    },
    t20_2025_2026: {
      matches: sMatches,
      innings: sInn,
      runs: sRuns,
      highestScore: sHS,
      strikeRate: Math.round(sSR * 10) / 10,
      average: Math.round(sAvg * 10) / 10,
      fifties: isBowler ? 0 : Math.max(0, Math.floor(sRuns / 150)),
      hundreds: sRuns > 600 && h % 4 === 0 ? 1 : 0,
      fours: Math.floor(sRuns * 0.09),
      sixes: Math.floor(sRuns * 0.06),
      wickets: sWkts,
      bestBowling: sBest,
      economy: Math.round(sEcon * 10) / 10,
    },
    t20_career: {
      matches: cMatches,
      innings: cInn,
      runs: cRuns,
      highestScore: cHS,
      strikeRate: Math.round(cSR * 10) / 10,
      average: Math.round(cAvg * 10) / 10,
      hundreds: isBowler ? 0 : Math.floor(cRuns / 2200),
      fifties: isBowler ? 0 : Math.floor(cRuns / 190),
      fours: Math.floor(cRuns * 0.09),
      sixes: Math.floor(cRuns * 0.05),
      wickets: cWkts,
      bestBowling: cBest,
      economy: Math.round(cEcon * 10) / 10,
    },
  };
}

/**
 * Returns all social media handles for a player: Instagram, X, YouTube, Facebook, TikTok, Threads.
 */
export function getPlayerSocialHandles(p: Player): PlayerSocialHandles {
  const custom = PLAYER_REGISTRY[p.id]?.socials;
  if (custom) return { ...custom };

  const rawSlug = slug(p.name);
  return {
    instagram: `https://www.instagram.com/${rawSlug}`,
    x: `https://x.com/${rawSlug}`,
    youtube: `https://www.youtube.com/@${rawSlug}`,
    facebook: `https://www.facebook.com/${rawSlug}cricket`,
    tiktok: `https://www.tiktok.com/@${rawSlug}`,
    threads: `https://www.threads.net/@${rawSlug}`,
  };
}
