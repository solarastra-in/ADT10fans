# ADT10 Fans

A mobile-first fan platform for the Abu Dhabi T10 (season 2026, Zayed Cricket Stadium, 7–20 November).

Fans can:

- Follow fixtures, live scores and scorecards.
- Browse the six franchises and their squads.
- Watch the official YouTube channels in the page.
- Read the official X, Facebook, Instagram, Threads and TikTok accounts.
- Open any player's card: this season's figures from real scorecards, plus links to their career stats (ESPNcricinfo, Cricbuzz), Wikipedia and their verified social accounts.
- Play Pick XI (fantasy cricket), predictions, quizzes and the daily games: Squad Connections, Cricket Grid, Stat Wars (60 seconds) and Stat Wars duels against friends, Guess the Player and Super Over.
- Post photos and matchday moments on the fan wall; the organisers pick a Fan of the Day, who wins points.
- Spend points on prizes and enter free draws.
- Talk in the forum and vote in polls.
- Book Fan Space passes with QR check-in.
- Invite friends.

Everything is free to play. The interface is in English, Arabic, Hindi and Urdu, with right-to-left layout for Arabic and Urdu.

**Nothing fans see is invented:**

- The six squads ship as published after the 2026 draft, with no invented statistics.
- Only social accounts that were checked to belong to the league or a team are listed (see `server/seedOfficial.ts` for the evidence behind each one).
- Every video, post and headline comes from a real pull of its source.
- If a source can't be read, the site shows the platform's own embed or a link to the profile, never filler.

## Quick start

```bash
npm install
cp .env.example .env        # set ADMIN_EMAILS to your email
npm run dev                 # http://localhost:3000
```

In development, email sign-in shows the one-time code on screen, so no mail server is needed.

## Pages (all server-rendered for search engines)

| Path | What |
|---|---|
| `/` | Home: next match, live scores, play hub, latest videos |
| `/matches`, `/matches/:id` | Fixtures, results, scorecards, Pick XI points per player, match polls and threads |
| `/teams`, `/teams/:id` | The six franchises; squad, fixtures, official channels, fans |
| `/players`, `/players/:id` | Every player: role, credits, season figures, career-stats and social links; tapping a player anywhere opens their card |
| `/social`, `/videos`, `/news` | Official accounts, in-page videos, publisher headlines |
| `/play`, `/fantasy`, `/fantasy/:matchId` | Play hub; Pick XI season standings, private leagues and the team builder |
| `/games` | Squad Connections, Cricket Grid, Stat Wars, duels, Guess the Player, Super Over (daily) |
| `/duel/:id` | A Stat Wars duel invite (not indexed) |
| `/fanwall`, `/fanwall/:id` | Fan photos and moments, Fan of the Day |
| `/contests` | Match predictions and instant quizzes |
| `/prizes` | Prize catalogue (spend points) and free prize draws |
| `/leaderboard`, `/fans` | Fan Wars, top fans, fan base by team and country |
| `/forum`, `/forum/:id` | Threads, replies, reactions, reports, polls |
| `/fanspaces` | Watch parties and screenings; book a pass with a QR code |
| `/rules`, `/privacy`, `/terms` | How points work, privacy notice, terms |
| `/profile` | Points, badges, Pick XI history, claims, passes, invite link (not indexed) |
| `/admin` | Admin console (not indexed) |
| `/team-portal` | A franchise's own portal for its team admins (not indexed) |

Each page gets its own title, description, canonical link, Open Graph tags, a 1200×630 share image drawn by the server (`/og/…`, no player photos), breadcrumbs and structured data: SportsEvent (with location, teams and status), SportsTeam and SportsOrganization, ProfilePage and Person with `sameAs` links to the player's verified profiles, VideoObject, DiscussionForumPosting. `/sitemap.xml` lists pages with their real last-change dates and images; `/robots.txt` keeps crawlers out of `/api/admin/` and `/api/cron/` only, so the data pages render fully for Google. API responses carry `X-Robots-Tag: noindex`. Unknown addresses return a real 404.

## Admin console

**Who can sign in:**

