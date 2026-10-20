/**
 * Dynamic Unique Team Name Generator for Dream 11 Fantasy Squads
 * Suggests creative, authentic cricket & regional themed franchise names
 * avoiding generic names like "Team 1" or "Team1".
 */

export const UNIQUE_TEAM_NAMES: string[] = [
  'Desert Scorpions',
  'Mirage Marauders',
  'Apex Blasters',
  'Viper Strikers',
  'Oasis Blitz',
  'Sultan Sixers',
  'Dune Dominators',
  'Arabian Cobras',
  'Falcon Smashers',
  'Crimson Knights',
  'Thunderbolts XI',
  'Velocity Titans',
  'Zenith Warriors',
  'Phantom Strikers',
  'Eclipse Kings',
  'Solar Flare XI',
  'Maverick Sixers',
  'Royal Gladiators',
  'Sandstorm XI',
  'Blaze Strikers',
  'Tornado XI',
  'Inferno Smashers',
  'Vortex Kings',
  'Desert Falcons',
  'Oasis Hawks',
  'Ironclad XI',
  'Titan Strikers',
  'Golden Eagles',
  'Emerald Strikers',
  'Sapphire Titans',
  'Cyclone Strikers',
  'Raptor Smashers',
  'Red Dunes XI',
  'Oasis Mavericks',
  'Abu Dhabi Avengers',
  'Sheikh Zayed Superstars',
  'Gulf Gladiators',
  'Breeze Blasters',
  'Lightning XI',
  'Stealth Strikers',
];

/**
 * Returns a unique team name that doesn't collide with existing team names.
 */
export function suggestUniqueTeamName(existingNames: string[] = []): string {
  const normExisting = new Set(existingNames.map(n => n.trim().toLowerCase()));
  const available = UNIQUE_TEAM_NAMES.filter(n => !normExisting.has(n.toLowerCase()));

  if (available.length > 0) {
    const idx = Math.floor(Math.random() * available.length);
    return available[idx];
  }

  // Fallback with random modifier if all pre-made names are taken
  const base = UNIQUE_TEAM_NAMES[Math.floor(Math.random() * UNIQUE_TEAM_NAMES.length)];
  const num = Math.floor(Math.random() * 90) + 10;
  return `${base} ${num}`;
}
