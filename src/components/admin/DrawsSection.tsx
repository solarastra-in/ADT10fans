import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Users, Shuffle } from 'lucide-react';
import { PrizeDraw, Team } from '../../types';
import { api } from '../../api';
import {
  Actions,
  Button,
  Card,
  Chip,
  EmptyState,
  Errors,
  Field,
  Notice,
  SectionHeader,
  Select,
  Sheet,
  TextArea,
  TextInput,
  formatDateTime,
  fromLocalInput,
  statusTone,
  toLocalInput,
  useRunner,
} from './ui';
import { teamName } from './shared';

type Draft = { id?: string; title: string; prize: string; description: string; closesAt: string; teamOnly: string; color: string; status: PrizeDraw['status'] };
const HEX = /^#[0-9a-fA-F]{6}$/;

export const DrawsSection: React.FC<{ draws: PrizeDraw[]; teams: Team[]; onRefreshAll: () => Promise<void> }> = ({ draws, teams, onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [entrants, setEntrants] = useState<{ draw: PrizeDraw; entries: { userName: string; userEmail: string; createdAt: string }[] } | null>(null);
  const [lastResult, setLastResult] = useState<Record<string, PrizeDraw>>({});

  const openNew = () => {
    setErrors({});
    setDraft({ title: '', prize: '', description: '', closesAt: '', teamOnly: '', color: '#f59e0b', status: 'open' });
  };

  const openEdit = (d: PrizeDraw) => {
    setErrors({});
    setDraft({
      id: d.id,
      title: d.title || '',
      prize: d.prize || '',
      description: d.description || '',
      closesAt: toLocalInput(d.closesAt),
      teamOnly: d.teamOnly || '',
      color: HEX.test(d.color || '') ? d.color : '#f59e0b',
      status: d.status,
    });
  };

  const save = async () => {
    if (!draft) return;
    const e: Errors = {};
    if (!draft.title.trim()) e.title = 'Title is required.';
    if (!draft.prize.trim()) e.prize = 'Describe the actual prize.';
    if (!draft.closesAt || !fromLocalInput(draft.closesAt)) e.closesAt = 'Closing date and time are required.';
    if (!HEX.test(draft.color)) e.color = 'Use #RRGGBB.';
    setErrors(e);
    if (Object.keys(e).length) return;
    const res = await run(
      'save',
      () =>
        api.saveDraw({
          id: draft.id,
          title: draft.title.trim(),
          prize: draft.prize.trim(),
          description: draft.description.trim(),
          closesAt: fromLocalInput(draft.closesAt),
          teamOnly: draft.teamOnly || null,
          color: draft.color,
          ...(draft.id ? { status: draft.status } : { status: 'open' as const }),
        }),
      'Draw saved.'
    );
    if (res) {
      setDraft(null);
      await onRefreshAll();
    }
  };

  const remove = async (d: PrizeDraw) => {
    if (!window.confirm(`Delete "${d.title}" and all its entries?`)) return;
    const res = await run(`del:${d.id}`, () => api.deleteDraw(d.id), 'Draw deleted.');
    if (res) await onRefreshAll();
  };

  const viewEntrants = async (d: PrizeDraw) => {
    const res = await run(`ent:${d.id}`, () => api.getDrawEntries(d.id));
    if (res) setEntrants({ draw: d, entries: res.entries || [] });
  };

  const execute = async (d: PrizeDraw) => {
    if (!window.confirm(`Draw a winner for "${d.title}" now? This closes the draw and cannot be undone.`)) return;
    const res = await run(`exec:${d.id}`, () => api.executeDraw(d.id));
    if (!res) return;
    setLastResult(prev => ({ ...prev, [d.id]: res.draw }));
    setNotice({
      kind: 'ok',
      text: `Winner: ${res.draw?.winnerName || res.winner?.name || res.winner?.userName || 'recorded'}`,
    });
    await onRefreshAll();
  };

  const sorted = [...draws].sort((a, b) => new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime());

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Prize draws"
        description="Winners are picked by the server; the seed and entrants hash are published after drawing."
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openNew}>
            New draw
          </Button>
        }
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />

      {sorted.length === 0 ? (
        <EmptyState title="No draws yet" description="Create a draw when you have a real prize to give away." />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {sorted.map(raw => {
            const d = { ...raw, ...(lastResult[raw.id] || {}) };
            return (
              <li key={d.id}>
                <Card className="flex flex-col gap-2 h-full" >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color || '#f59e0b' }} aria-hidden="true" />
                    <Chip tone={statusTone(d.status)}>{d.status}</Chip>
                    <Chip>{d.entriesCount ?? 0} entries</Chip>
                    {d.teamOnly && <Chip tone="violet">{teamName(teams, d.teamOnly)} fans only</Chip>}
                  </div>
                  <p className="font-bold text-white break-words">{d.title}</p>
                  <p className="text-sm text-amber-300 break-words">Prize: {d.prize}</p>
                  <p className="text-xs text-slate-400">Closes {formatDateTime(d.closesAt)}</p>
                  {d.status === 'drawn' && (
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                      <p className="text-emerald-300 font-bold text-sm">Winner: {d.winnerName || '—'}</p>
                      <p className="text-slate-400">Drawn {formatDateTime(d.drawnAt)}</p>
                      <p className="text-slate-400 break-all">
                        Seed: <span className="font-mono text-slate-200">{d.seed || '—'}</span>
                      </p>
                      <p className="text-slate-400 break-all">
                        Entrants hash: <span className="font-mono text-slate-200">{d.entrantsHash || '—'}</span>
                      </p>
                    </div>
                  )}
                  <Actions className="mt-auto pt-1">
                    <Button size="sm" icon={<Users className="w-4 h-4" />} loading={busy === `ent:${d.id}`} onClick={() => viewEntrants(d)}>
                      Entrants
                    </Button>
                    {d.status !== 'drawn' && (
                      <>
                        <Button size="sm" icon={<Edit3 className="w-4 h-4" />} onClick={() => openEdit(d)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          icon={<Shuffle className="w-4 h-4" />}
                          loading={busy === `exec:${d.id}`}
                          disabled={(d.entriesCount ?? 0) === 0}
                          title={(d.entriesCount ?? 0) === 0 ? 'No entrants yet' : undefined}
                          onClick={() => execute(d)}
                        >
                          Draw winner
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `del:${d.id}`} onClick={() => remove(d)}>
                      Delete
                    </Button>
                  </Actions>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Sheet
        open={!!draft}
        title={draft?.id ? 'Edit draw' : 'New draw'}
        onClose={() => setDraft(null)}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy === 'save'}>
              Save draw
            </Button>
          </>
        }
      >
        {draft && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Title" required error={errors.title} className="sm:col-span-2">
              <TextInput value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} error={!!errors.title} />
            </Field>
            <Field label="Prize" required error={errors.prize} className="sm:col-span-2">
              <TextInput value={draft.prize} onChange={e => setDraft({ ...draft, prize: e.target.value })} error={!!errors.prize} />
            </Field>
            <Field label="Description" className="sm:col-span-2" hint="Eligibility, how the winner is contacted, etc.">
              <TextArea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
            </Field>
            <Field label="Closes at (your local time)" required error={errors.closesAt}>
              <TextInput type="datetime-local" value={draft.closesAt} onChange={e => setDraft({ ...draft, closesAt: e.target.value })} error={!!errors.closesAt} />
            </Field>
            <Field label="Restrict to fans of">
              <Select value={draft.teamOnly} onChange={e => setDraft({ ...draft, teamOnly: e.target.value })}>
                <option value="">All fans</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Accent colour" error={errors.color}>
              <div className="flex gap-2">
                <input type="color" aria-label="Accent colour" value={HEX.test(draft.color) ? draft.color : '#f59e0b'} onChange={e => setDraft({ ...draft, color: e.target.value })} className="h-11 w-14 rounded-xl bg-slate-950 border border-slate-700 shrink-0" />
                <TextInput value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} error={!!errors.color} />
              </div>
            </Field>
            {draft.id && (
              <Field label="Status">
                <Select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as PrizeDraw['status'] })}>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </Select>
              </Field>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={!!entrants} title={entrants ? `Entrants: ${entrants.draw.title}` : 'Entrants'} onClose={() => setEntrants(null)}>
        {entrants &&
          (entrants.entries.length === 0 ? (
            <EmptyState title="No entrants yet" />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-400">{entrants.entries.length} entrants</p>
              <ul className="divide-y divide-slate-800">
                {entrants.entries.map((en, i) => (
                  <li key={`${en.userEmail}-${i}`} className="py-2">
                    <p className="text-sm font-bold text-white break-words">{en.userName || '—'}</p>
                    <p className="text-xs text-slate-400 break-all">
                      {en.userEmail} · {formatDateTime(en.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </Sheet>
    </div>
  );
};