- **Super admins:** the owner account, everyone in `ADMIN_EMAILS`, and admins added with the super admin role. They can add other admins.
- **Other admin roles:** each gets the sections its permissions cover.
- **Team admins (team officials):** run only their own franchise in its **team portal** (`/team-portal`): team page, squad and player details, official accounts, posts, prizes for their fans (and fulfilling those claims), polls, forum, fan wall moderation and messages to their fans. They never see league-wide figures, settings, other teams, fans' points, prize draws or Fan of the Day.

**Onboarding a team admin:** Admin → Admins & RBAC → *Onboard a team admin*: enter their name, email and team, then send. They get an email with a link (valid 7 days, works once). They sign in with that same email, accept, and land in their team's portal. Without email (SMTP) set up, the link is shown to you once to send yourself. You can resend (a fresh link) or withdraw a pending invitation, and remove a team admin in the list below it. As super admin, open any team's portal from the menu (Team portal) to see what its admins see.

**First steps after deploying:**

1. **Dashboard:** check the integrations panel. It tells you what is switched off and why.
2. **Feeds → Pull now:** pulls the official YouTube channels, X timelines, news, and Curator if set up. After that, pulls run on schedule. **Feed health** shows what each account returned.
3. **Handles:** add each team's accounts once you have confirmed them. Adding one pulls it straight away. Removed official handles are never re-added automatically.
4. **Matches:** add fixtures when the league publishes them.
   - With `CRICKET_API_KEY`, press **Find** to link each fixture to its CricketData match. Scores, results, scorecards and Pick XI points then follow by themselves.
   - Without it, enter the score and scorecard by hand. Saving a match as completed sends the result and scores every Pick XI lineup.
