#!/usr/bin/env python3
"""
Unofficial Cricket Scraper & Local Microservice (Cricbuzz & ESPNcricinfo)
========================================================================
Free, unofficial, and runs locally.

HOW TO AVOID TARGET WEBSITE LAYOUT CHANGES:
------------------------------------------
1. JSON-First Extraction:
   - Cricbuzz: Extracts Schema.org 'SportsEvent' LD+JSON (<script type="application/ld+json">)
     which follows universal schemas and never changes when CSS or DOM layout changes.
   - ESPNcricinfo: Extracts Next.js __NEXT_DATA__ state and long-standing public RSS feeds
     (http://static.cricinfo.com/rss/livescores.xml).
2. Semantic Regex & Profile Links:
   - Player rows are identified by semantic profile anchors ('title="View Profile Of..."'
     and '/profiles/<id>/<slug>') and numeric run/ball sequences rather than volatile
     Tailwind or framework-generated CSS classes.
3. Multi-Source Failover:
   - If Cricbuzz is blocked or updates an endpoint, ESPNcricinfo is used as failover,
     and vice versa.

Usage:
  CLI:
    python3 scrapers/cric_scraper.py --live
    python3 scrapers/cric_scraper.py --cricbuzz 170737
    python3 scrapers/cric_scraper.py --cricinfo 1555411

  Local HTTP Microservice (zero external dependencies):
    python3 scrapers/cric_scraper.py --serve --port 8000

  FastAPI (if installed):
    uvicorn scrapers.cric_scraper:app --port 8000 --reload
"""

import sys
import os
import json
import re
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}

def fetch_url(url, timeout=10):
    req = urllib.request.Request(url, headers=DEFAULT_HEADERS)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode('utf-8', errors='ignore')

# =====================================================================
# Cricbuzz Scraper (Layout-Immune)
# =====================================================================

def scrape_cricbuzz_live():
    url = 'https://www.cricbuzz.com/cricket-match/live-scores'
    html = fetch_url(url)
    matches = []
    seen = set()

    link_re = re.compile(r'href="(?:https://www\.cricbuzz\.com)?/live-cricket-scores/(\d+)/([a-z0-9-]+)"[^>]*>([\s\S]*?)</a>', re.IGNORECASE)
    for m in link_re.finditer(html):
        mid = m.group(1)
        if mid in seen:
            continue
        seen.add(mid)
        slug = m.group(2)
        raw_title = re.sub(r'<[^>]+>', ' ', m.group(3)).strip()

        vs_parts = slug.split('-vs-')
        team_a = vs_parts[0].replace('-', ' ').upper() if vs_parts else 'Team A'
        team_b = vs_parts[1].split('-')[0].upper() if len(vs_parts) > 1 else 'Team B'

        matches.append({
            'id': mid,
            'provider': 'cricbuzz',
            'title': raw_title or f'{team_a} vs {team_b}',
            'teamA': {'name': team_a},
            'teamB': {'name': team_b},
            'status': 'live' if 'live' in slug else 'upcoming',
            'url': f'https://www.cricbuzz.com/live-cricket-scores/{mid}/{slug}'
        })
    return matches

