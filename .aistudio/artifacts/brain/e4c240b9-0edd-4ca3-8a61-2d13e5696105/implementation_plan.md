# Implementation Plan: Global & Hyderabad Fan Clubs, Super Admin Seeding, QR Check-Ins & Configurable Follow Gateways

This revised plan incorporates global fan clubs (with primary hubs across Hyderabad, India), full Super Admin management and seeding for all fan clubs and locations, configurable social follow gateways (making X/Twitter follow an optional admin toggle), matchday QR check-ins 90 minutes before matches, and single-use venue offers.

---

## 1. User & Admin Architecture

```
[ Super Admin Settings & Fan Club Management ]
        │
        ├─ Seeds & Manages Global & Hyderabad Fan Clubs (Banjara Hills, HITEC City, Charminar, Abu Dhabi, etc.)
        └─ Configures Social Verification Gateways (Toggle Instagram / X follow gates on or off)
        
[ Fan Journey ]
        │
        ▼
[ Mandatory Instagram Follow Gate ] ──▶ Deep-links to Instagram (@ArabianAcesofficial)
        │                                Fan confirms handle ──▶ Unlocks site & +25 pts
        ▼
[ Public Browsing vs Protected Games ]
        ├─ Public: Teams, Squads, Matches, Feed, Rules, Prizes (Read-only)
        └─ Protected: Pick XI, Match Predictions, Arcade/Duels, Fan Club Check-in
                │
                ▼ (Requires Auth)
[ Login Gateway ] ──▶ Standard auth (Google Auth or Email OTP); X/Twitter follow is optional/admin-toggled
        │
        ▼
[ Matchday Check-In Window (T-90 mins before match start) ]
        │
        ├─ Fan Profile / Hub shows personalized Fan Club Matchday QR Code & 6-char fallback
        │
        ▼ (At Local Fan Club / Venue in Hyderabad, UAE, etc.)
[ Fan Club Venue Admin Portal (`/admin/fanclub`) ]
        │
        ├─ Admin selects their Fan Club station from the seeded global/Hyderabad list (locked for session)
        ├─ Camera QR Scanner (with manual code fallback)
        ├─ Scans Fan QR Code ──▶ Validates 90-min window ──▶ Awards +100 Fan Points
        │
        ▼
[ One-Time Fan Club Venue Offers ]
        ├─ Fan views venue-specific vouchers (e.g. Hyderabad Screening Pass, Matchday Merch Discount)
        └─ Once redeemed at the desk, marked permanently as "Claimed" (single-use)
```

---

## 2. Proposed Changes

### Data Model & Backend Architecture (`server/db.ts`, `server/routes/`, `server/seedOfficial.ts`)

#### 1. Global & Hyderabad Fan Club Locations (`server/data/officialVenues.ts`)
Seed comprehensive fan club chapters across the globe with primary focus in **Hyderabad, India** and UAE:
- **Hyderabad, India Hubs**:
  - `fc-hyd-banjara`: **Arabian Aces Fan Club – Banjara Hills, Hyderabad** (Road No. 12 Lounge & Screening Arena)
  - `fc-hyd-cyberabad`: **Arabian Aces Fan Club – HITEC City / Cyberabad** (Tech Park Fan Screening Hub)
  - `fc-hyd-charminar`: **Arabian Aces Fan Club – Old City / Charminar Chapter**
  - `fc-hyd-gachibowli`: **Arabian Aces Fan Club – Gachibowli Stadium Zone**
  - `fc-hyd-secunderabad`: **Arabian Aces Fan Club – Secunderabad Club Hub**
- **UAE & International Hubs**:
  - `fc-uae-zayed`: **Zayed Cricket Stadium Fan Village – Abu Dhabi**
  - `fc-uae-corniche`: **Abu Dhabi Corniche Fan Zone**
  - `fc-uae-dubai`: **Dubai Sports City Fan Hub**
  - `fc-uk-london`: **London International Fan Chapter**

