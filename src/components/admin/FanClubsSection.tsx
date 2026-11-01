import React, { useEffect, useState } from 'react';
import { Download, Plus, Trash2, Upload, UserPlus, X } from 'lucide-react';
import { api } from '../../api';
import { Link } from '../../router';
import type { FanClubAdminClub, FanClubAdminView } from '../../types';
import { ClubForm } from '../../pages/FanClubAdminPage';
import { Button, Card, Chip, EmptyState, Field, Notice, NoticeState, SectionHeader, Sheet, TextArea, TextInput, errorMessage } from './ui';

const CSV_HEADER = 'name,city,country,address,region,capacity,contactPerson,checkInPoints,gamesMode';

/**
 * League admins: every fan club, with its admins. Add clubs one by one or import a list (CSV or the
 * JSON export of another season). Fan club admins sign in with the email named here and see only
 * their own clubs on the fan club desk.
 */
export const FanClubsSection: React.FC = () => {
  const [view, setView] = useState<FanClubAdminView | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [busy, setBusy] = useState('');

  const load = () => api.fanClubAdmin().then(setView).catch(e => setNotice({ kind: 'err', text: errorMessage(e) }));
  useEffect(() => {
    load();
  }, []);

  if (!view) return <Notice notice={notice} />;
  if (!view.leagueWide) {
    return (
      <Card className="p-5">
        <p className="text-sm text-slate-300">You run {view.clubs.length} fan club{view.clubs.length === 1 ? '' : 's'}.</p>
        <Link to="/admin/fanclub" className="mt-3 inline-flex rounded-xl bg-amber-400 px-3 py-2 text-sm font-black text-slate-950">Open the fan club desk</Link>
      </Card>
    );
  }

  const doImport = async () => {
    setBusy('import');
    try {
      const text = importText.trim();
      const payload = text.startsWith('[') || text.startsWith('{') ? { clubs: (() => { const j = JSON.parse(text); return Array.isArray(j) ? j : j.clubs; })() } : { csv: text };
      const r = await api.fanClubImport(payload);
      setNotice({ kind: r.errors.length ? 'warn' : 'ok', text: `Added ${r.added}, updated ${r.updated}, ${r.offers} offer(s).${r.errors.length ? ` Skipped: ${r.errors.slice(0, 5).join('; ')}` : ''}` });
      setImporting(false);
      setImportText('');
      load();
    } catch (e) {
      setNotice({ kind: 'err', text: errorMessage(e, 'Import failed. Check the CSV header or JSON.') });
    } finally {
      setBusy('');
    }
  };

  const doExport = async () => {
    const r = await api.fanClubExport();
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `fan-clubs-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const remove = async (c: FanClubAdminClub) => {
    if (!window.confirm(`Remove ${c.name}?`)) return;
    try {
      const r = await api.fanClubDelete(c.id);
      setNotice({ kind: 'ok', text: r.note || `${c.name} removed.` });
      load();
    } catch (e) {
      setNotice({ kind: 'err', text: errorMessage(e) });
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Fan clubs"
        description={`Fans check in at a fan club on matchdays (from ${view.opensMinutesBefore} minutes before the first ball) and earn points. Each club's admins run its desk and offers.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)} data-testid="fanclub-add">Add a fan club</Button>
            <Button icon={<Upload className="w-4 h-4" />} onClick={() => setImporting(true)}>Import</Button>
            <Button icon={<Download className="w-4 h-4" />} onClick={doExport} disabled={!view.clubs.length}>Export</Button>
            <Link to="/admin/fanclub" className="inline-flex items-center rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-200">Fan club desk</Link>
          </div>
        }
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {view.clubs.length === 0 ? (
        <EmptyState title="No fan clubs yet" description="Add your fan clubs, or import a list. Nothing is built in." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {view.clubs.map(c => (
            <ClubCard key={c.id} club={c} onChanged={load} onRemove={() => remove(c)} setNotice={setNotice} defaultPoints={view.defaultCheckInPoints} />
          ))}
        </div>
      )}
      <Sheet open={adding} title="Add a fan club" onClose={() => setAdding(false)}>
        <ClubForm club={{ gamesMode: 'team', active: true, offers: [] }} leagueWide defaultPoints={view.defaultCheckInPoints} onSaved={() => { setAdding(false); load(); }} />
      </Sheet>
      <Sheet
        open={importing}
        title="Import fan clubs"
        onClose={() => setImporting(false)}
        footer={<Button variant="primary" loading={busy === 'import'} disabled={!importText.trim()} onClick={doImport}>Import</Button>}
      >
        <div className="space-y-3 text-sm text-slate-300">
          <p>Paste CSV with this header row, or the JSON from Export (which can include offers). A row with the same name and city as an existing club updates it.</p>
          <pre className="rounded-lg bg-slate-950 p-2 text-xs text-amber-200 overflow-x-auto">{CSV_HEADER}</pre>
          <TextArea rows={10} value={importText} onChange={e => setImportText(e.target.value)} placeholder={`${CSV_HEADER}\nAces Lounge,Dubai,UAE,"Al Barsha 1",UAE,120,Sam,100,team`} />
        </div>
      </Sheet>
    </div>
  );
};

