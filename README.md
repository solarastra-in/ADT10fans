# ADT10 Fans

A mobile-first fan hub for the Abu Dhabi T10: fixtures and live scores, teams and squads, official social and news feeds, prediction contests, a Fantasy 10 lineup builder, prize draws, a forum, Fan Spaces and push notifications.

Nothing on the site is pre-filled. Everything fans see is created by an admin in the **Admin Console** (`/admin`).

## Quick start

```bash
npm install
cp .env.example .env        # at minimum set ADMIN_EMAILS
npm run dev                 # http://localhost:3000
```

In development, email sign-in shows the one-time code on screen, so SMTP isn't needed.

## First-time setup (Admin Console)

1. Sign in with an email listed in `ADMIN_EMAILS`, then open **Admin → Teams → Seed official franchises**. This creates the six 2026 franchises with their direct signings:
   - UAE Bulls
   - United Tigers
   - Yas Lions
   - Arabian Aces
   - Emirates Eagles
   - Desert Royal Champions

   It also adds the official league handles and the team handles that have been checked. Running it again keeps your edits.
2. **Handles:** add each team's official accounts. You can also run the *Discovery* agent, which puts suggestions in **Approvals** as *pending*. Fans only ever see verified handles.
3. **Feeds → Sync official feeds now:** pulls videos from every verified YouTube channel, plus Google News articles. After that it refreshes automatically every `FEED_SYNC_MINUTES`. For Instagram, X, TikTok and Facebook, either set a Curator.io feed in **Settings** or add posts by hand.
4. **Matches:** add fixtures once they're announced, and enter live scores during games. Marking a match completed sends a result notification.
5. **Contests, Draws, Fan Spaces, Growth, Settings:** create whatever you want fans to see. Sections with no content show a short "coming soon" state instead of placeholder data.

## Production

```bash
npm run build     # builds the client (dist/) and the server (dist-server/server.mjs)
npm start         # NODE_ENV=production node dist-server/server.mjs
```

Environment variables are documented in `.env.example`. For production you need:

- **`ADMIN_EMAILS`**
- **`APP_URL`**
- **`DATA_DIR` on persistent storage.** The data store is a JSON file. On Cloud Run or similar, mount a volume (for example a Cloud Storage FUSE volume) and point `DATA_DIR` at it, or all data is lost on every restart. Run a single instance, because the file store is not safe for several instances writing at once.
- **Google sign-in:** add your production domain to Firebase Auth → *Authorized domains*.
- **Email sign-in:** set the `SMTP_*` variables. Without them, only Google sign-in is offered.
- **Push notifications:** `FCM_VAPID_KEY` for the browser, plus `FIREBASE_SERVICE_ACCOUNT` to send. Without them, notifications are stored and shown in the app only.
- **AI assistant (optional):** `GEMINI_API_KEY`. Without it the assistant is hidden.

Stores written by older versions are migrated on first start. Invented demo content is removed, real accounts and forum posts are kept, and a `.v1.bak` copy of the old file is saved.

## Security model

- **Google sign-in:** the server verifies the Firebase ID token's signature, issuer, audience and verified email.
- **Email sign-in:** 6-digit codes are stored hashed, expire after 10 minutes, and are rate-limited with an attempt cap.
- **Sessions:** random 256-bit bearer tokens, stored hashed, expiring after 30 days, and revoked on logout.
- **Admin access:** the admin role comes only from `ADMIN_EMAILS` and the Admin Console list.
- **Hidden from fans:**
  - contest answers (until a contest is settled)
  - entrant emails
  - the SMTP password and Curator key
  - the confidential proposal (`/proposal` is admin-only)

## Tests

```bash
npm test          # starts a throwaway server on an empty data dir and runs tests/api.e2e.mjs (60 checks)
npm run lint      # TypeScript type-check
```

© 2026 Azlir Sports.