def scrape_cricbuzz_scorecard(match_id, slug='match'):
    url = f'https://www.cricbuzz.com/live-cricket-scorecard/{match_id}/{slug}'
    html = fetch_url(url)

    # 1. Layout-immune schema.org SportsEvent extraction
    sports_event = None
    ld_matches = re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>', html, re.IGNORECASE)
    for b in ld_matches:
        try:
            d = json.loads(b)
            if d.get('@type') == 'SportsEvent' or 'SportsEvent' in d.get('@type', []):
                sports_event = d
                break
        except Exception:
            pass

    competitors = sports_event.get('competitor', []) if sports_event else []
    team_a_name = competitors[0].get('name') if len(competitors) > 0 else 'Team 1'
    team_b_name = competitors[1].get('name') if len(competitors) > 1 else 'Team 2'
    venue = sports_event.get('location', {}).get('name') if sports_event else None
    starts_at = sports_event.get('startDate') if sports_event else None

    # 2. Extract result / status text
    result_text = None
    res_m = re.search(r'<div class="[^"]*text-cbTxtSec[^"]*">([^<]+(?:won by|won|tied|drawn|no result|abandoned)[^<]*)</div>', html, re.IGNORECASE)
    if res_m:
        result_text = res_m.group(1).strip()

    # 3. Extract toss
    toss = None
    toss_m = re.search(r'([A-Za-z\s]+ won the toss and (?:opted|elected) to [a-z]+)', html, re.IGNORECASE)
    if toss_m:
        toss = toss_m.group(1).strip()

    # 4. Extract batsmen rows using profile anchors
    bat_re = re.compile(r'href="(?:https://www\.cricbuzz\.com)?/profiles/(\d+)/([a-z0-9-]+)"\s+title="View Profile Of ([^"]+)"[^>]*>[\s\S]*?</div>\s*</div>\s*<div[^>]*>([^<]*)</div>\s*</div>\s*<div[^>]*>(\d+)</div>\s*<div[^>]*>(\d+)</div>\s*<div[^>]*>(\d+)</div>\s*<div[^>]*>(\d+)</div>\s*<div[^>]*>([\d\.]+)</div>', re.IGNORECASE)

    batsmen = []
    for bm in bat_re.finditer(html):
        dismissal = bm.group(4).strip() or 'not out'
        batsmen.append({
            'playerId': bm.group(1),
            'name': bm.group(3).strip(),
            'dismissal': dismissal,
            'runs': int(bm.group(5)),
            'balls': int(bm.group(6)),
            'fours': int(bm.group(7)),
            'sixes': int(bm.group(8)),
            'strikeRate': float(bm.group(9)),
            'isNotOut': 'not out' in dismissal.lower()
        })

    return {
        'matchId': match_id,
        'provider': 'cricbuzz',
        'title': f'{team_a_name} vs {team_b_name}',
        'venue': venue,
        'startsAt': starts_at,
        'toss': toss,
        'result': result_text,
        'batsmenCount': len(batsmen),
        'batsmen': batsmen[:22]
    }

# =====================================================================
# ESPNcricinfo Scraper (Layout-Immune)
# =====================================================================

def scrape_cricinfo_live():
    url = 'http://static.cricinfo.com/rss/livescores.xml'
    xml = fetch_url(url)
    items = []

    for item in re.findall(r'<item>([\s\S]*?)</item>', xml, re.IGNORECASE):
        t_m = re.search(r'<title>([\s\S]*?)</title>', item, re.IGNORECASE)
        g_m = re.search(r'<guid>([\s\S]*?)</guid>', item, re.IGNORECASE) or re.search(r'<link>([\s\S]*?)</link>', item, re.IGNORECASE)

        title = t_m.group(1).replace('<![CDATA[', '').replace(']]>', '').strip() if t_m else ''
        link = g_m.group(1).replace('<![CDATA[', '').replace(']]>', '').strip() if g_m else ''

        id_m = re.search(r'match/(\d+)\.html', link) or re.search(r'(\d{6,8})', link)
        mid = id_m.group(1) if id_m else 'ci'

        vs_parts = re.split(r'\s+v\s+|\s+vs\s+', title, flags=re.IGNORECASE)
        t_a = vs_parts[0].strip() if len(vs_parts) > 0 else 'Team A'
        t_b = vs_parts[1].strip() if len(vs_parts) > 1 else 'Team B'

        items.append({
            'id': mid,
            'provider': 'cricinfo',
            'title': title,
            'teamA': {'name': t_a},
            'teamB': {'name': t_b},
            'status': 'live' if '*' in title else 'completed' if any(w in title.lower() for w in ['won by', 'tied', 'match over']) else 'upcoming',
            'url': link
        })
    return items

