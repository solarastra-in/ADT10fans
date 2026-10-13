import React, { useState } from 'react';
import { Plus, Trash2, Edit3, Sparkles, RotateCcw, Users, Save } from 'lucide-react';
import { Team } from '../../types';
import { api } from '../../api';
import { Actions, Button, Card, Chip, EmptyState, Errors, Field, Notice, SectionHeader, Sheet, TeamSwatch, TextArea, TextInput, isHttpsUrl, toNumber, useRunner } from './ui';

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
const HEX = /^#[0-9a-fA-F]{6}$/;

type TeamDraft = { id: string; name: string; short: string; color: string; secondaryColor: string; home: string; iconPlayer: string; headCoach: string; website: string; logo: string; note: string; sort: string };

const emptyDraft = (sort: number): TeamDraft => ({ id: '', name: '', short: '', color: '#475569', secondaryColor: '#0f172a', home: '', iconPlayer: '', headCoach: '', website: '', logo: '', note: '', sort: String(sort) });
const fromTeam = (t: Team): TeamDraft => ({
  id: t.id, name: t.name || '', short: t.short || '', color: HEX.test(t.color || '') ? t.color : '#475569', secondaryColor: HEX.test(t.secondaryColor || '') ? (t.secondaryColor as string) : '#0f172a',
  home: t.home || '', iconPlayer: t.iconPlayer || '', headCoach: t.headCoach || '', website: t.website || '', logo: t.logo || '', note: t.note || '', sort: String(t.sort ?? ''),
});

const validateTeam = (d: TeamDraft, isNew: boolean, teams: Team[]): Errors => {
  const e: Errors = {};
  if (!d.name.trim()) e.name = 'Team name is required.';
  if (!d.short.trim()) e.short = 'Short code is required (e.g. UB).';
  else if (d.short.trim().length > 5) e.short = 'Use 5 characters or fewer.';
  if (!HEX.test(d.color)) e.color = 'Pick a colour (#RRGGBB).';
  if (d.secondaryColor && !HEX.test(d.secondaryColor)) e.secondaryColor = 'Use #RRGGBB.';
  if (d.website && !isHttpsUrl(d.website)) e.website = 'Website must start with https://';
  if (d.logo && !isHttpsUrl(d.logo)) e.logo = 'Logo link must start with https://';
  if (isNew) {
    const id = d.id.trim() || slugify(d.name);
    if (!id) e.id = 'An ID is required.';
    else if (teams.some(t => t.id === id)) e.id = `A team with ID "${id}" already exists.`;
  }
  return e;
};