function ClubCard({ club, onChanged, onRemove, setNotice, defaultPoints }: { club: FanClubAdminClub; onChanged: () => void; onRemove: () => void; setNotice: (n: NoticeState) => void; defaultPoints: number }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const addAdmin = async () => {
    setBusy(true);
    try {
      await api.fanClubSetAdmin(club.id, email, { name });
      setEmail('');
      setName('');
      setNotice({ kind: 'ok', text: `${email} can now run ${club.name} after signing in with that email.` });
      onChanged();
    } catch (e) {
      setNotice({ kind: 'err', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  const removeAdmin = async (e: string) => {
    try {
      await api.fanClubSetAdmin(club.id, e, { remove: true });
      onChanged();
    } catch (err) {
      setNotice({ kind: 'err', text: errorMessage(err) });
    }
  };
  return (
    <Card className="p-4 space-y-3" data-testid="fanclub-row">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-black text-white">{club.name} {club.active === false && <Chip tone="slate">off</Chip>}</p>
          <p className="text-xs text-slate-400">{[club.address, club.city, club.country].filter(Boolean).join(', ')}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip tone="amber">+{club.effectiveCheckInPoints} per check-in</Chip>
            <Chip tone="blue">{club.gamesMode === 'all' ? 'Every game' : 'Fan club team games only'}</Chip>
            <Chip tone="slate">{club.offers.length} offer(s)</Chip>
            <Chip tone="slate">{club.totalCheckIns} check-ins</Chip>
          </div>
        </div>
        <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${club.name}`}><Trash2 className="w-4 h-4" /></Button>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-slate-300">Fan club admins</p>
        {club.admins.length === 0 && <p className="text-xs text-slate-500">None yet.</p>}
        {club.admins.map(a => (
          <span key={a.email} className="me-1.5 inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-200">
            {a.name} · {a.email}
            <button type="button" onClick={() => removeAdmin(a.email)} aria-label={`Remove ${a.email}`}><X className="w-3 h-3" /></button>
          </span>
        ))}
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); addAdmin(); }}>
          <Field label="Email" className="flex-1 min-w-[160px]"><TextInput type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@club.com" data-testid="fanclub-admin-email" /></Field>
          <Field label="Name" className="w-32"><TextInput value={name} onChange={e => setName(e.target.value)} /></Field>
          <Button type="submit" size="sm" loading={busy} icon={<UserPlus className="w-4 h-4" />} className="self-end" data-testid="fanclub-admin-add">Add</Button>
        </form>
      </div>
      <Sheet open={editing} title={`Edit ${club.name}`} onClose={() => setEditing(false)}>
        <ClubForm club={club} leagueWide defaultPoints={defaultPoints} onSaved={() => { setEditing(false); onChanged(); }} />
      </Sheet>
    </Card>
  );
}