#### 2. Super Admin Fan Club Seeding & Management (`server/routes/admin.ts`, `server/routes/fanclub.ts`)
- `GET /api/admin/fanclubs`: Lists all fan clubs worldwide, check-in stats, and active venue admins.
- `POST /api/admin/fanclubs`: Super Admin can create, edit, or delete any fan club and its geographical location (city, state, country, address, capacity, coordinates).
- `POST /api/admin/fanclubs/seed`: Resets/seeds the official global and Hyderabad fan clubs list.

#### 3. Configurable Social Follow Settings (`server/db.ts`, `server/routes/admin.ts`)
- Add settings in `store.settings`:
  - `requireInstagramFollow`: `boolean` (enabled by default)
  - `instagramTargetHandle`: `'@ArabianAcesofficial'`
  - `requireTwitterFollow`: `boolean` (**disabled by default**, toggleable by Super Admin)
  - `twitterTargetHandle`: `'@arabianacesT10'`
- If `requireTwitterFollow` is false, fans can log in directly without requiring X follow. If enabled by Super Admin, the X follow step activates seamlessly.

#### 4. Check-in & Single-Use Venue Offers Endpoints (`server/routes/fanclub.ts`)
- `POST /api/fanclub/checkin`: Validates fan QR payload / 6-character code, matches open T-90m window, awards +100 points, records check-in with the specific Fan Club Chapter ID and Admin ID.
- `GET /api/fanclub/my-status`: Returns the fan's QR code payload, open match status, active check-ins, and venue offers.
- `POST /api/fanclub/redeem-offer`: Marks venue offer as redeemed; strictly single-use per user.

---

### Frontend UI & Experience (`src/`)

#### 1. Instagram Onboarding Gateway (`src/components/InstagramFollowModal.tsx`)
- Shown on first visit: deep-links to Instagram app (`instagram://user?username=ArabianAcesofficial` with fallback).
- User enters their handle to confirm, gets +25 welcome points, and enters the app.

#### 2. Super Admin Settings: Social Gates & Fan Club Seeding (`src/pages/AdminPage.tsx`)
- **Social Gateways Tab**: Toggle switches for "Require Instagram Follow" and "Require X/Twitter Follow" with customizable target handles.
- **Fan Club Management Tab**: Table of all worldwide and Hyderabad fan clubs, search by city/location, add new fan club modal, and "Seed Official Fan Clubs" button.

#### 3. Matchday QR Code Card & Venue Offers (`src/components/FanClubCheckInCard.tsx`)
- Displays personalized high-contrast QR code and 6-character alphanumeric code.
- Dynamic indicator showing whether the **T-90 minutes matchday check-in window** is open.
- **Venue Offers Section**: Displays perks for the fan's local club/screening (e.g. "Free Hyderabad Fan Club Matchday Scarf", "BOGO Beverage at Banjara Hills Screening"). Redeemed offers switch to a permanent "Claimed" state.

#### 4. Dedicated Fan Club Admin Scanner Portal (`src/pages/FanClubAdminPage.tsx` at `/admin/fanclub`)
- **Station Selection**: Admin selects which Fan Club they are operating at (e.g. "Banjara Hills, Hyderabad" or "HITEC City, Hyderabad"). Locked for the match duration once selected.
- **Dual Scanner**:
  - Live device camera QR scanner with reticle and auto-detection.
  - Manual 6-character input fallback for rapid queue clearance.
- **Immediate Feedback**: Instant visual confirmation showing fan name, photo, fan club location, and +100 points confirmation.
- **Offer Punch Kiosk**: Allows the venue admin to validate and punch a fan's single-use offer.

---

## 3. Verification & Guardrails

1. **Compilation**: Run `compile_applet` and `lint_applet` to verify zero TypeScript errors.
2. **Super Admin Controls**: Verify Super Admin can toggle X/Twitter requirement on and off, and seed Hyderabad fan clubs.
3. **Check-In Validation**: Verify check-in operates during the 90-minute pre-match window, rejects double check-ins for the same fixture, and records the correct Hyderabad/global fan club.
4. **Offer Single-Use**: Ensure redeemed venue offers cannot be claimed twice.
5. **Responsive Layout**: Touch hitboxes $\ge 44\text{px}$, accessible contrast, and mobile-friendly camera scanning.
