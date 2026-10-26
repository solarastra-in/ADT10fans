/**
 * Writes offline fixtures for the end-to-end tests: every outside URL the server would fetch is
 * stored as <dir>/<sha1(url)>.txt (see FEED_FIXTURES_DIR in server/feeds.ts). The payloads follow
 * the real formats (YouTube channel RSS, X syndication __NEXT_DATA__, Google/Bing news RSS,
 * CricketData JSON). Content is marked as test data and lives only in the test run's temp folder.
 *
 *   npx tsx tests/make-fixtures.ts <dir>
 */
import fs from 'fs';
import path from 'path';
import { fixtureKey } from '../server/feeds';
import { OFFICIAL_2026_TEAMS } from '../server/data/officialTeams';
import { CRICSHEET_PEOPLE_URL, wikidataUrl } from '../server/playerLinks';

const dir = process.argv[2];
if (!dir) throw new Error('usage: make-fixtures.ts <dir>');
fs.mkdirSync(dir, { recursive: true });
const put = (url: string, body: string, status?: number) => fs.writeFileSync(path.join(dir, `${fixtureKey(url)}.txt`), (status ? `#STATUS ${status}\n` : '') + body);
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const FIXTURE = {
  leagueVideos: ['TESTvidLG01', 'TESTvidLG02', 'TESTvidLG03'],
  bullsVideos: ['TESTvidUB01', 'TESTvidUB02'],
  leagueTweets: ['1980000000000000001', '1980000000000000002'],
  cricketMatchId: 'cd-test-match-1',
  oembedVideo: 'TESTvidOE01',
};