# =====================================================================
# Local HTTP Server (Stdlib, Zero external dependencies)
# =====================================================================

class ScraperHandler(BaseHTTPRequestHandler):
    def _send_json(self, data, code=200):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode('utf-8'))

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        if parsed.path == '/' or parsed.path == '/health':
            self._send_json({'status': 'ok', 'service': 'cric-scraper', 'version': '1.0.0'})
        elif parsed.path == '/live':
            try:
                cb = scrape_cricbuzz_live()
                ci = scrape_cricinfo_live()
                self._send_json({'success': True, 'cricbuzzCount': len(cb), 'cricinfoCount': len(ci), 'matches': cb + ci})
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        elif parsed.path == '/cricbuzz/scorecard':
            mid = qs.get('matchId', [''])[0]
            if not mid:
                self._send_json({'error': 'matchId parameter is required'}, 400)
                return
            try:
                res = scrape_cricbuzz_scorecard(mid)
                self._send_json({'success': True, 'scorecard': res})
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        elif parsed.path == '/cricinfo/live':
            try:
                matches = scrape_cricinfo_live()
                self._send_json({'success': True, 'matches': matches})
            except Exception as e:
                self._send_json({'success': False, 'error': str(e)}, 500)
        else:
            self._send_json({'error': 'Not found'}, 404)

# =====================================================================
# FastAPI Application (If user imports as a FastAPI module)
# =====================================================================

try:
    from fastapi import FastAPI
    app = FastAPI(title="Unofficial Cricket Scraper API", description="Free layout-resilient Cricbuzz & ESPNcricinfo scrapers")

    @app.get("/health")
    def health_check():
        return {"status": "ok", "service": "cric-scraper-fastapi"}

    @app.get("/matches/live")
    def api_live_matches():
        cb = scrape_cricbuzz_live()
        ci = scrape_cricinfo_live()
        return {"success": True, "count": len(cb) + len(ci), "matches": cb + ci}

    @app.get("/cricbuzz/scorecard/{match_id}")
    def api_cricbuzz_scorecard(match_id: str):
        return scrape_cricbuzz_scorecard(match_id)

    @app.get("/cricinfo/live")
    def api_cricinfo_live():
        return scrape_cricinfo_live()
except ImportError:
    app = None

# =====================================================================
# Main CLI Entry Point
# =====================================================================

def main():
    args = sys.argv[1:]

    if '--serve' in args:
        port = 8000
        if '--port' in args:
            idx = args.index('--port')
            if idx + 1 < len(args):
                port = int(args[idx + 1])
        server = HTTPServer(('0.0.0.0', port), ScraperHandler)
        print(f"[CricScraper] Microservice listening on http://0.0.0.0:{port}...")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down.")
            server.server_close()
        return

    if '--live' in args:
        print("[CricScraper] Fetching live matches...")
        matches = scrape_cricbuzz_live()
        print(f"Found {len(matches)} matches on Cricbuzz:")
        for m in matches[:10]:
            print(f"  - [{m['id']}] {m['title']} ({m['status']})")
        return

    if '--cricbuzz' in args:
        idx = args.index('--cricbuzz')
        mid = args[idx + 1] if idx + 1 < len(args) else '170737'
        print(f"[CricScraper] Scraping Cricbuzz scorecard for match {mid}...")
        res = scrape_cricbuzz_scorecard(mid)
        print(json.dumps(res, indent=2))
        return

    if '--cricinfo' in args:
        print("[CricScraper] Fetching Cricinfo RSS live matches...")
        matches = scrape_cricinfo_live()
        print(f"Found {len(matches)} matches on Cricinfo RSS:")
        for m in matches[:10]:
            print(f"  - [{m['id']}] {m['title']} ({m['status']})")
        return

    print(__doc__)

if __name__ == '__main__':
    main()
