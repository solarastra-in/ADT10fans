// Starts from a store written by an older version full of invented content and checks the upgrade
// removes it while keeping real fans, posts and admin-made content. Run by tests/run-e2e.sh.
const BASE = process.env.BASE;
let passed = 0;
const ok = (name, cond, detail) => {
  if (!cond) {
    console.error('✗', name, detail !== undefined ? JSON.stringify(detail).slice(0, 600) : '');
    process.exit(1);
  }
  passed++;
  console.log('✓', name);
};
const get = async p => (await fetch(BASE + p)).json();
const feeds = (await get('/api/feeds?limit=100')).items;
ok('placeholder videos removed', !feeds.some(f => /dQw4w9WgXcQ/.test(f.url)));
ok('generated posts with fake status ids removed', !feeds.some(f => /status\/1[89]\d{5}$/.test(f.url)));
ok('stock-photo posts removed', !feeds.some(f => /unsplash/.test(f.image || '')));
ok('real admin-added post kept', feeds.some(f => f.id === 'feed-real-admin'));
const handles = (await get('/api/handles')).handles;
ok('unchecked legacy handle hidden from fans', !handles.some(h => h.url.includes('fake-team-account')));
ok('checked league and Bulls handles are added (the store has no Aces team)', handles.length === 9, handles.length);
const teams = (await get('/api/teams')).teams;
ok('invented player stats removed', teams.every(t => t.squad.every(p => p.stats === undefined)));
ok('admin squad edits kept', teams.find(t => t.id === 'bulls').squad.some(p => p.name === 'Admin Added Player'));
const threads = (await get('/api/forum/threads')).threads;
ok('demo forum threads removed, real ones kept', !threads.some(t => t.id === 'thread-proposal-1') && threads.some(t => t.id === 'thread-real'));
ok('stock avatars removed', threads.every(t => !/dicebear|unsplash/.test(t.userAvatar || '')));
const board = await get('/api/leaderboard');
ok('demo users removed, real fans kept', board.topFans.some(u => u.name === 'Real Fan') && !board.topFans.some(u => u.name === 'Demo Admin'));
console.log(`\n${passed} migration checks passed`);
