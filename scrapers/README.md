# Unofficial Cricket Scrapers (Cricbuzz & ESPNcricinfo)

This directory provides free, unofficial scrapers and a local microservice wrapper for live cricket scores, detailed scorecards, and squad rosters from **Cricbuzz** and **ESPNcricinfo**.

---

## 🛡️ How Layout Changes Are Prevented

Scrapers that rely on CSS classes (e.g., `.ds-text-compact-xxs` or `.cb-col-100`) break whenever a website undergoes design updates, CSS framework refactors, or responsive layout changes.

This solution avoids layout breaks through **four distinct architectural layers**:

1. **Schema.org Structured Data (`SportsEvent` LD+JSON)**:
   - Cricbuzz embeds standard `application/ld+json` blocks representing the schema.org `SportsEvent` contract.
   - This data is read by search engine crawlers and follows a strict international schema containing competitor teams, venue, start time, and event status.
   - **Result**: HTML/CSS restyling has zero impact on this payload.

2. **Next.js Pre-rendered State (`__NEXT_DATA__`)**:
   - ESPNcricinfo is built with Next.js. Every match page ships an embedded `<script id="__NEXT_DATA__" type="application/json">` containing the server-rendered application state.
   - This object contains the raw `match` and `scorecard` models delivered directly from ESPN's backend services before HTML template rendering.
   - **Result**: DOM element renames, tag replacements, and styling overhauls do not affect the underlying state object.

3. **15-Year Stable Public Feeds**:
   - ESPNcricinfo maintains legacy XML livescore feeds (such as `http://static.cricinfo.com/rss/livescores.xml`) that have retained the exact same XML element structure for over 15 years.

4. **Semantic Profile Anchors & Numeric Sequence Parsing**:
   - For scorecard tables, player rows are discovered using universal profile hyperlinks:
     `href="/profiles/<id>/<slug>"` with `title="View Profile Of <name>"`
   - Runs, balls, 4s, 6s, and strike rates are parsed as strict numeric sequences rather than fragile class names.

5. **Automatic Multi-Source Failover**:
   - If Cricbuzz updates a URL pattern or temporarily throttles requests, the scraper automatically falls back to ESPNcricinfo, and vice versa.

---

## 🚀 Running the Python Scraper Locally

The Python scraper (`cric_scraper.py`) requires **only Python 3 standard library** (no `pip install` required for basic use).

### 1. CLI Commands

```bash
# Fetch all currently live and recent matches across Cricbuzz
python3 scrapers/cric_scraper.py --live

# Fetch live matches from ESPNcricinfo
python3 scrapers/cric_scraper.py --cricinfo

# Fetch full scorecard for a specific Cricbuzz match ID
python3 scrapers/cric_scraper.py --cricbuzz 170737
```

### 2. Standalone HTTP Microservice (Port 8000)

Start the local server with:

```bash
python3 scrapers/cric_scraper.py --serve --port 8000
```

Available endpoints:
- `GET http://localhost:8000/live` - Returns all live matches
- `GET http://localhost:8000/cricbuzz/scorecard?matchId=170737` - Returns full scorecard
- `GET http://localhost:8000/cricinfo/live` - Returns Cricinfo live scores

### 3. FastAPI Wrapper (Optional)

If `fastapi` and `uvicorn` are installed in your environment:

```bash
pip install fastapi uvicorn
uvicorn scrapers.cric_scraper:app --port 8000 --reload
```

---

## ⚡ Integrated TypeScript Scraper

The application also includes a native TypeScript scraper integrated directly into the Node.js server (`server/scrapers/`), providing:

- `GET /api/scraper/live` - Live matches from Cricbuzz + Cricinfo
- `GET /api/scraper/match/:provider/:id` - Full match scorecard
- `POST /api/scraper/sync/:matchId` - 1-Click sync into Abu Dhabi T10 fixtures, automatically updating match scorecards and Pick XI fantasy points!
- `POST /api/scraper/test` - Test any Cricbuzz or Cricinfo match URL