export const TeamsSection: React.FC<{ teams: Team[]; onRefreshAll: () => Promise<void>; goToSection?: (sectionId: any) => void; isTeamOfficial?: boolean }> = ({ teams, onRefreshAll, goToSection, isTeamOfficial }) => {
  const { busy, notice, setNotice, run } = useRunner();
  const [seedResult, setSeedResult] = useState<{ summary: string; created: string[]; updated: string[]; skipped: string[] } | null>(null);
  const [editing, setEditing] = useState<{ draft: TeamDraft; isNew: boolean } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const sorted = [...teams].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  const seed = async (overwrite: boolean) => {
    if (overwrite && !window.confirm('Reset the six official teams to the published squads? Names, colours and squads are replaced; fantasy credits you set for players who stay in a squad are kept.')) return;
    const res = await run(overwrite ? 'seed-overwrite' : 'seed', () => api.seedOfficialTeams(overwrite));
    if (res) {
      setSeedResult({ summary: res.summary, created: res.created || [], updated: res.updated || [], skipped: res.skipped || [] });
      await onRefreshAll();
    }
  };

  const setDraft = (patch: Partial<TeamDraft>) => editing && setEditing({ ...editing, draft: { ...editing.draft, ...patch } });

  const save = async () => {
    if (!editing) return;
    const { draft, isNew } = editing;
    const e = validateTeam(draft, isNew, teams);
    setErrors(e);
    if (Object.keys(e).length) return;
    const id = isNew ? draft.id.trim() || slugify(draft.name) : draft.id;
    const payload: Partial<Team> = {
      id, name: draft.name.trim(), short: draft.short.trim().toUpperCase(), color: draft.color, secondaryColor: draft.secondaryColor || undefined,
      home: draft.home.trim(), iconPlayer: draft.iconPlayer.trim(), headCoach: draft.headCoach.trim(), website: draft.website.trim(), logo: draft.logo.trim(), note: draft.note.trim(),
      sort: draft.sort.trim() ? toNumber(draft.sort, teams.length + 1) : teams.length + 1,
    };
    const res = await run('save', () => api.saveTeam(payload), `${payload.name} saved.`);
    if (res) {
      setEditing(null);
      await onRefreshAll();
    }
  };

  const remove = async (t: Team) => {
    if (!window.confirm(`Delete ${t.name}? Its squad and handles are deleted too.`)) return;
    const res = await run(`del:${t.id}`, () => api.deleteTeam(t.id), `${t.name} deleted.`);
    if (res) await onRefreshAll();
  };

  const d = editing?.draft;
  return (
    <div className="space-y-5">
      <SectionHeader
        title={isTeamOfficial ? 'Team page' : 'Teams'}
        description="Team details shown to fans. Squads are edited in the Squad Editor."
        actions={!isTeamOfficial ? <Button variant="primary" size="sm" onClick={() => { setErrors({}); setEditing({ draft: emptyDraft(teams.length + 1), isNew: true }); }} icon={<Plus className="w-4 h-4" />}>Add team</Button> : undefined}
      />
      {!isTeamOfficial && (
        <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-black text-white text-base">Official 2026 franchises</h3>
              <p className="text-sm text-slate-300 mt-1">The six franchises and their published squads are loaded automatically on a new site. Use this to add any that are missing, or to reset squads to the published lists.</p>
            </div>
            <Actions>
              <Button variant="primary" onClick={() => seed(false)} loading={busy === 'seed'} disabled={!!busy} icon={<Sparkles className="w-4 h-4" />}>Add missing franchises</Button>
              <Button variant="secondary" onClick={() => seed(true)} loading={busy === 'seed-overwrite'} disabled={!!busy} icon={<RotateCcw className="w-4 h-4" />}>Reset to published squads</Button>
              {goToSection && <Button variant="secondary" onClick={() => goToSection('tools')} icon={<Users className="w-4 h-4" />}>Refresh squads from Cricbuzz…</Button>}
            </Actions>
            {seedResult && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm space-y-2">
                <p className="text-slate-200 font-semibold">{seedResult.summary}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['created', 'updated', 'skipped'] as const).map(k => (
                    <div key={k}>
                      <span className="text-xs font-bold uppercase text-slate-400">{k === 'created' ? 'Added' : k === 'updated' ? 'Reset' : 'Kept'} ({seedResult[k].length})</span>
                      <p className="text-xs text-slate-300 break-words">{seedResult[k].length ? seedResult[k].join(', ') : '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {sorted.length === 0 ? (
        <EmptyState title="No teams" description="Add the official franchises above." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sorted.map(t => (
            <Card key={t.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <TeamSwatch color={t.color} label={t.short} logo={t.logo} />
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white truncate">{t.name}</p>
                  <p className="text-xs text-slate-400 truncate">{t.short} · ID {t.id}{t.home ? ` · ${t.home}` : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip>{(t.squad || []).length} players</Chip>
                {t.iconPlayer && <Chip tone="amber">Icon: {t.iconPlayer}</Chip>}
                {t.headCoach && <Chip tone="blue">Coach: {t.headCoach}</Chip>}
                <Chip>{t.fans || 0} fans</Chip>
              </div>
              <Actions>
                <Button size="sm" onClick={() => { setErrors({}); setEditing({ draft: fromTeam(t), isNew: false }); }} icon={<Edit3 className="w-4 h-4" />}>Edit details</Button>
                {goToSection && <Button size="sm" variant="secondary" onClick={() => goToSection('squads')} icon={<Users className="w-4 h-4" />}>Squad ({t.squad?.length || 0})</Button>}
                {!isTeamOfficial && <Button size="sm" variant="danger" onClick={() => remove(t)} loading={busy === `del:${t.id}`} icon={<Trash2 className="w-4 h-4" />}>Delete</Button>}
              </Actions>
            </Card>
          ))}
        </div>
      )}
      <Sheet
        open={!!editing}
        wide
        title={editing?.isNew ? 'Add team' : `Edit ${editing?.draft.name || 'team'}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            <Button onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy === 'save'} icon={<Save className="w-4 h-4" />}>Save team</Button>
          </>
        }
      >
        {d && (
          <div className="space-y-4">
            {Object.keys(errors).length > 0 && <Notice notice={{ kind: 'err', text: 'Please fix the highlighted fields.' }} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Team name" required error={errors.name}><TextInput value={d.name} onChange={e => setDraft({ name: e.target.value })} error={!!errors.name} /></Field>
              <Field label="Short code" required error={errors.short} hint="2–5 letters, e.g. UB"><TextInput value={d.short} maxLength={5} onChange={e => setDraft({ short: e.target.value.toUpperCase() })} error={!!errors.short} /></Field>
              {editing?.isNew && (
                <Field label="Team ID" error={errors.id} hint={`Leave blank to use "${slugify(d.name) || 'team-name'}". It becomes the page address and cannot be changed.`}>
                  <TextInput value={d.id} onChange={e => setDraft({ id: slugify(e.target.value) })} error={!!errors.id} />
                </Field>
              )}
              <Field label="Home ground"><TextInput value={d.home} onChange={e => setDraft({ home: e.target.value })} /></Field>
              <Field label="Icon player"><TextInput value={d.iconPlayer} onChange={e => setDraft({ iconPlayer: e.target.value })} /></Field>
              <Field label="Head coach"><TextInput value={d.headCoach} onChange={e => setDraft({ headCoach: e.target.value })} /></Field>
              <Field label="Official website" error={errors.website}><TextInput type="url" inputMode="url" placeholder="https://" value={d.website} onChange={e => setDraft({ website: e.target.value })} error={!!errors.website} /></Field>
              <Field label="Logo link" error={errors.logo} hint="An https:// image you have the right to use"><TextInput type="url" inputMode="url" placeholder="https://" value={d.logo} onChange={e => setDraft({ logo: e.target.value })} error={!!errors.logo} /></Field>
              <Field label="Primary colour" error={errors.color}>
                <div className="flex gap-2">
                  <input type="color" aria-label="Primary colour" value={HEX.test(d.color) ? d.color : '#475569'} onChange={e => setDraft({ color: e.target.value })} className="h-11 w-14 rounded-xl bg-slate-950 border border-slate-700 shrink-0" />
                  <TextInput value={d.color} onChange={e => setDraft({ color: e.target.value })} error={!!errors.color} />
                </div>
              </Field>
              <Field label="Secondary colour" error={errors.secondaryColor}>
                <div className="flex gap-2">
                  <input type="color" aria-label="Secondary colour" value={HEX.test(d.secondaryColor) ? d.secondaryColor : '#0f172a'} onChange={e => setDraft({ secondaryColor: e.target.value })} className="h-11 w-14 rounded-xl bg-slate-950 border border-slate-700 shrink-0" />
                  <TextInput value={d.secondaryColor} onChange={e => setDraft({ secondaryColor: e.target.value })} error={!!errors.secondaryColor} />
                </div>
              </Field>
              {!isTeamOfficial && <Field label="Display order"><TextInput type="number" inputMode="numeric" value={d.sort} onChange={e => setDraft({ sort: e.target.value })} /></Field>}
              <Field label="Note" className="sm:col-span-2" hint="Optional"><TextArea rows={2} value={d.note} onChange={e => setDraft({ note: e.target.value })} /></Field>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
};
