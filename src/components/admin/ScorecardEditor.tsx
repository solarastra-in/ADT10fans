import React from 'react';
import { Download, Plus, Trash2, Upload } from 'lucide-react';
import type { BattingScorecardEntry, BowlingScorecardEntry, InningsScorecard, MatchScorecard, Team } from '../../types';
import { Button, Field, Select, TextInput } from './ui';

/**
 * Enter the scorecard by hand (when no live-score feed is linked). Pick XI points are worked
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

/**
 * CSV for a whole scorecard (one row per line, header first):
 *   innings,kind,name,dismissal,runs,balls,fours,sixes,overs,maidens,wickets
 *   kind "team": name = the batting team (id, short name or name); runs, overs, wickets = innings total
 *   kind "bat":  a batter: name, dismissal, runs, balls, fours, sixes
 *   kind "bowl": a bowler of the other team: name, overs, maidens, runs (conceded), wickets
 */
export const SCORECARD_CSV_HEADER = 'innings,kind,name,dismissal,runs,balls,fours,sixes,overs,maidens,wickets';

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cell); cell = ''; }
    else cell += ch;
  }
  out.push(cell);
  return out.map(c => c.trim());
}

export function scorecardFromCsv(text: string, teamA: Team, teamB: Team): { card: MatchScorecard; errors: string[] } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (!lines.length) return { card: {}, errors: ['The file is empty'] };
  const head = splitCsvLine(lines[0]).map(h => h.toLowerCase());
  const col = (row: string[], k: string) => row[head.indexOf(k)] ?? '';
  if (!head.includes('innings') || !head.includes('kind') || !head.includes('name')) return { card: {}, errors: [`The first line must be: ${SCORECARD_CSV_HEADER}`] };
  const teamOf = (name: string) => [teamA, teamB].find(t => [t.id, t.short, t.name].some(x => x && x.toLowerCase() === name.toLowerCase()));
  const inns: Record<1 | 2, InningsScorecard> = { 1: emptyInnings(''), 2: emptyInnings('') };
  lines.slice(1).forEach((line, i) => {
    const row = splitCsvLine(line);
    const k = Number(col(row, 'innings')) === 2 ? 2 : Number(col(row, 'innings')) === 1 ? 1 : 0;
    if (!k) return errors.push(`Line ${i + 2}: innings must be 1 or 2`);
    const kind = col(row, 'kind').toLowerCase();
    const name = col(row, 'name');
    const inn = inns[k as 1 | 2];
    if (kind === 'team') {
      const t = teamOf(name);
      if (!t) return errors.push(`Line ${i + 2}: unknown team "${name}"`);
      inn.teamId = t.id;
      inn.totalRuns = n(col(row, 'runs'));
      inn.wickets = n(col(row, 'wickets'));
      inn.overs = col(row, 'overs');
    } else if (kind === 'bat') {
      if (!name) return errors.push(`Line ${i + 2}: batter name missing`);
      const runs = n(col(row, 'runs'));
      const balls = n(col(row, 'balls'));
      const dismissal = col(row, 'dismissal') || 'not out';
      inn.batting.push({ batsman: name, dismissal, runs, balls, fours: n(col(row, 'fours')), sixes: n(col(row, 'sixes')), strikeRate: balls ? Math.round((runs / balls) * 1000) / 10 : 0, isNotOut: /not out/i.test(dismissal) });
    } else if (kind === 'bowl') {
      if (!name) return errors.push(`Line ${i + 2}: bowler name missing`);
      inn.bowling.push({ bowler: name, overs: col(row, 'overs'), maidens: n(col(row, 'maidens')), runs: n(col(row, 'runs')), wickets: n(col(row, 'wickets')), economy: 0 });
    } else errors.push(`Line ${i + 2}: kind must be team, bat or bowl`);
  });
  // An innings without a team row: the other team of the one given, or the default order.
  if (!inns[1].teamId) inns[1].teamId = inns[2].teamId ? (inns[2].teamId === teamA.id ? teamB.id : teamA.id) : teamA.id;
  if (!inns[2].teamId) inns[2].teamId = inns[1].teamId === teamA.id ? teamB.id : teamA.id;
  return { card: { innings1: inns[1], innings2: inns[2] }, errors };
}

export function scorecardCsvTemplate(teamA: Team, teamB: Team): string {
  const a = teamA.squad.slice(0, 2).map(p => p.name);
  const b = teamB.squad.slice(0, 2).map(p => p.name);
  return [
    SCORECARD_CSV_HEADER,
    `1,team,${teamA.short || teamA.id},,120,,,,10,,4`,
    `1,bat,${a[0] || 'Batter one'},c ${b[0] || 'Fielder'} b ${b[1] || 'Bowler'},45,22,4,3,,,`,
    `1,bat,${a[1] || 'Batter two'},not out,30,18,2,1,,,`,
    `1,bowl,${b[1] || 'Bowler'},,,,,,2,0,18,1`,
    `2,team,${teamB.short || teamB.id},,110,,,,10,,6`,
    `2,bat,${b[0] || 'Batter three'},run out (${a[0] || 'Fielder'}),25,15,2,1,,,`,
    `2,bowl,${a[1] || 'Bowler two'},,,,,,2,1,9,3`,
  ].join('\n');
}

function CsvTools({ teamA, teamB, onLoad }: { teamA: Team; teamB: Team; onLoad: (c: MatchScorecard, errors: string[]) => void }) {
  const read = (file: File | undefined) => {
    if (!file) return;
    file.text().then(text => {
      const r = scorecardFromCsv(text, teamA, teamB);
      onLoad(r.card, r.errors);
    });
  };
  const download = () => {
    const blob = new Blob([scorecardCsvTemplate(teamA, teamB)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `scorecard-${teamA.id}-v-${teamB.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 cursor-pointer">
        <Upload className="w-4 h-4" /> Upload CSV
        <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={e => { read(e.target.files?.[0]); e.target.value = ''; }} data-testid="scorecard-csv" />
      </label>
      <Button size="sm" variant="ghost" icon={<Download className="w-4 h-4" />} onClick={download}>CSV template</Button>
    </div>
  );
}

export function ScorecardEditor({ value, onChange, teamA, teamB, onCsvErrors }: { value: MatchScorecard | undefined; onChange: (s: MatchScorecard) => void; teamA: Team; teamB: Team; onCsvErrors?: (errors: string[]) => void }) {
  const card = value || {};
  const first = card.innings1?.teamId === teamB.id ? teamB : teamA;
  const second = first.id === teamA.id ? teamB : teamA;
  const inn1 = card.innings1 || emptyInnings(first.id);
  const inn2 = card.innings2 || emptyInnings(second.id);
  const swap = () => onChange({ innings1: { ...inn2, teamId: second.id }, innings2: { ...inn1, teamId: first.id } });
  return (
    <div className="space-y-3">
      <CsvTools teamA={teamA} teamB={teamB} onLoad={(c, errors) => { onChange(c); onCsvErrors?.(errors); }} />
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
