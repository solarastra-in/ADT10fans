import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Edit3, 
  Trash2, 
  Save, 
  RotateCcw, 
  Star, 
  Shield, 
  Award, 
  Search, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles,
  Zap,
  Filter,
  BarChart2,
  ExternalLink
} from 'lucide-react';
import { Team, Player } from '../../types';
import { api } from '../../api';
import {
  Actions,
  Button,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  Errors,
  Field,
  Notice,
  SectionHeader,
  Select,
  Sheet,
  TeamSwatch,
  TextInput,
  useRunner,
} from './ui';
import { PLAYER_ROLES, PLAYER_CATEGORIES, BATTING_STYLES, BOWLING_STYLES } from './shared';

const genId = (prefix: string) =>
  `${prefix}-${(typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)).slice(0, 8)}`;

type PlayerDraft = {
  id: string;
  teamId: string;
  name: string;
  role: Player['role'];
  category: string;
  battingStyle: string;
  bowlingStyle: string;
  isCaptain: boolean;
  isKeeper: boolean;
  isIcon: boolean;
  nationality: string;
  photoUrl: string;
  cricbuzzProfileUrl: string;
  credits: string;
  cricketdataId: string;
  links: Record<EditableLink, string>;
};

/** Links an admin can set; Cricbuzz has its own field above. */
type EditableLink = 'espncricinfo' | 'wikipedia' | 'instagram' | 'x' | 'facebook' | 'youtube' | 'tiktok' | 'threads';
const LINK_FIELDS: { key: EditableLink; label: string; placeholder: string }[] = [
  { key: 'espncricinfo', label: 'ESPNcricinfo profile', placeholder: 'https://www.espncricinfo.com/cricketers/…' },
  { key: 'wikipedia', label: 'Wikipedia article', placeholder: 'https://en.wikipedia.org/wiki/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/…/' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/…' },
  { key: 'youtube', label: 'YouTube channel', placeholder: 'https://www.youtube.com/@…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@…' },
  { key: 'threads', label: 'Threads', placeholder: 'https://www.threads.com/@…' },
];
const noLinks = (): Record<EditableLink, string> => ({ espncricinfo: '', wikipedia: '', instagram: '', x: '', facebook: '', youtube: '', tiktok: '', threads: '' });

const emptyPlayerDraft = (teamId: string): PlayerDraft => ({
  id: genId(teamId || 'player'),
  teamId,
  name: '',
  role: 'batter',
  category: '',
  battingStyle: 'Right-hand bat',
  bowlingStyle: '',
  isCaptain: false,
  isKeeper: false,
  isIcon: false,
  nationality: '',
  photoUrl: '',
  cricbuzzProfileUrl: '',
  credits: '',
  cricketdataId: '',
  links: noLinks(),
});

const fromPlayer = (p: Player): PlayerDraft => ({
  id: p.id,
  teamId: p.teamId,
  name: p.name || '',
  role: p.role || 'batter',
  category: p.category || '',
  battingStyle: p.battingStyle || 'Right-hand bat',
  bowlingStyle: p.bowlingStyle || '',
  isCaptain: !!p.isCaptain,
  isKeeper: !!p.isKeeper,
  isIcon: !!p.isIcon,
  nationality: p.nationality || '',
  photoUrl: p.photoUrl || '',
  cricbuzzProfileUrl: p.cricbuzzProfileUrl || '',
  // Credits shown in the API are already the effective value; keep blank only for brand-new players.
  credits: typeof p.creditsOverride === 'number' ? String(p.creditsOverride) : '',
  cricketdataId: p.cricketdataId || '',
  links: { ...noLinks(), ...Object.fromEntries(Object.entries(p.links || {}).filter(([k]) => k !== 'cricbuzz')) } as Record<EditableLink, string>,
});

export const SquadEditorSection: React.FC<{
  teams: Team[];
  onRefreshAll: () => Promise<void>;
}> = ({ teams = [], onRefreshAll }) => {
  const { busy, notice, setNotice, run } = useRunner();

  // Active Selected Team
  const [selectedTeamId, setSelectedTeamId] = useState<string>(teams[0]?.id || '');

  // Keep selectedTeamId synced if teams change or initial empty
  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const activeTeam = useMemo(() => {
    return teams.find(t => t.id === selectedTeamId) || teams[0] || null;
  }, [teams, selectedTeamId]);

  // Working Squad State for the selected team
  const [workingSquad, setWorkingSquad] = useState<Player[]>([]);
  const [isDirty, setIsDirty] = useState(false);

  // Sync working squad when active team changes or database reloads (unless dirty)
  useEffect(() => {
    if (activeTeam) {
      setWorkingSquad((activeTeam.squad || []).map(p => ({ ...p, credits: typeof p.creditsOverride === 'number' ? p.creditsOverride : undefined })));
      setIsDirty(false);
    }
  }, [activeTeam?.id, activeTeam?.updatedAt]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | Player['role']>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Add / Edit Player Modal
  const [editingPlayer, setEditingPlayer] = useState<{
    draft: PlayerDraft;
    isNew: boolean;
    index?: number;
  } | null>(null);
  const [playerErrors, setPlayerErrors] = useState<Errors>({});

  // Squad Summary Stats
  const stats = useMemo(() => {
    const total = workingSquad.length;
    const batters = workingSquad.filter(p => p.role === 'batter').length;
    const bowlers = workingSquad.filter(p => p.role === 'bowler').length;
    const allrounders = workingSquad.filter(p => p.role === 'allrounder').length;
    const keepers = workingSquad.filter(p => p.role === 'wicketkeeper').length;
    const icons = workingSquad.filter(p => p.isIcon).length;
    const captain = workingSquad.find(p => p.isCaptain);
    return { total, batters, bowlers, allrounders, keepers, icons, captain };
  }, [workingSquad]);

  // Filtered Squad
  const filteredSquad = useMemo(() => {
    return workingSquad.filter(p => {
      const matchesRole = roleFilter === 'all' || p.role === roleFilter;
      const matchesSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
        (p.battingStyle && p.battingStyle.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (p.bowlingStyle && p.bowlingStyle.toLowerCase().includes(searchQuery.toLowerCase().trim())) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase().trim()));
      return matchesRole && matchesSearch;
    });
  }, [workingSquad, roleFilter, searchQuery]);

  // Open Add Player Modal
  const handleOpenAddPlayer = () => {
    if (!activeTeam) return;
    setPlayerErrors({});
    setEditingPlayer({
      draft: emptyPlayerDraft(activeTeam.id),
      isNew: true,
    });
  };

  // Open Edit Player Modal
  const handleOpenEditPlayer = (player: Player, index: number) => {
    setPlayerErrors({});
    setEditingPlayer({
      draft: fromPlayer(player),
      isNew: false,
      index,
    });
  };

  // Save Player in Modal (updates workingSquad)
  const handleSavePlayerDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !activeTeam) return;

    const { draft, isNew, index } = editingPlayer;
    const errors: Errors = {};
    if (!draft.name.trim()) errors.name = 'Player name is required';
    if (!draft.role) errors.role = 'Role is required';
    if (draft.credits.trim() && (!(Number(draft.credits) >= 4) || Number(draft.credits) > 15)) errors.credits = 'Credits must be between 4 and 15 (or blank for automatic)';
    if (draft.photoUrl.trim() && !/^https:\/\//.test(draft.photoUrl.trim())) errors.photoUrl = 'Photo link must start with https://';
    if (draft.cricbuzzProfileUrl.trim() && !/^https:\/\//.test(draft.cricbuzzProfileUrl.trim())) errors.cricbuzzProfileUrl = 'Profile link must start with https://';
    for (const f of LINK_FIELDS) if (draft.links[f.key].trim() && !/^https:\/\//.test(draft.links[f.key].trim())) errors[`link-${f.key}`] = 'Link must start with https://';
    if (draft.cricketdataId.trim() && !/^[\w-]{6,60}$/.test(draft.cricketdataId.trim())) errors.cricketdataId = 'Paste the player id from CricketData.org (letters, digits and dashes)';

    setPlayerErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Start from the stored player so fields the form does not show (Cricbuzz id, image id, notes,
    // looked-up ids and link sources) are kept. They used to be dropped on every edit.
    const original = !isNew && index !== undefined && index >= 0 ? workingSquad[index] : undefined;
    const links: Player['links'] = { ...(original?.links?.cricbuzz ? { cricbuzz: original.links.cricbuzz } : {}) };
    for (const f of LINK_FIELDS) if (draft.links[f.key].trim()) links[f.key] = draft.links[f.key].trim();
    const formattedPlayer: Player = {
      ...(original || {}),
      id: draft.id || genId(activeTeam.id),
      teamId: activeTeam.id,
      name: draft.name.trim(),
      role: draft.role,
      category: draft.category || undefined,
      battingStyle: draft.battingStyle.trim() || 'Right-hand bat',
      bowlingStyle: draft.bowlingStyle.trim() || undefined,
      isCaptain: draft.isCaptain,
      isKeeper: draft.isKeeper,
      isIcon: draft.isIcon || draft.category === 'Icon',
      nationality: draft.nationality.trim() || undefined,
      photoUrl: draft.photoUrl.trim() || undefined,
      cricbuzzProfileUrl: draft.cricbuzzProfileUrl.trim() || undefined,
      credits: draft.credits.trim() ? Math.round(Number(draft.credits) * 2) / 2 : undefined,
      cricketdataId: draft.cricketdataId.trim() || undefined,
      links: Object.keys(links).length ? links : undefined,
    };

    if (isNew) {
      setWorkingSquad(prev => [...prev, formattedPlayer]);
    } else if (index !== undefined && index >= 0) {
      setWorkingSquad(prev => prev.map((p, i) => (i === index ? formattedPlayer : p)));
    }

    setIsDirty(true);
    setEditingPlayer(null);
    setNotice({
      kind: 'ok',
      text: `${formattedPlayer.name} ${isNew ? 'added to squad' : 'updated'}. Don't forget to save squad changes!`,
    });
  };

  // Delete Player
  const handleDeletePlayer = (playerId: string, playerName: string) => {
    if (!window.confirm(`Are you sure you want to remove "${playerName}" from this squad?`)) return;
    setWorkingSquad(prev => prev.filter(p => p.id !== playerId));
    setIsDirty(true);
    setNotice({
      kind: 'ok',
      text: `Removed ${playerName} from squad. Click "Save Squad Changes" to persist.`,
    });
  };

  // Quick Action: Set as Team Icon
  const handleSetIcon = (playerId: string) => {
    setWorkingSquad(prev =>
      prev.map(p => {
        if (p.id === playerId) {
          return { ...p, isIcon: true, category: 'Icon' };
        }
        return p;
      })
    );
    setIsDirty(true);
  };

  // Quick Action: Toggle Captain
  const handleToggleCaptain = (playerId: string) => {
    setWorkingSquad(prev =>
      prev.map(p => {
        if (p.id === playerId) {
          return { ...p, isCaptain: !p.isCaptain };
        }
        // Only one captain at a time
        return { ...p, isCaptain: false };
      })
    );
    setIsDirty(true);
  };

  // Quick Action: Toggle Keeper
  const handleToggleKeeper = (playerId: string) => {
    setWorkingSquad(prev =>
      prev.map(p => {
        if (p.id === playerId) {
          return { ...p, isKeeper: !p.isKeeper };
        }
        return p;
      })
    );
    setIsDirty(true);
  };

  // Save Squad to Database
  const handleSaveSquadToDatabase = async () => {
    if (!activeTeam) return;

    const invalid = workingSquad.filter(p => !p.name.trim());
    if (invalid.length > 0) {
      setNotice({ kind: 'err', text: 'All players must have a valid name before saving.' });
      return;
    }

    await run(
      `save-squad-${activeTeam.id}`,
      async () => {
        let res;
        try {
          res = await api.saveSquad(activeTeam.id, workingSquad);
        } catch (err: any) {
          if (err?.status === 409 && window.confirm(`${err.message}\n\nRemove anyway?`)) res = await api.saveSquad(activeTeam.id, workingSquad, true);
          else throw err;
        }
        setIsDirty(false);
        await onRefreshAll();
        return res;
      },
      () => `Successfully saved squad for ${activeTeam.name}! (${workingSquad.length} players persisted in database).`
    );
  };

  // Discard Working Changes
  const handleDiscardChanges = () => {
    if (!activeTeam) return;
    if (isDirty && !window.confirm('Discard all unsaved squad changes and reload from database?')) return;
    setWorkingSquad((activeTeam.squad || []).map(p => ({ ...p, credits: typeof p.creditsOverride === 'number' ? p.creditsOverride : undefined })));
    setIsDirty(false);
    setNotice({ kind: 'ok', text: 'Squad changes reset to database snapshot.' });
  };

  if (teams.length === 0) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Squad Editor" description="Manage official franchise squads and player rosters." />
        <EmptyState title="No teams found" description="Seed or create official franchises first before editing squads." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Squad Editor"
        description="Add, edit, or delete individual players from franchise squad arrays. Update player roles, batting and bowling styles, and save directly to persistent database."
        actions={
          <div className="flex items-center gap-2">
            {isDirty && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDiscardChanges}
                icon={<RotateCcw className="w-4 h-4" />}
                disabled={!!busy}
              >
                Discard Changes
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveSquadToDatabase}
              loading={busy === `save-squad-${activeTeam?.id}`}
              disabled={!!busy}
              icon={<Save className="w-4 h-4" />}
              className={isDirty ? 'ring-2 ring-amber-400 animate-pulse' : ''}
            >
              Save Squad to Database
            </Button>
          </div>
        }
      />

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {/* Franchise Switcher Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Select Franchise to Edit Squad:
          </span>
          {isDirty && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Unsaved Changes Pending
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {teams.map(t => {
            const isSelected = t.id === selectedTeamId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  if (isDirty && !window.confirm('You have unsaved changes in the current squad. Switch team anyway?')) {
                    return;
                  }
                  setSelectedTeamId(t.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-950/80 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: t.color }}
                />
                <span>{t.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                    isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {t.squad?.length || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Franchise Overview & Squad Analytics Header */}
      {activeTeam && (
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border-amber-500/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <TeamSwatch color={activeTeam.color} label={activeTeam.short} logo={activeTeam.logo} />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white">{activeTeam.name}</h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase text-slate-950 bg-amber-400">
                    {activeTeam.short}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                  {activeTeam.home && <><span>Home: <strong className="text-white">{activeTeam.home}</strong></span><span>·</span></>}
                  {activeTeam.headCoach && <><span>Coach: <strong className="text-slate-200">{activeTeam.headCoach}</strong></span><span>·</span></>}
                  <span>Icon: <strong className="text-amber-300">{activeTeam.iconPlayer || stats.captain?.name || '—'}</strong></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenAddPlayer}
                icon={<UserPlus className="w-4 h-4" />}
              >
                Add Player to Squad
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  run('find-links', async () => {
                    if (isDirty && !window.confirm('Save or discard your squad changes first: finding links reloads the squad. Continue and discard them?')) return;
                    const r = await api.resolvePlayerLinks({ all: true, teamId: activeTeam.id });
                    await onRefreshAll();
                    setIsDirty(false);
                    setNotice({ kind: 'ok', text: `Checked ${r.checked} player(s), links found for ${r.updated}. ${r.report.join(' ')}` });
                  })
                }
                loading={busy === 'find-links'}
                disabled={!!busy}
                title="ESPNcricinfo, Wikipedia and official social accounts, matched by Cricbuzz id. Links you typed are kept."
              >
                Find player links
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  run('career', async () => {
                    if (isDirty && !window.confirm('Save or discard your squad changes first: fetching career stats reloads the squad. Continue and discard them?')) return;
                    const r = await api.refreshCareerStats({});
                    await onRefreshAll();
                    setIsDirty(false);
                    setNotice({ kind: 'ok', text: r.report.join(' ') });
                  })
                }
                loading={busy === 'career'}
                disabled={!!busy}
                title="T20I, IPL and other career records from CricketData.org, up to 15 players at a time within the daily request budget (Settings)."
              >
                Fetch career stats
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveSquadToDatabase}
                loading={busy === `save-squad-${activeTeam.id}`}
                disabled={!!busy}
                icon={<Save className="w-4 h-4" />}
              >
                Save Squad
              </Button>
            </div>
          </div>

          {/* Squad Metrics Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4">
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Squad</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span>{stats.total} Players</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Batters</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                <span>🏏</span>
                <span>{stats.batters}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bowlers</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                <span>⚡</span>
                <span>{stats.bowlers}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">All-Rounders</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                <span>🌟</span>
                <span>{stats.allrounders}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wicketkeepers</span>
              <div className="text-lg font-black text-white flex items-center gap-1.5 mt-0.5">
                <span>🧤</span>
                <span>{stats.keepers}</span>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Icon Signings</span>
              <div className="text-lg font-black text-amber-300 flex items-center gap-1.5 mt-0.5">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{stats.icons}</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Squad Controls: Search, Filters & View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(
            [
              { id: 'all', label: `All (${workingSquad.length})` },
              { id: 'batter', label: `Batters (${stats.batters})` },
              { id: 'bowler', label: `Bowlers (${stats.bowlers})` },
              { id: 'allrounder', label: `All-Rounders (${stats.allrounders})` },
              { id: 'wicketkeeper', label: `WKs (${stats.keepers})` },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                roleFilter === tab.id
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Add */}
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search squad players..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
            />
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={handleOpenAddPlayer}
            icon={<UserPlus className="w-4 h-4" />}
          >
            Add Player
          </Button>
        </div>
      </div>

      {/* Squad Roster Grid */}
      {filteredSquad.length === 0 ? (
        <EmptyState
          title="No squad players match criteria"
          description={searchQuery ? 'Try clearing your search query.' : 'Click "Add Player to Squad" to add confirmed signings.'}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredSquad.map((player, idx) => {
            const originalIndex = workingSquad.findIndex(p => p.id === player.id);
            const initials = player.name
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <Card
                key={player.id || idx}
                className="p-4 bg-slate-900/90 border-slate-800 hover:border-amber-400/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Player Card Header */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      {player.photoUrl ? (
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          className="w-12 h-12 rounded-xl object-cover bg-slate-800 border border-slate-700 shrink-0"
                          onError={e => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm text-white border border-white/10 shrink-0"
                          style={{ backgroundColor: activeTeam?.color || '#475569' }}
                        >
                          {initials}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-sm text-white truncate">{player.name}</h3>
                          {player.isCaptain && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                              C
                            </span>
                          )}
                          {player.isKeeper && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-400/20 text-emerald-300 border border-emerald-400/40">
                              WK
                            </span>
                          )}
                          {player.isIcon && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-400 text-slate-950">
                              ICON
                            </span>
                          )}
                        </div>

                        <span className="text-xs font-semibold text-amber-400 capitalize block mt-0.5">
                          {player.role}
                          {player.category ? ` · ${player.category}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Player Technical Specifications: Batting Style & Bowling Style */}
                  <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-semibold">Batting Style:</span>
                      <strong className="text-slate-200 font-bold">
                        {player.battingStyle || 'Right-hand bat'}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-semibold">Bowling Style:</span>
                      <strong className="text-slate-200 font-bold truncate max-w-[160px] text-right">
                        {player.bowlingStyle || 'Does not bowl'}
                      </strong>
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-semibold">Pick XI credits:</span>
                      <strong className="text-amber-300 font-mono">{player.credits ?? 'auto'}</strong>
                    </div>
                  </div>
                </div>

                {/* Card Action Shortcuts */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-1 flex-wrap">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCaptain(player.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        player.isCaptain
                          ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                      title="Set as team captain"
                    >
                      {player.isCaptain ? 'Captain ✓' : 'Make Captain'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleKeeper(player.id)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                        player.isKeeper
                          ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                      }`}
                      title="Set as wicketkeeper"
                    >
                      {player.isKeeper ? 'WK ✓' : 'Make WK'}
                    </button>

                    {!player.isIcon && (
                      <button
                        type="button"
                        onClick={() => handleSetIcon(player.id)}
                        className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 transition-colors"
                        title="Set as Icon player"
                      >
                        Set Icon
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEditPlayer(player, originalIndex)}
                      icon={<Edit3 className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeletePlayer(player.id, player.name)}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Player Sheet */}
      {editingPlayer && (
        <Sheet
          open={!!editingPlayer}
          title={editingPlayer.isNew ? `Add Player to ${activeTeam?.name}` : `Edit ${editingPlayer.draft.name}`}
          onClose={() => setEditingPlayer(null)}
          footer={
            <>
              <Button onClick={() => setEditingPlayer(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSavePlayerDraft} icon={<Check className="w-4 h-4" />}>
                {editingPlayer.isNew ? 'Add to Squad' : 'Update Player'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleSavePlayerDraft} className="space-y-4">
            <Field label="Player Full Name" required error={playerErrors.name}>
              <TextInput
                value={editingPlayer.draft.name}
                onChange={e =>
                  setEditingPlayer(prev => (prev ? { ...prev, draft: { ...prev.draft, name: e.target.value } } : null))
                }
                placeholder="e.g. Moeen Ali"
                error={!!playerErrors.name}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Playing Role" required error={playerErrors.role}>
                <Select
                  value={editingPlayer.draft.role}
                  onChange={e =>
                    setEditingPlayer(prev =>
                      prev ? { ...prev, draft: { ...prev.draft, role: e.target.value as Player['role'] } } : null
                    )
                  }
                >
                  {PLAYER_ROLES.map(r => (
                    <option key={r} value={r}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Draft Category">
                <Select
                  value={editingPlayer.draft.category}
                  onChange={e =>
                    setEditingPlayer(prev =>
                      prev
                        ? {
                            ...prev,
                            draft: {
                              ...prev.draft,
                              category: e.target.value,
                              isIcon: e.target.value === 'Icon' ? true : prev.draft.isIcon,
                            },
                          }
                        : null
                    )
                  }
                >
                  <option value="">— Uncategorized —</option>
                  {PLAYER_CATEGORIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {/* Technical Cricket Style Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Batting Style" hint="Primary batting hand and style">
                <Select
                  value={editingPlayer.draft.battingStyle}
                  onChange={e =>
                    setEditingPlayer(prev =>
                      prev ? { ...prev, draft: { ...prev.draft, battingStyle: e.target.value } } : null
                    )
                  }
                >
                  {BATTING_STYLES.map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Bowling Style" hint="Bowling arm and delivery action">
                <div className="space-y-1.5">
                  <Select
                    value={
                      BOWLING_STYLES.includes(editingPlayer.draft.bowlingStyle as any)
                        ? editingPlayer.draft.bowlingStyle
                        : 'custom'
                    }
                    onChange={e => {
                      const v = e.target.value;
                      if (v !== 'custom') {
                        setEditingPlayer(prev =>
                          prev ? { ...prev, draft: { ...prev.draft, bowlingStyle: v } } : null
                        );
                      }
                    }}
                  >
                    <option value="">None / Does not bowl</option>
                    {BOWLING_STYLES.map(bs => (
                      <option key={bs} value={bs}>
                        {bs}
                      </option>
                    ))}
                    <option value="custom">Other / Custom style...</option>
                  </Select>

                  <TextInput
                    placeholder="Or type custom bowling style (e.g. Left-arm orthodox)"
                    value={editingPlayer.draft.bowlingStyle}
                    onChange={e =>
                      setEditingPlayer(prev =>
                        prev ? { ...prev, draft: { ...prev.draft, bowlingStyle: e.target.value } } : null
                      )
                    }
                  />
                </div>
              </Field>
            </div>

            {/* Special Badges & Flags */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Player Roles & Accreditations
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Checkbox
                  label="Team Captain (C)"
                  checked={editingPlayer.draft.isCaptain}
                  onChange={v =>
                    setEditingPlayer(prev => (prev ? { ...prev, draft: { ...prev.draft, isCaptain: v } } : null))
                  }
                />
                <Checkbox
                  label="Wicketkeeper (WK)"
                  checked={editingPlayer.draft.isKeeper}
                  onChange={v =>
                    setEditingPlayer(prev => (prev ? { ...prev, draft: { ...prev.draft, isKeeper: v } } : null))
                  }
                />
                <Checkbox
                  label="Icon Player (★)"
                  checked={editingPlayer.draft.isIcon}
                  onChange={v =>
                    setEditingPlayer(prev =>
                      prev
                        ? {
                            ...prev,
                            draft: {
                              ...prev.draft,
                              isIcon: v,
                              category: v ? 'Icon' : prev.draft.category,
                            },
                          }
                        : null
                    )
                  }
                />
              </div>
            </div>

            {/* Optional Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nationality" hint="Country represented">
                <TextInput
                  placeholder="e.g. England, UAE, West Indies"
                  value={editingPlayer.draft.nationality}
                  onChange={e =>
                    setEditingPlayer(prev =>
                      prev ? { ...prev, draft: { ...prev.draft, nationality: e.target.value } } : null
                    )
                  }
                />
              </Field>

              <Field label="Pick XI credits" hint="4 to 15 in steps of 0.5. Leave blank to use the default for the category (Icon 10.5, Platinum 10, others 8.5)." error={playerErrors.credits}>
                <TextInput
                  type="number"
                  min="4"
                  max="15"
                  step="0.5"
                  inputMode="decimal"
                  value={editingPlayer.draft.credits}
                  onChange={e => setEditingPlayer(prev => (prev ? { ...prev, draft: { ...prev.draft, credits: e.target.value } } : null))}
                  error={!!playerErrors.credits}
                />
              </Field>
            </div>

            <Field label="Photo URL (Optional)" hint="Direct https:// image link" error={playerErrors.photoUrl}>
              <TextInput
                type="url"
                placeholder="https://"
                value={editingPlayer.draft.photoUrl}
                onChange={e =>
                  setEditingPlayer(prev =>
                    prev ? { ...prev, draft: { ...prev.draft, photoUrl: e.target.value } } : null
                  )
                }
              />
            </Field>

            <Field label="Cricbuzz Profile Link (Optional)" error={playerErrors.cricbuzzProfileUrl}>
              <TextInput
                type="url"
                placeholder="https://www.cricbuzz.com/profiles/..."
                value={editingPlayer.draft.cricbuzzProfileUrl}
                onChange={e =>
                  setEditingPlayer(prev =>
                    prev ? { ...prev, draft: { ...prev.draft, cricbuzzProfileUrl: e.target.value } } : null
                  )
                }
              />
            </Field>

            <div className="space-y-3 rounded-xl border border-slate-800 p-3">
              <p className="text-xs text-slate-400">
                Career stats and official accounts shown on the player card. <strong className="text-slate-200">Find player links</strong> fills these by matching ids (Cricbuzz → ESPNcricinfo → Wikidata); anything you type here is kept and never replaced.
              </p>
              <Field
                label="CricketData player id (career record)"
                hint="Filled automatically when the name matches exactly. Paste the id from the player's CricketData.org page to fix a wrong or missing career record."
                error={playerErrors.cricketdataId}
              >
                <TextInput
                  placeholder="e.g. 9a2f…"
                  value={editingPlayer.draft.cricketdataId}
                  onChange={e => setEditingPlayer(prev => (prev ? { ...prev, draft: { ...prev.draft, cricketdataId: e.target.value } } : null))}
                />
              </Field>
              {LINK_FIELDS.map(f => {
                const source = workingSquad[editingPlayer.index ?? -1]?.linkSources?.[f.key];
                return (
                  <Field key={f.key} label={f.label} hint={source && source !== 'admin' ? `Found automatically (${source})` : undefined} error={playerErrors[`link-${f.key}`]}>
                    <TextInput
                      type="url"
                      placeholder={f.placeholder}
                      value={editingPlayer.draft.links[f.key]}
                      onChange={e => setEditingPlayer(prev => (prev ? { ...prev, draft: { ...prev.draft, links: { ...prev.draft.links, [f.key]: e.target.value } } } : null))}
                    />
                  </Field>
                );
              })}
            </div>
          </form>
        </Sheet>
      )}
    </div>
  );
};
