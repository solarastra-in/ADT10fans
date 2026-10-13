import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { BattingScorecardEntry, BowlingScorecardEntry, InningsScorecard, MatchScorecard, Team } from '../../types';
import { Button, Field, Select, TextInput } from './ui';

/**
 * Enter the scorecard by hand (when no live-score feed is linked). Dream XI points are worked
 * out from it, so player names come from the squads and dismissals follow the usual format:
 * "c Fielder b Bowler", "b Bowler", "lbw b Bowler", "st Keeper b Bowler", "run out (Fielder)", "not out".
 */
const n = (v: string) => (v === '' ? 0 : Number(v) || 0);
const emptyInnings = (teamId: string): InningsScorecard => ({ teamId, totalRuns: 0, wickets: 0, overs: '', batting: [], bowling: [] });

function InningsEditor({ inn, onChange, batting, bowling }: { inn: InningsScorecard; onChange: (i: InningsScorecard) => void; batting: Team; bowling: Team }) {
  const setBat = (i: number, patch: Partial<BattingScorecardEntry>) => onChange({ ...inn, batting: inn.batting.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const setBowl = (i: number, patch: Partial<BowlingScorecardEntry>) => onChange({ ...inn, bowling: inn.bowling.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const batNames = batting.squad.map(p => p.name);
  const bowlNames = bowling.squad.map(p => p.name);
  return (
    <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
      <div className="grid grid-cols-3 gap-2">
        <Field label="Runs"><TextInput inputMode="numeric" value={String(inn.totalRuns || '')} onChange={e => onChange({ ...inn, totalRuns: n(e.target.value) })} /></Field>
        <Field label="Wickets"><TextInput inputMode="numeric" value={String(inn.wickets || '')} onChange={e => onChange({ ...inn, wickets: n(e.target.value) })} /></Field>
        <Field label="Overs"><TextInput inputMode="decimal" value={inn.overs} onChange={e => onChange({ ...inn, overs: e.target.value })} /></Field>
      </div>
      <p className="text-xs font-bold text-slate-300">{batting.name} batting</p>
      {inn.batting.map((b, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
          <div className="col-span-12 sm:col-span-4">
            <Select value={b.batsman} onChange={e => setBat(i, { batsman: e.target.value })} aria-label="Batter">
              <option value="">Batter…</option>
              {batNames.map(x => <option key={x} value={x}>{x}</option>)}
              {b.batsman && !batNames.includes(b.batsman) && <option value={b.batsman}>{b.batsman}</option>}
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-3"><TextInput placeholder="c X b Y / not out" value={b.dismissal} onChange={e => setBat(i, { dismissal: e.target.value, isNotOut: /not out/i.test(e.target.value) })} aria-label="Dismissal" /></div>
          <div className="col-span-2 sm:col-span-1"><TextInput inputMode="numeric" placeholder="R" value={String(b.runs ?? '')} onChange={e => setBat(i, { runs: n(e.target.value) })} aria-label="Runs" /></div>
          <div className="col-span-2 sm:col-span-1"><TextInput inputMode="numeric" placeholder="B" value={String(b.balls ?? '')} onChange={e => setBat(i, { balls: n(e.target.value) })} aria-label="Balls" /></div>
          <div className="col-span-2 sm:col-span-1"><TextInput inputMode="numeric" placeholder="4s" value={String(b.fours ?? '')} onChange={e => setBat(i, { fours: n(e.target.value) })} aria-label="Fours" /></div>
          <div className="col-span-2 sm:col-span-1"><TextInput inputMode="numeric" placeholder="6s" value={String(b.sixes ?? '')} onChange={e => setBat(i, { sixes: n(e.target.value) })} aria-label="Sixes" /></div>
          <div className="col-span-2 sm:col-span-1"><Button variant="ghost" onClick={() => onChange({ ...inn, batting: inn.batting.filter((_, j) => j !== i) })} aria-label="Remove batter"><Trash2 className="w-4 h-4" /></Button></div>
        </div>
      ))}
      <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => onChange({ ...inn, batting: [...inn.batting, { batsman: '', dismissal: '', runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0 }] })}>Add batter</Button>
      <p className="text-xs font-bold text-slate-300 pt-2">{bowling.name} bowling</p>
      {inn.bowling.map((b, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-end">
          <div className="col-span-12 sm:col-span-5">
            <Select value={b.bowler} onChange={e => setBowl(i, { bowler: e.target.value })} aria-label="Bowler">
              <option value="">Bowler…</option>
              {bowlNames.map(x => <option key={x} value={x}>{x}</option>)}
              {b.bowler && !bowlNames.includes(b.bowler) && <option value={b.bowler}>{b.bowler}</option>}
            </Select>
          </div>
          <div className="col-span-3 sm:col-span-2"><TextInput inputMode="decimal" placeholder="O" value={String(b.overs ?? '')} onChange={e => setBowl(i, { overs: e.target.value })} aria-label="Overs" /></div>
          <div className="col-span-2 sm:col-span-1"><TextInput inputMode="numeric" placeholder="M" value={String(b.maidens ?? '')} onChange={e => setBowl(i, { maidens: n(e.target.value) })} aria-label="Maidens" /></div>
          <div className="col-span-3 sm:col-span-2"><TextInput inputMode="numeric" placeholder="R" value={String(b.runs ?? '')} onChange={e => setBowl(i, { runs: n(e.target.value) })} aria-label="Runs conceded" /></div>
          <div className="col-span-2 sm:col-span-1"><TextInput inputMode="numeric" placeholder="W" value={String(b.wickets ?? '')} onChange={e => setBowl(i, { wickets: n(e.target.value) })} aria-label="Wickets" /></div>
          <div className="col-span-2 sm:col-span-1"><Button variant="ghost" onClick={() => onChange({ ...inn, bowling: inn.bowling.filter((_, j) => j !== i) })} aria-label="Remove bowler"><Trash2 className="w-4 h-4" /></Button></div>
        </div>
      ))}
      <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => onChange({ ...inn, bowling: [...inn.bowling, { bowler: '', overs: '', maidens: 0, runs: 0, wickets: 0, economy: 0 }] })}>Add bowler</Button>
    </div>
  );
}

export function ScorecardEditor({ value, onChange, teamA, teamB }: { value: MatchScorecard | undefined; onChange: (s: MatchScorecard) => void; teamA: Team; teamB: Team }) {
  const card = value || {};
  const first = card.innings1?.teamId === teamB.id ? teamB : teamA;
  const second = first.id === teamA.id ? teamB : teamA;
  const inn1 = card.innings1 || emptyInnings(first.id);
  const inn2 = card.innings2 || emptyInnings(second.id);
  const swap = () => onChange({ innings1: { ...inn2, teamId: second.id }, innings2: { ...inn1, teamId: first.id } });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">1st innings: {first.name}</p>
        <Button size="sm" variant="ghost" onClick={swap}>Swap batting order</Button>
      </div>
      <InningsEditor inn={{ ...inn1, teamId: first.id }} onChange={i => onChange({ innings1: i, innings2: { ...inn2, teamId: second.id } })} batting={first} bowling={second} />
      <p className="text-sm font-bold text-white">2nd innings: {second.name}</p>
      <InningsEditor inn={{ ...inn2, teamId: second.id }} onChange={i => onChange({ innings1: { ...inn1, teamId: first.id }, innings2: i })} batting={second} bowling={first} />
    </div>
  );
}
