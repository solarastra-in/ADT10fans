# Critical user journeys

Each journey lists what the fan or admin does, what must happen, and the test that proves it.

**Test files:**

| Code | File |
|---|---|
| A | `tests/api.e2e.mjs` |
| B | `tests/browser.e2e.mjs` (390px and 360px) |
| S | `tests/storage.e2e.mjs` |
| P | `tests/prod.e2e.mjs` |
| M | `tests/migration.e2e.mjs` |
| I | `tests/i18n-check.mjs` |

## Fans

| # | Journey | Must happen | Tests |
|---|---|---|---|
| F1 | Arrive from search on any page | Server-rendered title, description, canonical and structured data; content readable without JavaScript; unknown pages are real 404s | A §14, P |
| F2 | Browse on a phone | Every page fits 360px and 390px with no sideways scroll or off-screen controls; no script errors | B |
| F3 | Sign in with an email code | Code works once, expires, is rate-limited; Google tokens are verified; sessions survive across server instances | A §2, B §4, S |
| F4 | Pick a team | Asked after first sign-in; can switch once per season; points count for the team in Fan Wars | A §4, B §4 |
| F5 | Watch official videos | Videos come from the official YouTube channels and play in the page (youtube-nocookie) | A §3, B §2 |
| F6 | Follow a team's social accounts | Only confirmed accounts are shown; each platform loads its official embed or profile on tap; teams without confirmed accounts show none | A §1, §3, B §3 |
| F7 | Read news | Headlines link to the original publishers; failed sources are reported, not filled in | A §3 |
| F8 | Build a Dream XI | 11 players, 100 credits, max 7 from one team, 1–6 per role, captain and vice-captain; locks at the first ball | A §5, B §5 |
| F9 | Get Dream XI points | Scored from the scorecard (batting, bowling, fielding, economy, strike rate); captain 2x, vice-captain 1.5x; season points = total ÷ 5; corrections re-score without double counting; personal result notification | A §5 |
| F10 | Private league | Create, share the code, friends join, table ranks members, leave | A §5 |
| F11 | Predictions and quizzes | Answers hidden until settled; must answer all; points on settlement; instant quizzes score once | A §5, B §6 |
| F12 | Daily games | Guess the Player and Super Over once a day (Dubai day); outcomes decided on the server; points awarded | A §7, B §7 |
| F13 | Spend points on prizes | Claim code; balance goes down but season points don't; stock and team limits; cancelled claims refund | A §8 |
| F14 | Enter a prize draw | Free; team and minimum-points rules; one entry each; winner can be re-checked from the published seed | A §8 |
| F15 | Forum | Threads and replies earn points up to 50 a day; reactions, upvotes; edit within 24 hours; 3 reports hide a post until reviewed; locked threads refuse replies | A §9, B §8 |
| F16 | Polls | Vote, change vote, closed polls refuse votes | A §9, B §9 |
| F17 | Fan base and leaderboard | Fans per team and country, top fans, Fan Wars, without exposing emails | A §9 |
| F18 | Fan Space pass | Book within capacity, QR pass, checks in once at the door, cancel before use | A §10, B §10 |
| F19 | Notifications | Team, signed-in and personal audiences; lock reminders once per match; mark all read | A §6, §11 |
| F20 | Invite a friend | Invite link; both get the reward once the friend first plays, never just for signing up | A §4, §5, B §11 |
| F21 | Use the site in Arabic, Hindi or Urdu | Every fan-facing string translated; Arabic and Urdu right-to-left and fitting the screen | I, B |
| F22 | Delete my account | Needs confirmation; signs out everywhere; posts stay as "Former fan" | A §15 |

## Admins

| # | Journey | Must happen | Tests |
|---|---|---|---|
| D1 | Pull the official feeds | YouTube, X, news, Curator; per-account feed health; nothing duplicated on the next pull | A §3 |
| D2 | Manage social accounts | Platform links validated; adding pulls at once; removing purges its posts and is remembered | A §3 |
| D3 | Add a post by link | Title and thumbnail from oEmbed; asks for a title if none can be read | A §3 |
| D4 | Run a match | Create fixture, link to CricketData, live sync applies score, result, scorecard and Dream XI points; or enter it by hand | A §5 |
| D5 | Edit squads | Credits validated; removing a picked player needs confirmation; provider sync previews first | A §5 |
| D6 | Settle predictions, fulfil prizes, run draws | Points paid, fans notified, refunds on cancel | A §5, §8 |
| D7 | Moderate the forum | Report queue, dismiss or hide, lock, pin, hide threads | A §9 |
| D8 | Door check-in | Camera or typed code; wrong date, cancelled and reused passes refused | A §10, B §10 |
| D9 | Team official | Sees and changes only their own team (page, accounts, posts, polls, forum, notifications); cannot touch matches, settings, admins or other teams | A §12 |
| D10 | Super admin | Adds and removes admins; the owner account and the "manage admins" permission are protected | A §12 |
| D11 | Every admin section on a phone | Opens without errors and fits 360px | B §12 |
| D12 | Scheduled jobs | Run by themselves after visits (one instance at a time); outside calls without the key cannot force extra runs; reminders, live scores and feed pulls; feeds only when due | A §6, P |
| D13 | Settings without environment variables | Keys saved in Admin → Environment apply at once and on every instance; deployment-only keys refused; secrets masked; clearing restores the default | A §13b, S |

## Platform

| # | Journey | Must happen | Tests |
|---|---|---|---|
| P1 | Several server instances | Concurrent writes from two servers all survive, in a Cloud Storage bucket or in Firestore split across documents; open Firestore rules are flagged | S |
| P2 | Upgrade an old store | Invented content removed; real fans, posts and admin content kept; unchecked accounts sent for approval | M |
| P3 | Production build | Assets cached long-term, pages cacheable at the edge, no sign-in codes or stack traces leak | P |
