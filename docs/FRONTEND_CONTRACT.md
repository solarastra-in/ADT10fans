# Frontend ↔ server contract (production pass, Sept 2026)

This is the contract every component must follow. `src/api.ts` and `src/types.ts` already implement it — use them, do not add ad‑hoc `fetch` calls.

## Ground rules for fan-visible UI

1. **No invented data.** Never hardcode teams, players, scores, fixtures, follower/view/listener counts, fan counts, subscriber counts, prices, venues, schools, creators, quotes, testimonials, ROI numbers or social posts in components. Everything fans see comes from the API, which an admin fills in through the Admin Console.
2. **No fake links.** Only render a link when the URL came from the API. Never build profile URLs from team names. Never fall back to `https://youtube.com`, `https://arabianaces.com`, Unsplash or DiceBear images. If an image URL is missing, render a neutral initials/icon placeholder (CSS only).
3. **Empty states, not filler.** When a list is empty, show a short friendly empty state ("Fixtures will appear here once they're announced.") and, when `user?.role === 'admin'`, a button that takes the admin to the relevant Admin Console tab. Never show "demo", "simulated", "mock" wording to fans.
4. **No fabricated verification.** Only show a "verified" badge on a handle when `handle.status === 'verified'`, and on a feed item only when `item.verifiedReal === true`.
5. **Numbers must be real.** Counts shown to fans (fans, entries, bookings, interest registrations) come from the server. Never add a base offset.
6. **Don't promise what doesn't exist.** No "SHA-256 provably fair" hype unless the draw has `seed`/`entrantsHash` (show them after it is drawn). No "15% off tickets" unless the tier says so. No "AI-generated live commentary".
7. **Brand text** (site name, tagline, copyright holder, season label/dates, venue, ticker) comes from `PublicConfig` (`api.getConfig()`), loaded once in `App.tsx` and passed down as `config`. Fallbacks when a field is blank: brandName `ADT10 Fans`, copyright holder `Azlir Sports`.
8. The **League Proposal** page is confidential: admin‑only. It must never be linked from fan navigation, the home page, the forum or the footer for non-admins.

## Mobile-first requirements (primary target: 360–430 px wide)

- No horizontal page scroll at 360 px. Horizontal chip rows must be their own `overflow-x-auto` scroller with `scrollbar-none` and `-mx-4 px-4` bleed.
- Tap targets ≥ 44 px tall for primary actions, ≥ 36 px for chips. Inputs ≥ 16 px font (prevents iOS zoom): use `text-base sm:text-sm` on inputs/selects/textareas.
- Body copy ≥ 14 px on mobile (`text-sm`), labels ≥ 12 px (`text-xs`); avoid `text-[10px]`/`text-[9px]` for anything meaningful.
- Grids: 1 column on mobile, grow at `sm:`/`md:`/`lg:`. Tables become stacked cards below `md:`.
- Modals/drawers: full-screen or bottom sheet on mobile (`fixed inset-0 sm:inset-auto …`), scrollable body (`max-h-[100dvh] overflow-y-auto`), close button ≥ 44 px, respect `env(safe-area-inset-bottom)`.
- Fixed bottom nav is 64 px + safe area; page content already has bottom padding in `App.tsx`. Floating buttons must sit above it and must not cover primary content.
- Prefer `dvh` over `vh`. Images: `loading="lazy"`, explicit aspect ratio, `object-cover`.
- Keep the existing dark slate/amber visual language.

## Key API shapes (see src/api.ts)

- `api.getConfig()` → `{ config: PublicConfig }` (public).
- Auth: `api.loginGoogle(idToken)` (Firebase popup → `result.user.getIdToken()`), `api.requestOtp(email)` → `{ success, message, devCode? }` (devCode only in local dev), `api.verifyOtp(email, code)`, `api.logout()`.
- Teams: `api.getTeams()`; admin `api.saveTeam`, `api.deleteTeam`, `api.seedOfficialTeams(overwrite)`.
- Players carry `category` ('Icon' | 'Platinum' | …) and `isIcon`.
- Handles: `api.getHandles()` → fans only receive `status === 'verified'`; admins receive all.
- Feeds: `api.getFeeds()`; admin `api.syncRealFeeds()` (POST /api/admin/feeds/sync), `api.saveFeedItem`, `api.deleteFeedItem`. Items have `sourceType`.
- Matches: `api.getMatches()`; admin `api.saveMatch`, `api.deleteMatch`. There is **no** simulate-ball endpoint any more; live scores are entered by an admin.
- Contests: `api.getContests()` → `{ contests, myEntries, entryCounts }` — `question.answer` is only present once a contest is settled (instant trivia is graded on the server and returns `pointsAwarded`).
- Draws: `api.getDraws()` → `{ draws (with entriesCount, entered), myEntries }`; admin `api.saveDraw`, `api.deleteDraw`, `api.getDrawEntries`, `api.executeDraw`.
- Forum admin: `api.deleteForumThread`, `api.deleteForumComment`, `api.pinForumThread`.
- Growth: `api.getGrowthCatalysts()`; admin save/delete for youth schools, creators, audio feeds, passport tiers. `api.subscribeSuperfanPassport(tierId)` registers interest only (no payment).
- Proposal (admin only): `api.getProposalSettings()`, `api.saveProposalSettings`, `api.resetProposalSettings`.
- Removed: `simulateBall`, `resetDemo`, `generateMusic`, `generateVideo`, `seedAnnouncedTeamsAndSearch`, `publicUserCountOverride`.
- Gemini endpoints (`chatGemini`, `searchGrounding`) require a signed-in user; they return HTTP 503 with `{ error }` when Gemini isn't configured — show that message, never a canned answer. `generateMarketing` and `transcribeAudio` are admin-only.
