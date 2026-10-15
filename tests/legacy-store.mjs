// Writes a schema-v1 store like the ones older versions produced (demo users, generated posts,
// stock images, unchecked handles, invented stats) plus some real content that must survive.
import fs from 'fs';
import path from 'path';
const dir = process.argv[2];
fs.mkdirSync(dir, { recursive: true });
const now = new Date().toISOString();
const player = (id, name, extra = {}) => ({ id, teamId: 'bulls', name, role: 'batter', isIcon: false, ...extra });
const store = {
  schemaVersion: 1,
  users: [
    { id: 'user-admin', email: 'demo@t10fanhub.com', name: 'Demo Admin', role: 'admin', points: 9999, teamId: 'bulls', avatar: 'https://api.dicebear.com/7.x/a.svg', badges: [], streak: 0, createdAt: now },
    { id: 'usr_real', email: 'real@test.dev', name: 'Real Fan', role: 'fan', points: 120, teamId: 'bulls', avatar: 'https://images.unsplash.com/photo-1', badges: [], streak: 2, createdAt: now },
  ],
  teams: [
    { id: 'bulls', name: 'UAE Bulls', short: 'UB', color: '#FACC15', secondaryColor: '#000000', iconPlayer: 'Kieron Pollard', sort: 1, squad: [player('bulls-kieron-pollard', 'Kieron Pollard', { stats: { runs: 9999 } }), player('bulls-admin-added', 'Admin Added Player')], createdAt: now, updatedAt: now },
  ],
  handles: [{ id: 'h-fake', teamId: 'bulls', platform: 'X', handle: '@fake', url: 'https://x.com/fake-team-account', status: 'verified', source: 'official-preset', meta: {}, foundAt: now }],
  feedItems: [
    { id: 'yt-dyn-1', teamId: null, platform: 'YouTube', kind: 'video', category: 'social', title: 'Highlights', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', image: null, source: 'x', summary: '', status: 'live', publishedAt: now, createdAt: now },
    { id: 'post-x-1', teamId: null, platform: 'X', kind: 'post', category: 'social', title: 'Post', url: 'https://x.com/T10League/status/1812345', image: null, source: 'x', summary: '', status: 'live', publishedAt: now, createdAt: now },
    { id: 'img-1', teamId: null, platform: 'Web', kind: 'article', category: 'news', title: 'Story', url: 'https://news.test.invalid/a', image: 'https://images.unsplash.com/photo-2', source: 'x', summary: '', status: 'live', publishedAt: now, createdAt: now },
    { id: 'seed-0123456789ab', teamId: 'aces', platform: 'X', kind: 'post', category: 'social', title: 'Head Coach arrives! (invented)', url: 'https://x.com/arabianacesT10/status/1841452093847298048', image: null, source: '@arabianacesT10', summary: '', status: 'pinned', publishedAt: now, createdAt: now, likes: 2450, sourceType: 'social-syndication' },
    { id: 'harv-abc', teamId: 'bulls', platform: 'X', kind: 'post', category: 'social', title: 'Unchecked AI link', url: 'https://x.com/UAEBullsT10/status/1999999999999999999', image: null, source: '@UAEBullsT10', summary: '', status: 'live', publishedAt: now, createdAt: now, sourceType: 'native-harvester' },
    { id: 'feed-real-admin', teamId: null, platform: 'Web', kind: 'article', category: 'news', title: 'Real admin post', url: 'https://news.test.invalid/real', image: null, source: 'Admin', summary: '', status: 'live', publishedAt: now, createdAt: now, sourceType: 'admin' },
  ],
  forumThreads: [
    { id: 'thread-proposal-1', title: 'Demo', content: 'Demo content', category: 'general', userId: 'user-admin', userName: 'Demo Admin', userAvatar: '', upvotes: 0, upvotedBy: [], commentsCount: 0, createdAt: now, lastActivityAt: now },
    { id: 'thread-real', title: 'Real thread', content: 'Real content from a fan', category: 'general', userId: 'usr_real', userName: 'Real Fan', userAvatar: 'https://api.dicebear.com/7.x/b.svg', upvotes: 0, upvotedBy: [], commentsCount: 0, createdAt: now, lastActivityAt: now },
  ],
  forumComments: [],
  settings: { brandName: 'ADT10 Fans', smtp: { host: 'smtp.gmail.com', port: 587, user: '', pass: '', from: 'noreply@t10fanhub.com', enabled: false } },
};
fs.writeFileSync(path.join(dir, 't10_store.json'), JSON.stringify(store));
