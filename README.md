# ADT10 Fans

A mobile-first fan platform for the Abu Dhabi T10 (season 2026, Zayed Cricket Stadium, 7–20 November).

Fans can:

- Follow fixtures, live scores and scorecards.
- Browse the six franchises and their squads.
- Watch the official YouTube channels in the page.
- Read the official X, Facebook, Instagram, Threads and TikTok accounts.
- Play Dream XI (fantasy cricket), the daily games, predictions and quizzes.
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
| `/matches`, `/matches/:id` | Fixtures, results, scorecards, Dream XI points per player, match polls and threads |
| `/teams`, `/teams/:id` | The six franchises; squad, fixtures, official channels, fans |
| `/players`, `/players/:id` | Every player: role, credits, fantasy points per match |
| `/social`, `/videos`, `/news` | Official accounts, in-page videos, publisher headlines |
| `/play`, `/fantasy`, `/fantasy/:matchId` | Play hub; Dream XI season standings, private leagues and the team builder |
| `/games` | Guess the Player and Super Over (daily) |
| `/contests` | Match predictions and instant quizzes |
| `/prizes` | Prize catalogue (spend points) and free prize draws |
| `/leaderboard`, `/fans` | Fan Wars, top fans, fan base by team and country |
| `/forum`, `/forum/:id` | Threads, replies, reactions, reports, polls |
| `/fanspaces` | Watch parties and screenings; book a pass with a QR code |
| `/rules`, `/privacy`, `/terms` | How points work, privacy notice, terms |
| `/profile` | Points, badges, Dream XI history, claims, passes, invite link (not indexed) |
| `/admin` | Admin console (not indexed) |

Each page gets its own title, description, canonical link, Open Graph tags and structured data (SportsEvent, SportsTeam, Person, DiscussionForumPosting). There's also `/sitemap.xml` and `/robots.txt`, and unknown addresses return a real 404.

## Admin console

**Who can sign in:**

- **Super admins:** the owner account, everyone in `ADMIN_EMAILS`, and admins added with the super admin role. They can add other admins.
- **Other admin roles:** each gets the sections its permissions cover.
- **Team officials:** manage only their own team's page, social accounts, posts, forum threads, polls and fan notifications.

**First steps after deploying:**

1. **Dashboard:** check the integrations panel. It tells you what is switched off and why.
2. **Feeds → Pull now:** pulls the official YouTube channels, X timelines, news, and Curator if set up. After that, pulls run on schedule. **Feed health** shows what each account returned.
3. **Handles:** add each team's accounts once you have confirmed them. Adding one pulls it straight away. Removed official handles are never re-added automatically.
4. **Matches:** add fixtures when the league publishes them.
   - With `CRICKET_API_KEY`, press **Find** to link each fixture to its CricketData match. Scores, results, scorecards and Dream XI points then follow by themselves.
   - Without it, enter the score and scorecard by hand. Saving a match as completed sends the result and scores every Dream XI lineup.
5. **Squad editor:** edit squads, set a player's Dream XI credits, and mark Icon/Platinum players.
   - Removing a player who is in fans' Dream XI lineups asks you to confirm first.
   - **Squad tools** can read squads from CricketData or Cricbuzz. It shows a preview before saving, and keeps existing players unless you tick *Replace*.
6. **Predictions, Prizes, Prize draws, Polls, Fan Spaces, Growth:** create what fans should see. Empty sections show a short "coming soon" message.
7. **Door check-in:** scan Fan Space passes with a phone camera, or type the code.

## Social feeds: how posts get onto the site

Everything shown is a real post from an official account. Every post kept is stored, so it stays on the site after it drops off the platform's "latest" list (up to 1,500 social posts; pinned posts are never dropped).

| Platform | How posts are pulled | Setup |
|---|---|---|
| YouTube | Channel RSS, every 10 minutes | None |
| X | Public timeline every 10 minutes when X allows it. Otherwise the harvester (below) finds posts, and the X timeline embed is shown | Gemini key for the harvester |
| Instagram | Meta's official Business Discovery API, every 10 minutes | Meta token, once (below) |
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

**Publish `firestore.rules`** in Firebase console → Firestore → Rules, or run `firebase deploy --only firestore:rules`. These rules close the database to browsers; the site's server isn't subject to them. The rules this project had before let any signed-in user make themselves an admin and read everything. The dashboard warns if the data can be read without signing in.

**How the data is stored:**

- The site's data is one JSON document set in the `adt10_store` collection, split into chunks of about 900 KB.
- Every write is one atomic commit that only succeeds if nothing changed since the server read the data. Several Vercel instances can write at once without overwriting each other; `npm run test:storage` proves this with two servers racing.
- Firestore's free tier allows 20,000 writes a day. A fan action costs one write per chunk (usually one or two). For bigger match days, switch the Firebase project to the Blaze plan; Firestore costs cents at this scale.

**Other storage options:**

- `STORE_BUCKET`: use a Cloud Storage bucket instead of Firestore.
- `DATA_DIR`: a folder, for a single server with its own disk.
- With neither, and no service account, Vercel keeps data in `/tmp` and loses it; the dashboard warns about this.

### Scheduled jobs

These are Dream XI lock reminders, live scores and feed pulls. They **run by themselves**: after a visit, if four minutes have passed since the last run, the server runs them once. On Vercel it keeps the function alive for this. A lease in the store makes sure only one instance runs them at a time. No cron or secret is needed.

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
npm test              # API journeys (260+ checks), translation coverage, legacy-store upgrade
npm run test:storage  # two servers sharing one store (fake Cloud Storage, then fake Firestore), concurrent writes
npm run test:prod     # production build smoke test
npm run test:browser  # Playwright at 390px and 360px: every page, embeds, sign-in, Dream XI, games,
                      # forum, Fan Space pass, admin console sections, Arabic/Urdu right-to-left
npm run test:all      # everything (also run by .github/workflows/ci.yml)
```

The tests run offline. `tests/make-fixtures.ts` writes recorded-format responses for every outside source, and the server reads them when `FEED_FIXTURES_DIR` is set:

- YouTube channel RSS
- X timelines (including a refused one)
- Google and Bing news
- oEmbed
- CricketData match info, scorecard and match list

The browser tests block all outside requests and check that each embed points at the official account. They expect Chromium at `/opt/pw-browsers/chromium`; set `CHROMIUM_PATH` to use another one.

User journeys and what covers them: [docs/CUJS.md](docs/CUJS.md). Ideas that came out of this work and what was built: [docs/FAN_PLATFORM_IMPROVEMENTS.md](docs/FAN_PLATFORM_IMPROVEMENTS.md).

## Security

- **Google sign-in:** the server verifies the Firebase ID token's signature, issuer, audience and verified email.
- **Email codes:** stored hashed, expire after 10 minutes, rate-limited per IP, with an attempt cap.
- **Sessions:** random 256-bit tokens, stored hashed, expire after 30 days, revoked on logout and on account deletion.
- **Rate limits:** use the address set by the hosting platform or the nearest proxy, so a forged `X-Forwarded-For` header doesn't get around them.
- **Never shown to fans:**
  - contest answers before settlement
  - entrants' emails
  - draw winners' account ids
  - SMTP and Curator secrets
  - sync errors
  - the confidential proposal
- **Embeds:** third-party embeds load only when a fan taps them, and YouTube uses the youtube-nocookie player.

© 2026 Azlir Sports.
