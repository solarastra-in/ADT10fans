import type { Match } from '../db';

export const VENUE_ZAYED = 'Zayed Cricket Stadium, Abu Dhabi';

export type OfficialMatchSeed = Omit<Match, 'id' | 'updatedAt'>;

/**
 * Official Abu Dhabi T10 2026 Schedule (November 7 - 20, 2026).
 * Features 6 franchises across 32 fixtures (30 double round-robin league matches + Qualifier + Final).
 * Times are aligned with Gulf Standard Time (GST, UTC+4) match slots (15:30, 18:00, 20:30).
 */
export const OFFICIAL_2026_MATCHES: OfficialMatchSeed[] = [
  // --- Day 1: Saturday, Nov 7, 2026 (Opening Day Triple-Header) ---
  {
    matchNo: 1,
    stage: 'Group stage',
    teamA: 'bulls',
    teamB: 'lions',
    startsAt: '2026-11-07T11:30:00.000Z', // 15:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 2,
    stage: 'Group stage',
    teamA: 'champions',
    teamB: 'eagles',
    startsAt: '2026-11-07T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 3,
    stage: 'Group stage',
    teamA: 'tigers',
    teamB: 'aces',
    startsAt: '2026-11-07T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 2: Sunday, Nov 8, 2026 (Triple-Header) ---
  {
    matchNo: 4,
    stage: 'Group stage',
    teamA: 'bulls',
    teamB: 'aces',
    startsAt: '2026-11-08T11:30:00.000Z', // 15:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 5,
    stage: 'Group stage',
    teamA: 'lions',
    teamB: 'eagles',
    startsAt: '2026-11-08T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 6,
    stage: 'Group stage',
    teamA: 'champions',
    teamB: 'tigers',
    startsAt: '2026-11-08T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 3: Monday, Nov 9, 2026 (Double-Header) ---
  {
    matchNo: 7,
    stage: 'Group stage',
    teamA: 'eagles',
    teamB: 'tigers',
    startsAt: '2026-11-09T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 8,
    stage: 'Group stage',
    teamA: 'bulls',
    teamB: 'champions',
    startsAt: '2026-11-09T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 4: Tuesday, Nov 10, 2026 (Double-Header) ---
  {
    matchNo: 9,
    stage: 'Group stage',
    teamA: 'aces',
    teamB: 'lions',
    startsAt: '2026-11-10T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 10,
    stage: 'Group stage',
    teamA: 'tigers',
    teamB: 'bulls',
    startsAt: '2026-11-10T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 5: Wednesday, Nov 11, 2026 (Double-Header) ---
  {
    matchNo: 11,
    stage: 'Group stage',
    teamA: 'lions',
    teamB: 'champions',
    startsAt: '2026-11-11T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 12,
    stage: 'Group stage',
    teamA: 'eagles',
    teamB: 'aces',
    startsAt: '2026-11-11T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 6: Thursday, Nov 12, 2026 (Tournament Rest Day) ---

  // --- Day 7: Friday, Nov 13, 2026 (Double-Header) ---
  {
    matchNo: 13,
    stage: 'Group stage',
    teamA: 'bulls',
    teamB: 'eagles',
    startsAt: '2026-11-13T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 14,
    stage: 'Group stage',
    teamA: 'lions',
    teamB: 'tigers',
    startsAt: '2026-11-13T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 8: Saturday, Nov 14, 2026 (Triple-Header) ---
  {
    matchNo: 15,
    stage: 'Group stage',
    teamA: 'champions',
    teamB: 'aces',
    startsAt: '2026-11-14T11:30:00.000Z', // 15:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 16,
    stage: 'Group stage',
    teamA: 'lions',
    teamB: 'bulls',
    startsAt: '2026-11-14T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 17,
    stage: 'Group stage',
    teamA: 'eagles',
    teamB: 'champions',
    startsAt: '2026-11-14T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 9: Sunday, Nov 15, 2026 (Triple-Header) ---
  {
    matchNo: 18,
    stage: 'Group stage',
    teamA: 'aces',
    teamB: 'tigers',
    startsAt: '2026-11-15T11:30:00.000Z', // 15:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 19,
    stage: 'Group stage',
    teamA: 'aces',
    teamB: 'bulls',
    startsAt: '2026-11-15T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 20,
    stage: 'Group stage',
    teamA: 'eagles',
    teamB: 'lions',
    startsAt: '2026-11-15T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 10: Monday, Nov 16, 2026 (Double-Header) ---
  {
    matchNo: 21,
    stage: 'Group stage',
    teamA: 'tigers',
    teamB: 'champions',
    startsAt: '2026-11-16T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 22,
    stage: 'Group stage',
    teamA: 'tigers',
    teamB: 'eagles',
    startsAt: '2026-11-16T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 11: Tuesday, Nov 17, 2026 (Double-Header) ---
  {
    matchNo: 23,
    stage: 'Group stage',
    teamA: 'champions',
    teamB: 'bulls',
    startsAt: '2026-11-17T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 24,
    stage: 'Group stage',
    teamA: 'lions',
    teamB: 'aces',
    startsAt: '2026-11-17T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 12: Wednesday, Nov 18, 2026 (Double-Header) ---
  {
    matchNo: 25,
    stage: 'Group stage',
    teamA: 'bulls',
    teamB: 'tigers',
    startsAt: '2026-11-18T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 26,
    stage: 'Group stage',
    teamA: 'champions',
    teamB: 'lions',
    startsAt: '2026-11-18T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 13: Thursday, Nov 19, 2026 (Final League Day - Triple Header featuring all 6 franchises) ---
  {
    matchNo: 27,
    stage: 'Group stage',
    teamA: 'aces',
    teamB: 'eagles',
    startsAt: '2026-11-19T11:30:00.000Z', // 15:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 28,
    stage: 'Group stage',
    teamA: 'eagles',
    teamB: 'bulls',
    startsAt: '2026-11-19T14:00:00.000Z', // 18:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 29,
    stage: 'Group stage',
    teamA: 'tigers',
    teamB: 'lions',
    startsAt: '2026-11-19T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 30,
    stage: 'Group stage',
    teamA: 'aces',
    teamB: 'champions',
    startsAt: '2026-11-19T18:00:00.000Z', // 22:00 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },

  // --- Day 14: Friday, Nov 20, 2026 (Playoffs & Grand Final) ---
  {
    matchNo: 31,
    stage: 'Qualifier (2nd vs 3rd)',
    teamA: 'lions',
    teamB: 'champions',
    startsAt: '2026-11-20T13:30:00.000Z', // 17:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
  {
    matchNo: 32,
    stage: 'The Final (1st vs Qualifier Winner)',
    teamA: 'bulls',
    teamB: 'champions',
    startsAt: '2026-11-20T16:30:00.000Z', // 20:30 GST
    venue: VENUE_ZAYED,
    status: 'upcoming',
  },
];