5. **Squad editor:** edit squads, set a player's Pick XI credits, and mark Icon/Platinum players.
   - **Find player links** (also hourly by itself) fills in each player's ESPNcricinfo, Cricbuzz, Wikipedia, Instagram, X, Facebook and YouTube links. It goes from the player's Cricbuzz id through the [Cricsheet register](https://cricsheet.org/register) to Wikidata, and keeps a link only when the surname matches. Links you type yourself are never overwritten. Run it once after deploying, then check a few players.
   - Removing a player who is in fans' Pick XI lineups asks you to confirm first.
   - **Squad tools** can read squads from CricketData or Cricbuzz. It shows a preview before saving, and keeps existing players unless you tick *Replace*.
6. **Fan wall:** approve photos (Settings → fan wall review: photos, everything or nothing), deal with reports, and pick a **Fan of the Day** (default 100 points, set in Settings; picking another post the same day moves the title and the points).
7. **Predictions, Prizes, Prize draws, Polls, Fan Spaces, Growth:** create what fans should see. Empty sections show a short "coming soon" message.
8. **Door check-in:** scan Fan Space passes with a phone camera, or type the code.

## Social feeds: how posts get onto the site

Everything shown is a real post from an official account. Every post kept is stored, so it stays on the site after it drops off the platform's "latest" list (up to 1,500 social posts; pinned posts are never dropped).

| Platform | How posts are pulled | Setup |
|---|---|---|
| YouTube | Channel RSS, every 10 minutes | None |
| X | Public timeline every 10 minutes when X allows it. Otherwise the harvester (below) finds posts, and the X timeline embed is shown | Gemini key for the harvester |
| Instagram | Meta's official Business Discovery API, every 10 minutes. Until that is set up, Instagram's own profile embed shows the latest posts | Meta token, once (below) |
| TikTok | Harvester (below); the creator embed is always shown | Gemini key |
| Facebook, Threads, LinkedIn | Live embed or profile card; these platforms offer no public feed without an approved app | Optional feed address |
| Any account | A **feed address** (RSS/Atom) on the account, e.g. from an RSS bridge service | Admin → Handles → edit → Feed address |

**Social harvester** (Admin → Feeds, also hourly by itself):

1. Gemini web search suggests recent X and TikTok post links from each team's official accounts.
2. Each link is confirmed with the platform's own oEmbed service: the post must exist and must be by that exact account.
3. Only confirmed posts are kept, with the text, thumbnail and date the platform returns, never what the AI wrote.

Links that fail are dropped, and the run summary says how many and why. If a search returns nothing, nothing is added.

**Instagram setup (once, about 15 minutes).** Meta's Business Discovery API returns the latest public posts of any Instagram business or creator account, which covers the league and the teams. It works through an Instagram professional account of your own:

1. Make an Instagram account you control a professional (Business or Creator) account and link it to a Facebook Page.
2. At developers.facebook.com, create an app of type *Business* and add the Instagram product.
3. In Meta Business Suite → Settings → Users → **System users**:
   - Create a system user.
   - Give it the app, the Page and the Instagram account.
   - Generate a token with `instagram_basic`, `pages_show_list` and `pages_read_engagement`.

   A system-user token does not expire. If Meta asks for App Review for these permissions, complete it before switching the app to Live.
4. Get your Instagram account id. In the Graph API Explorer, call `me/accounts?fields=instagram_business_account` and copy the `id` inside `instagram_business_account`.
5. In Admin → Environment, save:
   - **Meta access token**
   - **Your Instagram account id**

   The next pull, within 10 minutes, fills in Instagram posts. Admin → Feeds → Feed health shows each account's result or the API's error message.

**Webhook** (optional): with a **Feed webhook key** saved in Admin → Environment, tools like Zapier, Make or IFTTT can `POST /api/feeds/webhook` with `{ "url": "…", "teamId": "aces" }` and the header `X-Webhook-Secret: <key>`.

## Deploying

```bash
npm run build     # client (dist/, template at dist/_template.html) and server (dist-server/server.mjs)
npm start         # NODE_ENV=production node dist-server/server.mjs
```

### On Vercel: one environment variable

Set **`FIREBASE_SERVICE_ACCOUNT`** in Vercel (Project → Settings → Environment Variables) and redeploy:

1. In the Firebase console, open Project settings → Service accounts → **Generate new private key**.
2. Paste the whole JSON file as the value.

That key lets the server keep its data in your Firebase project's **Firestore** database, which works on the free Spark plan. It also lets the site send push notifications. The project and database come from `firebase-applet-config.json`.

Everything else is set in **Admin → Environment** after you sign in. Values saved there are kept with the site's data and apply on every server within seconds:

- the CricketData live-score key
- email (SMTP) for sign-in codes
- the web-push key
- the Gemini key
- Curator
- the site address
- extra admin emails
- feed and reminder timings

The owner account (`solarastra.in@gmail.com`) is always a super admin. Add other admins in Admin → Admins.

**Lock the database, in this order:**

1. Set `FIREBASE_SERVICE_ACCOUNT` and redeploy (the server then reads and writes with the service account).
2. Publish `firestore.rules` and `storage.rules` (Firebase console → Firestore → Rules and Storage → Rules, or `firebase deploy --only firestore:rules,storage`). Both deny all browser access; the server isn't subject to them.
3. Rotate every key that was saved in Admin → Environment while the old rules were live (SMTP password, CricketData, Gemini, Meta token, Curator, cron secret). The old rules let anyone on the internet read and write the whole store, including those keys, fans' emails and sessions.

The dashboard warns while the data can be read without signing in.

**How the data is stored:**

- The data is split into shards by kind (teams, matches, settings…), and the collections that grow with fans are split further: users and sessions by id, the points ledger and game plays by day, Pick XI lineups by match, fan wall posts by month. Shards live in `<collection>_shards` (one small document each) with their content in `<collection>_chunks`.
- A fan action writes only the shards it changed, usually one or two small documents, so the store keeps working long past the old single-document limit (about 10 MB, which a busy season reaches through the points ledger and lineups).
- Each commit only succeeds if those shards are unchanged since the server read them, so several Vercel instances can write at once without overwriting each other. Other instances pick up changes with a cheap "what changed since" query instead of re-reading everything.
- Stores written by older versions (one blob) are migrated on first load.
- Read-only requests don't take the write lock, and public pages and API reads are cached at the CDN for a short time (see `CDN_CACHE` in `server/app.ts`), so a match-day spike mostly hits the cache.
- Firestore's free tier allows 20,000 writes a day. For match days, switch the Firebase project to the Blaze plan; Firestore costs cents at this scale.
- The whole store is still held in memory on each instance. That's fine for a season of this size; if the fan base grows into the hundreds of thousands, move lineups and the points ledger to one Firestore document per record next.

**Fan wall photos** go to the project's Firebase Storage bucket (or `FANWALL_BUCKET`) through the service account. Turn Storage on in the Firebase console first; new projects may need the Blaze plan for it. Photos are checked by their bytes (JPEG or PNG, at most 3 MB), shrunk in the browser, and stripped of location data (EXIF/GPS) before they're stored. Without Storage, fans can still post text.

**Other storage options:**

- `STORE_BUCKET`: use a Cloud Storage bucket instead of Firestore.
- `DATA_DIR`: a folder, for a single server with its own disk.
- With neither, and no service account, Vercel keeps data in `/tmp` and loses it; the dashboard warns about this.

### Scheduled jobs

These are Pick XI lock reminders, live scores, feed pulls, player links and housekeeping (expired sessions and codes, old notifications). They **run by themselves**: after a visit, if four minutes have passed since the last run, the server runs them once. On Vercel it keeps the function alive for this. A lease in the store makes sure only one instance runs them at a time. No cron or secret is needed.

Optional extras:

- `vercel.json` also calls `/api/cron/run` once a day, for days without visitors.
- `.github/workflows/scheduled-jobs.yml` can call it every 10 minutes. Set the `APP_URL` repository variable.

Without a key, that endpoint only runs jobs that are due. A `CRON_SECRET`, saved in Admin → Environment, or a super admin session can force a run. `SCHEDULED_JOBS=off` turns automatic jobs off.

### Running on your own server

Same as Vercel. Long-running servers also check every minute. Optional settings are listed in `.env.example`. Any setting in Admin → Environment can also be given as an environment variable; a value saved in the console wins.

Stores written by older versions are upgraded when they load:

- Invented posts, placeholder videos, stock photos, demo users and invented player statistics are removed.
- Unchecked social accounts move to **Approvals**.
- Real fans, forum posts and admin content are kept.

## Tests

```bash
npm run lint          # TypeScript: client and server
npm test              # API journeys (390+ checks), translation coverage, legacy-store upgrade
npm run test:storage  # two servers sharing one store (fake Cloud Storage, then fake Firestore), concurrent writes,
                      # sharded commits and the one-blob migration
npm run test:prod     # production build smoke test
npm run test:browser  # Playwright at 390px and 360px: every page, embeds, sign-in, Pick XI, games,
                      # forum, Fan Space pass, admin console sections, Arabic/Urdu right-to-left
npm run test:all      # everything (also run by .github/workflows/ci.yml)
```

The tests run offline. `tests/make-fixtures.ts` writes recorded-format responses for every outside source, and the server reads them when `FEED_FIXTURES_DIR` is set:

- YouTube channel RSS
- X timelines (including a refused one)
- Google and Bing news
- oEmbed
- CricketData match info, scorecard and match list
- the Cricsheet player register and Wikidata

The browser tests block all outside requests and check that each embed points at the official account. They expect Chromium at `/opt/pw-browsers/chromium`; set `CHROMIUM_PATH` to use another one.

User journeys and what covers them: [docs/CUJS.md](docs/CUJS.md). Ideas that came out of this work and what was built: [docs/FAN_PLATFORM_IMPROVEMENTS.md](docs/FAN_PLATFORM_IMPROVEMENTS.md).

## Security

- **Google sign-in:** the server verifies the Firebase ID token's signature, issuer, audience and verified email.
- **Email codes:** stored hashed, expire after 10 minutes, rate-limited per IP, with an attempt cap. Never written to production logs; without SMTP, email sign-in is off in production. SMTP checks the mail server's certificate (`SMTP_INSECURE_TLS=1` turns that off for a server with a self-signed one).
- **Games:** puzzles and Stat Wars questions are generated from a secret kept in the store, so every server gives the same puzzle and answers can't be worked out in the browser. Stat Wars answers that arrive after the 60 seconds score 0.
- **Scraper endpoints** that fetch outside pages are admin-only.
- **Sessions:** random 256-bit tokens, stored hashed, expire after 30 days, revoked on logout and on account deletion.
- **Rate limits:** use the address set by the hosting platform or the nearest proxy, so a forged `X-Forwarded-For` header doesn't get around them.
- **Never shown to fans:**
  - contest answers before settlement
  - entrants' emails
  - draw winners' account ids
  - SMTP and Curator secrets
  - sync errors
  - the confidential proposal
- **Embeds:** an account's live embed (YouTube uploads, X timeline, Instagram profile, Facebook page, TikTok creator) loads when it scrolls into view on a team or social page; single-post embeds load only when tapped. YouTube uses the youtube-nocookie player.

© 2026 Azlir Sports.
