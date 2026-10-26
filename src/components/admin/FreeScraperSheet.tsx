import React, { useState, useEffect } from 'react';
import { Bot, RefreshCw, CheckCircle2, AlertCircle, Link2, ExternalLink, Terminal, Play, Zap, ShieldCheck } from 'lucide-react';
import { api } from '../../api';
import type { Match, Team } from '../../types';
import { Button, Card, Chip, Field, Notice, Select, Sheet, TextInput } from './ui';
import { teamName } from './shared';

interface FreeScraperSheetProps {
  open: boolean;
  onClose: () => void;
  matches: Match[];
  teams: Team[];
  onRefreshAll: () => Promise<void>;
}

export const FreeScraperSheet: React.FC<FreeScraperSheetProps> = ({
  open,
  onClose,
  matches,
  teams,
  onRefreshAll,
}) => {
  const [loading, setLoading] = useState(false);
  const [liveData, setLiveData] = useState<{ count: number; sources: string[]; matches: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncTargetMatchId, setSyncTargetMatchId] = useState<string>('');
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);

  // Test URL/ID tab state
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const fetchLiveFeeds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getScraperLiveMatches();
      setLiveData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch live scraper feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLiveFeeds();
    }
  }, [open]);

  const handleSyncMatch = async (scrapedMatch: any) => {
    if (!syncTargetMatchId) {
      alert('Please select a local fixture to sync this match into.');
      return;
    }
    const targetMatch = matches.find(m => m.id === syncTargetMatchId);
    if (!targetMatch) return;

    setSyncingId(scrapedMatch.id);
    setSyncSuccess(null);
    setError(null);
    try {
      const res = await api.syncMatchFromScraper(syncTargetMatchId, {
        provider: scrapedMatch.provider || 'cricbuzz',
        externalId: String(scrapedMatch.id),
      });
      setSyncSuccess(res.message);
      await onRefreshAll();
    } catch (err: any) {
      setError(err?.message || 'Sync failed.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleTestScraper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim()) return;
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const isUrl = testInput.startsWith('http://') || testInput.startsWith('https://');
      const res = await api.testScraper(isUrl ? { url: testInput.trim() } : { matchId: testInput.trim() });
      setTestResult(res);
    } catch (err: any) {
      setTestError(err?.message || 'Scraper test failed.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Sheet
      open={open}
      title="Free Live Scraper (Cricbuzz & Cricinfo)"
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="space-y-6">
        {/* Layout-immune explanation banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-amber-950/30 border border-emerald-500/30 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Layout-Immune Unofficial Scraper
          </div>
          <p>
            Unlike brittle HTML scrapers that crash whenever a website updates CSS classes, this scraper targets
            <b> Schema.org SportsEvent LD+JSON</b>, Next.js state blobs (<b>__NEXT_DATA__</b>), and standard RSS feeds.
            It works 100% free with zero API keys required.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Chip tone="green">Cricbuzz Schema.org</Chip>
            <Chip tone="blue">ESPNcricinfo RSS & JSON</Chip>
            <Chip tone="purple">Auto-Scoring & Pick XI</Chip>
            <Chip tone="amber">Local Python & TS Engine</Chip>
          </div>
        </div>

        {error && <Notice notice={{ kind: 'err', text: error }} onClose={() => setError(null)} />}
        {syncSuccess && <Notice notice={{ kind: 'ok', text: syncSuccess }} onClose={() => setSyncSuccess(null)} />}

        {/* Target Local Fixture Selector */}
        <Card className="p-4 space-y-3 bg-slate-950 border-slate-800">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-400" /> Select Local Fixture to Link / Sync
            </h4>
          </div>
          <Select
            value={syncTargetMatchId}
            onChange={e => setSyncTargetMatchId(e.target.value)}
          >
            <option value="">Choose a match fixture to update...</option>
            {matches.map(m => (
              <option key={m.id} value={m.id}>
                Match #{m.matchNo}: {teamName(teams, m.teamA)} vs {teamName(teams, m.teamB)} ({m.status.toUpperCase()})
              </option>
            ))}
          </Select>
          <p className="text-[11px] text-slate-400">
            Select the match fixture above, then click <b>"Sync Into Selected Match"</b> on any live match below to update scores, wickets, overs, and Pick XI points.
          </p>
        </Card>

        {/* Live Matches List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-400" /> Active Scraped Matches ({liveData?.count || 0})
              </h3>
              <p className="text-xs text-slate-400">Live feeds cached for 15s to prevent site rate limits</p>
            </div>
            <Button
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
              loading={loading}
              onClick={fetchLiveFeeds}
            >
              Refresh Feeds
            </Button>
          </div>

          {loading && !liveData && (
            <div className="py-8 text-center text-sm text-slate-400 animate-pulse">
              Scraping latest live matches from Cricbuzz and Cricinfo...
            </div>
          )}

          {liveData && liveData.matches.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
              No live cricket matches detected right now. Check back when Abu Dhabi T10 fixtures or international matches are in play.
            </div>
          )}

          {liveData && liveData.matches.length > 0 && (
            <div className="grid grid-cols-1 gap-3 max-h-[360px] overflow-y-auto pr-1">
              {liveData.matches.map((item: any, idx: number) => {
                const isSelected = syncingId === item.id;
                return (
                  <Card key={`${item.provider}-${item.id || idx}`} className="p-3.5 bg-slate-900/80 border-slate-800 hover:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Chip tone={item.status === 'live' ? 'red' : item.status === 'completed' ? 'green' : 'amber'}>
                          {item.status.toUpperCase()}
                        </Chip>
                        <Chip tone={item.provider === 'cricbuzz' ? 'green' : 'blue'}>
                          {item.provider}
                        </Chip>
                        {item.seriesName && (
                          <span className="text-[11px] text-slate-400 truncate max-w-[200px]" title={item.seriesName}>
                            {item.seriesName}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">ID: {item.id}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">
                          {item.teamA} <span className="text-slate-500 font-normal">vs</span> {item.teamB}
                        </div>
                        {(item.scoreA || item.scoreB) && (
                          <div className="text-xs font-mono text-amber-400 mt-0.5">
                            {item.teamA}: {item.scoreA || '—'} {item.oversA ? `(${item.oversA} ov)` : ''} · {item.teamB}: {item.scoreB || '—'} {item.oversB ? `(${item.oversB} ov)` : ''}
                          </div>
                        )}
                        {item.statusText && (
                          <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">{item.statusText}</p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Zap className="w-3.5 h-3.5" />}
                        loading={isSelected}
                        disabled={!syncTargetMatchId || !!syncingId}
                        onClick={() => handleSyncMatch(item)}
                      >
                        Sync Match
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Test Scraper URL / Match ID */}
        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div>
            <h4 className="font-extrabold text-white text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" /> Test Scraper (URL or Match ID)
            </h4>
            <p className="text-xs text-slate-400">
              Paste any Cricbuzz match URL (e.g. <code>https://www.cricbuzz.com/live-cricket-scores/105423/...</code>) or Cricinfo URL to verify data extraction.
            </p>
          </div>

          <form onSubmit={handleTestScraper} className="flex gap-2">
            <TextInput
              placeholder="e.g. 105423 or https://www.cricbuzz.com/live-cricket-scores/..."
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              icon={<Play className="w-3.5 h-3.5" />}
              loading={testing}
              disabled={!testInput.trim()}
            >
              Test
            </Button>
          </form>

          {testError && <p className="text-xs text-rose-400">{testError}</p>}

          {testResult && (
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" /> Parsed via {testResult.provider} (Innings: {testResult.inningsCount})
              </div>
              <pre className="max-h-48 overflow-y-auto font-mono text-[11px] p-2 bg-slate-900 rounded-lg text-slate-300">
                {JSON.stringify({ summary: testResult.summary, scorecard: testResult.scorecard }, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Python Local Microservice Info */}
        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <Terminal className="w-4 h-4 text-amber-400" /> Run Standalone Python Scraper Locally
          </div>
          <p className="text-slate-400">
            A standalone zero-dependency Python script is available at <code>scrapers/cric_scraper.py</code>.
            It uses pure standard library (no pip packages needed) with an optional FastAPI wrapper:
          </p>
          <div className="font-mono text-[11px] p-2 bg-slate-900 text-amber-300 rounded border border-slate-800 space-y-1">
            <div># CLI live matches</div>
            <div className="text-slate-200">python3 scrapers/cric_scraper.py --live</div>
            <div className="pt-1"># Local HTTP microservice on port 8000</div>
            <div className="text-slate-200">python3 scrapers/cric_scraper.py --serve --port 8000</div>
          </div>
        </div>
      </div>
    </Sheet>
  );
};