// ---------- YouTube channel RSS ----------
function youtubeRss(channelId: string, title: string, ids: string[]) {
  const entries = ids
    .map((id, i) => `
 <entry>
  <id>yt:video:${id}</id>
  <yt:videoId>${id}</yt:videoId>
  <yt:channelId>${channelId}</yt:channelId>
  <title>${xml(`[test] ${title} video ${i + 1}${i === 0 ? ' highlights' : ''}`)}</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=${id}"/>
  <author><name>${xml(title)}</name><uri>https://www.youtube.com/channel/${channelId}</uri></author>
  <published>2026-10-0${i + 1}T10:00:00+00:00</published>
  <updated>2026-10-0${i + 1}T10:00:00+00:00</updated>
  <media:group>
   <media:title>${xml(`[test] ${title} video ${i + 1}`)}</media:title>
   <media:content url="https://www.youtube.com/v/${id}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
   <media:thumbnail url="https://i1.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
   <media:description>Test fixture description &amp; more</media:description>
   <media:community><media:starRating count="3" average="5.00" min="1" max="5"/><media:statistics views="${1000 * (i + 1)}"/></media:community>
  </media:group>
 </entry>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=${channelId}"/>
 <id>yt:channel:${channelId.slice(2)}</id>
 <yt:channelId>${channelId.slice(2)}</yt:channelId>
 <title>${xml(title)}</title>${entries}
</feed>`;
}
put('https://www.youtube.com/feeds/videos.xml?channel_id=UCgNs5GVvw5Td-05qp22sPLg', youtubeRss('UCgNs5GVvw5Td-05qp22sPLg', 'T10 League', FIXTURE.leagueVideos));
put('https://www.youtube.com/feeds/videos.xml?channel_id=UC2XL7xVAund-zNH6XI8Rb0w', youtubeRss('UC2XL7xVAund-zNH6XI8Rb0w', 'UAE Bulls', FIXTURE.bullsVideos));

// ---------- X public syndication timeline ----------
function xTimeline(screen: string, ids: string[]) {
  const entries = ids.map((id, i) => ({
    type: 'tweet',
    entry_id: `tweet-${id}`,
    content: {
      tweet: {
        id_str: id,
        full_text: `[test] Post ${i + 1} from @${screen} &amp; friends https://t.co/abc${i}`,
        created_at: `Wed Oct 0${i + 1} 12:00:00 +0000 2026`,
        permalink: `/${screen}/status/${id}`,
        favorite_count: 10 * (i + 1),
        entities: {},
      },
    },
  }));
  return `<!DOCTYPE html><html><head></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { timeline: { entries } } } })}</script></body></html>`;
}
put('https://syndication.twitter.com/srv/timeline-profile/screen-name/T10League', xTimeline('T10League', FIXTURE.leagueTweets));
// X often refuses anonymous timelines: the Bulls profile answers 429, so the site must fall back to the embed.
put('https://syndication.twitter.com/srv/timeline-profile/screen-name/UAEBullsT10', 'rate limited', 429);
// Aces: the page loads but has no posts.
put('https://syndication.twitter.com/srv/timeline-profile/screen-name/arabianacesT10', xTimeline('arabianacesT10', []));

// ---------- News (Google first, Bing fallback) ----------
const google = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-AE&gl=AE&ceid=AE:en`;
const bing = (q: string) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss`;
function newsRss(items: { title: string; url: string; source: string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>News</title>${items
    .map((it, i) => `<item><title>${xml(`${it.title} - ${it.source}`)}</title><link>${xml(it.url)}</link><pubDate>Mon, 0${i + 5} Oct 2026 08:00:00 GMT</pubDate><description>${xml(`<a href="${it.url}">${it.title}</a>`)}</description><source url="https://news.test.invalid">${xml(it.source)}</source></item>`)
    .join('')}</channel></rss>`;
}
put(google('"Abu Dhabi T10"'), newsRss([
  { title: '[test] League article one', url: 'https://news.test.invalid/league-1', source: 'Test Wire' },
  { title: '[test] League article two', url: 'https://news.test.invalid/league-2', source: 'Test Wire' },
]));
const [bulls, ...others] = OFFICIAL_2026_TEAMS;
// Bulls: Google is down, Bing answers.
put(google(`"${bulls.name}" T10`), 'unavailable', 503);
put(bing(`"${bulls.name}" T10`), newsRss([{ title: '[test] Bulls article', url: 'https://news.test.invalid/bulls-1', source: 'Test Daily' }]));
// The other teams: Google has nothing; Bing has no fixture (the sync should report it, not invent items).
for (const t of others) put(google(`"${t.name}" T10`), newsRss([]));

// ---------- oEmbed (admin adds a post by link) ----------
put(
  `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${FIXTURE.oembedVideo}`)}`,
  JSON.stringify({ title: '[test] Video added by link', author_name: 'T10 League', thumbnail_url: `https://i.ytimg.com/vi/${FIXTURE.oembedVideo}/hqdefault.jpg` }),
);

// ---------- CricketData (live scores) ----------
const aces = OFFICIAL_2026_TEAMS.find(t => t.id === 'aces')!;
const api = (p: string, params: Record<string, string>) => `https://api.cricapi.com/v1/${p}?${new URLSearchParams({ apikey: 'test-cricket-key', ...params }).toString()}`;
const ub = bulls.squad.map(p => p.name);
const aa = aces.squad.map(p => p.name);
const score = [
  { r: 121, w: 4, o: 10, inning: `${bulls.name} Inning 1` },
  { r: 109, w: 7, o: 10, inning: `${aces.name} Inning 1` },
];
put(api('match_info', { id: FIXTURE.cricketMatchId }), JSON.stringify({
  status: 'success',
  data: { id: FIXTURE.cricketMatchId, name: `${bulls.name} vs ${aces.name}, 1st Match`, matchStarted: true, matchEnded: true, matchWinner: bulls.name, status: `${bulls.name} won by 12 runs`, tossWinner: aces.name, tossChoice: 'bowl', score },
}));
put(api('match_scorecard', { id: FIXTURE.cricketMatchId }), JSON.stringify({
  status: 'success',
  data: {
    score,
    scorecard: [
      {
        inning: `${bulls.name} Inning 1`,
        batting: [
          { batsman: { name: ub[0] }, 'dismissal-text': `c ${aa[1]} b ${aa[17]}`, r: 44, b: 20, '4s': 4, '6s': 3, sr: 220 },
          { batsman: { name: ub[1] }, 'dismissal-text': 'not out', r: 30, b: 16, '4s': 2, '6s': 2, sr: 187.5 },
        ],
        bowling: [{ bowler: { name: aa[17] }, o: 2, m: 0, r: 18, w: 1, eco: 9 }],
      },
      {
        inning: `${aces.name} Inning 1`,
        batting: [{ batsman: { name: aa[0] }, 'dismissal-text': `b ${ub[17]}`, r: 0, b: 2, '4s': 0, '6s': 0, sr: 0 }],
        bowling: [{ bowler: { name: ub[17] }, o: 2, m: 1, r: 9, w: 3, eco: 4.5 }],
      },
    ],
  },
}));
put(api('currentMatches', { offset: '0' }), JSON.stringify({
  status: 'success',
  data: [
    { id: FIXTURE.cricketMatchId, name: `${bulls.name} vs ${aces.name}, 1st Match, Abu Dhabi T10 2026`, dateTimeGMT: '2026-11-07T14:00:00', status: 'Match not started' },
    { id: 'cd-other', name: 'Some Other Team vs Another, ODI', dateTimeGMT: '2026-11-07T10:00:00', status: '' },
  ],
}));

// ---------- Instagram (Meta Business Discovery) ----------
const IG_TOKEN = 'test-meta-token';
const IG_USER = '17841400000000000';
const igUrl = (username: string) => {
  const fields = `business_discovery.username(${username}){username,media.limit(25){caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;
  return `https://graph.facebook.com/v23.0/${IG_USER}?fields=${encodeURIComponent(fields)}&access_token=${IG_TOKEN}`;
};
put(igUrl('t10league'), JSON.stringify({
  business_discovery: {
    username: 't10league',
    media: {
      data: [
        { caption: '[test] Draft night recap\nAll six squads are set.', media_type: 'IMAGE', media_url: 'https://scontent.cdninstagram.com/test-1.jpg', permalink: 'https://www.instagram.com/p/TESTig00001/', timestamp: '2026-10-10T12:00:00+0000', like_count: 321, comments_count: 4 },
        { caption: '[test] Six of the best', media_type: 'VIDEO', media_url: 'https://scontent.cdninstagram.com/test-2.mp4', thumbnail_url: 'https://scontent.cdninstagram.com/test-2.jpg', permalink: 'https://www.instagram.com/reel/TESTig00002/', timestamp: '2026-10-11T12:00:00+0000', like_count: 99 },
      ],
    },
  },
}));
// The Bulls account answers with an API error (e.g. it is a personal account).
put(igUrl('delhibullst10'), JSON.stringify({ error: { message: '[test] Invalid user id', type: 'OAuthException', code: 110 } }));

// ---------- Post confirmation (oEmbed) for the harvester ----------
const xo = (url: string) => `https://publish.twitter.com/oembed?omit_script=1&dnt=true&url=${encodeURIComponent(url)}`;
put(xo('https://x.com/T10League/status/1990000000000000001'), JSON.stringify({
  author_name: 'Abu Dhabi T10', author_url: 'https://twitter.com/T10League',
  html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">[test] Confirmed post &amp; real text from X</p>&mdash; Abu Dhabi T10 (@T10League) <a href="https://twitter.com/T10League/status/1990000000000000001">October 12, 2026</a></blockquote>',
}));
// Claimed to be @T10League but X says another account posted it.
put(xo('https://x.com/T10League/status/1990000000000000002'), JSON.stringify({ author_name: 'Someone', author_url: 'https://twitter.com/SomeoneElse', html: '<blockquote><p>x</p></blockquote>' }));
// 1990000000000000003 has no fixture: X answers 404 (the AI invented it).
put(`https://www.tiktok.com/oembed?url=${encodeURIComponent('https://www.tiktok.com/@abudhabit10/video/7560000000000000000')}`, JSON.stringify({
  title: '[test] TikTok video confirmed', author_unique_id: 'abudhabit10', author_name: 'Abu Dhabi T10', thumbnail_url: 'https://p16-sign.tiktokcdn.com/test.jpg',
}));

// ---------- Player links (Cricsheet register + Wikidata) ----------
// Pollard (Cricbuzz 657) maps to ESPNcricinfo 230559. Max Bryant's Cricbuzz id (13120) is mapped to
// someone with another surname, so the lookup must refuse it. The social handles are test values.
put(CRICSHEET_PEOPLE_URL, [
  'identifier,name,unique_name,key_bcci,key_cricbuzz,key_cricinfo,key_cricinfo_2',
  'aa11bb22,KA Pollard,KA Pollard,,657,230559,',
  'cc33dd44,"Smith, J",J Smith,,13120,999001,',
  'ee55ff66,No Cricbuzz,No Cricbuzz,,,123456,',
].join('\n') + '\n');
put(wikidataUrl(['230559']), JSON.stringify({
  head: { vars: ['id', 'item', 'itemLabel', 'article', 'ig', 'x', 'fb', 'yt'] },
  results: { bindings: [{
    id: { type: 'literal', value: '230559' },
    item: { type: 'uri', value: 'http://www.wikidata.org/entity/Q3196442' },
    itemLabel: { type: 'literal', value: 'Kieron Pollard' },
    article: { type: 'uri', value: 'https://en.wikipedia.org/wiki/Kieron_Pollard' },
    ig: { type: 'literal', value: 'test_pollard_ig' },
    x: { type: 'literal', value: 'test_pollard_x' },
  }] },
}));

fs.writeFileSync(path.join(dir, 'fixture-ids.json'), JSON.stringify(FIXTURE, null, 2));
console.log(`fixtures written to ${dir}`);
