import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, writeBatch } from 'firebase/firestore';
import cfg from '../firebase-applet-config.json' with { type: 'json' };
import { OFFICIAL_2026_TEAMS } from '../src/constants/officialTeams';
import { OFFICIAL_FEED_ITEMS } from '../src/constants/officialFeeds';
import { FALLBACK_HANDLES } from '../src/constants/officialHandles';

const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);

async function runSeed() {
  console.log(`[SEED] Connecting to Firestore db: ${cfg.firestoreDatabaseId}...`);

  // 1. Seed Teams & confirmed 18-player squads
  console.log(`[SEED] Seeding ${OFFICIAL_2026_TEAMS.length} official teams with 18-player squads each...`);
  let totalPlayers = 0;
  for (const team of OFFICIAL_2026_TEAMS) {
    const teamDocRef = doc(db, 'teams', team.id);
    const squad = (team.squad || []).map(p => ({
      id: p.id,
      teamId: p.teamId || team.id,
      name: p.name,
      role: p.role,
      cricbuzzRole: p.cricbuzzRole || '',
      cricbuzzId: p.cricbuzzId || '',
      battingStyle: p.battingStyle || '',
      bowlingStyle: p.bowlingStyle || '',
      imageId: p.imageId || 0,
      photoUrl: p.photoUrl || '',
      cricbuzzProfileUrl: p.cricbuzzProfileUrl || '',
      isIcon: Boolean(p.isIcon),
      isCaptain: Boolean(p.isCaptain),
      isKeeper: Boolean(p.isKeeper),
      stats: p.stats || {
        matches: 0,
        innings: 0,
        runs: 0,
        highestScore: '0',
        average: 0,
        strikeRate: 0,
        fifties: 0,
        hundreds: 0,
        fours: 0,
        sixes: 0,
        wickets: 0,
        economy: 0,
        bestBowling: '-/-'
      }
    }));
    totalPlayers += squad.length;

    await setDoc(teamDocRef, {
      id: team.id,
      name: team.name,
      short: team.short,
      color: team.color,
      secondaryColor: team.secondaryColor || '#1C1917',
      iconPlayer: team.iconPlayer || '',
      sort: team.sort || 1,
      home: 'Sheikh Zayed Cricket Stadium, Abu Dhabi',
      squadCount: squad.length,
      squad: squad,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`  ✓ Seeded team: ${team.name} (${team.id}) with ${squad.length} players`);
  }
  console.log(`[SEED] Successfully seeded ${OFFICIAL_2026_TEAMS.length} teams and ${totalPlayers} players in Firestore!`);

  // 2. Seed Super Admin
  console.log('[SEED] Seeding Super Admin record...');
  const superAdminRef = doc(db, 'admins', 'solarastra.in@gmail.com');
  await setDoc(superAdminRef, {
    email: 'solarastra.in@gmail.com',
    name: 'Super Admin',
    role: 'superadmin',
    isSuperAdmin: true,
    addedAt: new Date().toISOString(),
    permissions: [
      'all', 'leagues', 'matches', 'teams', 'contests', 'winners', 'draws',
      'feeds', 'social', 'notifications', 'fanspaces', 'growth', 'settings', 'admins'
    ]
  }, { merge: true });
  console.log('  ✓ Seeded Super Admin solarastra.in@gmail.com in Firestore');

  // 3. Seed Feed Items (social media items)
  console.log(`[SEED] Seeding ${OFFICIAL_FEED_ITEMS.length} official social feed items...`);
  for (const item of OFFICIAL_FEED_ITEMS.slice(0, 30)) {
    const itemRef = doc(db, 'feed_items', item.id);
    await setDoc(itemRef, {
      id: item.id,
      teamId: item.teamId || null,
      platform: item.platform,
      kind: item.kind,
      category: item.category || 'social',
      title: item.title,
      summary: item.summary || '',
      url: item.url,
      imageUrl: item.image || null,
      source: item.source || 'ADT10',
      handleId: item.handleId || null,
      status: item.status || 'published',
      publishedAt: item.publishedAt || new Date().toISOString(),
      views: item.views || 0,
      likes: item.likes || 0
    }, { merge: true });
  }
  console.log(`  ✓ Seeded feed items in Firestore`);

  // 4. Seed Welcome Notification
  console.log('[SEED] Seeding welcome notification...');
  const notifRef = doc(db, 'notifications', 'notif-welcome-2026');
  await setDoc(notifRef, {
    id: 'notif-welcome-2026',
    title: 'Welcome to Abu Dhabi T10 2026!',
    body: 'Official franchise squads, live fixtures, fan spaces and social walls are now active!',
    category: 'announcement',
    targetAudience: 'all',
    priority: 'high',
    createdAt: new Date().toISOString(),
    createdBy: 'system'
  }, { merge: true });
  console.log('  ✓ Seeded welcome notification in Firestore');

  console.log('[SEED] Complete! All teams, players, admins, and feed items are now seeded in Firebase Firestore.');
  process.exit(0);
}

runSeed().catch(err => {
  console.error('[SEED] Failed to seed Firebase:', err);
  process.exit(1);
});
