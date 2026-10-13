import React, { useEffect, useState } from 'react';
import { RefreshCw, Trophy } from 'lucide-react';
import { api } from '../../api';
import type { FantasyMatchSummary, LeaderRow, Match, Team } from '../../types';
import { Button, Card, Chip, EmptyState, Notice, SectionHeader, useRunner } from './ui';

/** Dream XI overview: lineups per match, re-scoring after a scorecard correction, top scores. */
export const FantasySection: React.FC<{ matches: Match[]; teams: Team[] }> = ({ teams }) => {
  const [rows, setRows] = useState<FantasyMatchSummary[]>([]);
  const [board, setBoard] = useState<Record<string, LeaderRow[]>>({});
  const { busy, notice, setNotice, run } = useRunner();
  const name = (id: string) => teams.find(t => t.id === id)?.short || id;
  const load = async () => {
    const r = await api.getFantasyHub().catch(e => {
      setNotice({ kind: 'err', text: e.message });
      return null;
    });
    if (r) setRows(r.matches);
  };
  useEffect(() => {
    load();
  }, []);
  const rescore = async (m: FantasyMatchSummary) => {
    const r = await run(`score:${m.matchId}`, () => api.rescoreFantasy(m.matchId));
    if (r) {
      setNotice({ kind: r.unmatchedNames.length ? 'warn' : 'ok', text: `${r.scored} lineup(s) scored for match ${m.matchNo}. Top score ${r.topScore}.`, details: r.unmatchedNames.length ? [`Scorecard names not matched to a squad player (fix the spelling in the scorecard or squad, then re-score): ${r.unmatchedNames.join(', ')}`] : undefined });
      load();
      showBoard(m.matchId);
    }
  };
  const showBoard = async (matchId: string) => {
    const r = await api.getFantasyLeaderboard(matchId);
    setBoard(b => ({ ...b, [matchId]: r.rows.slice(0, 10) }));
  };
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Dream XI"
        description="Lineups lock at each match's start time. When a match is saved as completed with a scorecard, every lineup is scored automatically and fans get a personal result notification. Re-score here after correcting a scorecard; points are adjusted, not added twice."
        actions={<Button size="sm" onClick={load} icon={<RefreshCw className="w-4 h-4" />}>Refresh</Button>}
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {rows.length === 0 ? (
        <EmptyState title="No fixtures yet" description="Dream XI opens for each match as soon as it is added in Matches." />
      ) : (
        <div className="space-y-2">
          {rows.map(m => (
            <Card key={m.matchId}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-white">Match {m.matchNo}: {name(m.teamA)} v {name(m.teamB)}</span>
                <Chip tone={m.status === 'completed' ? 'blue' : m.locked ? 'amber' : 'green'}>{m.status === 'completed' ? 'completed' : m.locked ? 'locked' : 'open'}</Chip>
                <Chip>{m.lineups} lineups</Chip>
                <span className="text-xs text-slate-400">{new Date(m.startsAt).toLocaleString()}</span>
                <span className="ms-auto flex gap-2">
                  {m.lineups > 0 && <Button size="sm" onClick={() => showBoard(m.matchId)} icon={<Trophy className="w-4 h-4" />}>Top scores</Button>}
                  {m.status === 'completed' && <Button size="sm" variant="primary" loading={busy === `score:${m.matchId}`} onClick={() => rescore(m)}>Re-score</Button>}
                </span>
              </div>
              {board[m.matchId] && (
                <ol className="mt-3 space-y-1 text-sm">
                  {board[m.matchId].length === 0 ? <li className="text-slate-400">Not scored yet.</li> : board[m.matchId].map(r => (
                    <li key={r.userId} className="flex justify-between gap-2"><span className="text-slate-200">#{r.rank} {r.name}</span><span className="font-mono text-amber-300">{r.points}</span></li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
