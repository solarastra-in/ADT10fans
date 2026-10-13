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

## Deploying

```bash
npm run build     # client (dist/, template at dist/_template.html) and server (dist-server/server.mjs)
npm start         # NODE_ENV=production node dist-server/server.mjs
```

### Storage

Pick one:

- **One server with a disk:** set `DATA_DIR` to a persistent folder.
- **Vercel, Cloud Run with several instances, or anything serverless:** set `STORE_BUCKET`, plus a service account with Storage Object Admin on that bucket.

With a bucket, every instance reads and writes the same JSON object using conditional writes. A request that races another instance is replayed on fresh data, so nothing is overwritten. `npm run test:storage` proves this with two servers writing at once.

Without either, Vercel keeps data in `/tmp` and loses it, and the dashboard warns about this.

### Vercel

`vercel.json` routes everything to `api/index.ts`, which server-renders pages and serves the API. Static assets come from `dist/`.

It also schedules `/api/cron/run` **once a day**, because that's the most Vercel Hobby allows. Dream XI lock reminders and live scores need it every 10–15 minutes:

- **Vercel Pro:** change the schedule in `vercel.json` to `*/10 * * * *`.
- **Hobby, or any other host without cron:** use `.github/workflows/scheduled-jobs.yml`. Set the `APP_URL` repository variable and the `CRON_SECRET` secret.

Long-running servers also run the jobs every minute by themselves. Set `SCHEDULED_JOBS=off` to stop that.

Set `CRON_SECRET` in production. Without it, only signed-in super admins can run the jobs.

### Other settings

All environment variables are explained in `.env.example`. Main ones:

| Variable | Needed for |
|---|---|
| `ADMIN_EMAILS`, `APP_URL` | Always |
| `STORE_BUCKET` + service account, or `DATA_DIR` | Keeping data |
| `CRON_SECRET` | Scheduled jobs |
| `SMTP_*` | Email sign-in codes in production (Google sign-in works without it) |
| `CRICKET_API_KEY` | Automatic live scores, results, scorecards, Dream XI scoring |
| `FCM_VAPID_KEY` + `FIREBASE_SERVICE_ACCOUNT` | Push notifications (without them, notifications are in-app only) |
| `CURATOR_FEED_ID` | A Curator.io wall for Instagram/TikTok/Facebook posts |
| `GEMINI_API_KEY` | AI copy helper in the admin console (optional) |

For Google sign-in, add the production domain to Firebase Auth → Authorized domains.

Stores written by older versions are upgraded when they load:

- Invented posts, placeholder videos, stock photos, demo users and invented player statistics are removed.
- Unchecked social accounts move to **Approvals**.
- Real fans, forum posts and admin content are kept.

## Tests

```bash
npm run lint          # TypeScript: client and server
npm test              # API journeys (260+ checks), translation coverage, legacy-store upgrade
npm run test:storage  # two servers sharing one Cloud Storage object (local fake GCS), concurrent writes
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
