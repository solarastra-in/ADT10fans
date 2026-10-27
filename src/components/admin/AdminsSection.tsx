import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, UserPlus, Trash2, Edit2, Check, X, AlertCircle, Sparkles, Key, Users } from 'lucide-react';
import { api } from '../../api';
import { AdminPermission, AdminRole, AdminUserRecord, Team } from '../../types';
import { Button, Field, Select, TextInput } from './ui';
import { TeamInvitesPanel } from './TeamInvitesPanel';

interface AdminsSectionProps {
  currentUserEmail?: string;
  isCurrentUserSuperAdmin?: boolean;
  teams: Team[];
}

const ALL_PERMISSIONS: { id: AdminPermission; label: string; desc: string; color: string }[] = [
  { id: 'teams', label: 'Teams & squads', desc: 'Team pages, squads, fantasy credits', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { id: 'matches', label: 'Matches', desc: 'Fixtures, live scores, scorecards, results', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  { id: 'contests', label: 'Predictions', desc: 'Prediction contests and quizzes, settling', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { id: 'fantasy', label: 'Pick XI', desc: 'Re-score Pick XI after scorecard fixes', color: 'bg-violet-500/10 text-violet-300 border-violet-500/30' },
  { id: 'prizes', label: 'Prizes & claims', desc: 'Reward catalogue, fulfil or cancel claims', color: 'bg-lime-500/10 text-lime-300 border-lime-500/30' },
  { id: 'draws', label: 'Prize draws', desc: 'Create draws, pick winners', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
  { id: 'social', label: 'Handles & feeds', desc: 'Official accounts, posts, approvals', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  { id: 'community', label: 'Forum & polls', desc: 'Moderation, reports, polls', color: 'bg-pink-500/10 text-pink-300 border-pink-500/30' },
  { id: 'notifications', label: 'Notifications', desc: 'Push and in-app messages', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30' },
  { id: 'fanspaces', label: 'Fan Spaces', desc: 'Venues, bookings, door check-in', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  { id: 'growth', label: 'Programmes', desc: 'Youth cup, creators, commentary, memberships', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' },
  { id: 'settings', label: 'Settings', desc: 'Branding, season, integrations, proposal', color: 'bg-slate-500/10 text-slate-300 border-slate-500/30' },
];

const TEAM_OFFICIAL_PERMS: AdminPermission[] = ['team', 'social', 'community', 'notifications', 'prizes'];

const ROLE_PRESETS: { id: AdminRole; label: string; desc: string; defaultPerms: AdminPermission[] }[] = [
  { id: 'superadmin', label: 'Super Admin', desc: 'Everything, including managing admins and server settings.', defaultPerms: ['all'] },
  { id: 'league_admin', label: 'League Admin', desc: 'Teams, matches, games, community, Fan Spaces and programmes.', defaultPerms: ['leagues', 'matches', 'teams', 'contests', 'fantasy', 'games', 'notifications', 'fanspaces', 'growth', 'community'] },
  { id: 'contest_admin', label: 'Games Admin', desc: 'Predictions, quizzes and Pick XI scoring.', defaultPerms: ['contests', 'fantasy', 'games'] },
  { id: 'winner_admin', label: 'Prizes Admin', desc: 'Prize catalogue, claims and prize draws.', defaultPerms: ['winners', 'draws', 'prizes'] },
  { id: 'social_admin', label: 'Social & Community', desc: 'Official handles, feeds, approvals, forum moderation and polls.', defaultPerms: ['feeds', 'social', 'community'] },
  { id: 'team_official', label: 'Team Official', desc: 'One franchise only, in its team portal: its page, squad, channels, posts, prizes for its fans, polls, forum and fan messages.', defaultPerms: TEAM_OFFICIAL_PERMS },
  { id: 'custom', label: 'Custom Role', desc: 'Pick individual permissions.', defaultPerms: ['matches'] },
];

export const AdminsSection: React.FC<AdminsSectionProps> = ({ currentUserEmail, isCurrentUserSuperAdmin, teams }) => {
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [superAdminEmail, setSuperAdminEmail] = useState<string>('solarastra.in@gmail.com');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdminEmail, setEditingAdminEmail] = useState<string | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<AdminRole>('league_admin');
  const [formPermissions, setFormPermissions] = useState<AdminPermission[]>(['leagues', 'matches']);
  const [formTeamId, setFormTeamId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAdmins();
      setAdmins(res.admins || []);
      if (res.superAdminEmail) setSuperAdminEmail(res.superAdminEmail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load administrator accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const openAddModal = () => {
    setEditingAdminEmail(null);
    setFormEmail('');
    setFormName('');
    setFormRole('league_admin');
    setFormPermissions(['leagues', 'matches']);
    setFormTeamId('');
    setIsModalOpen(true);
  };

  const openEditModal = (admin: AdminUserRecord) => {
    setEditingAdminEmail(admin.email);
    setFormEmail(admin.email);
    setFormName(admin.name || '');
    setFormRole(admin.role || 'custom');
    setFormPermissions(admin.permissions || []);
    setFormTeamId(admin.teamId || '');
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole: AdminRole) => {
    setFormRole(newRole);
    const preset = ROLE_PRESETS.find(p => p.id === newRole);
    if (preset && newRole !== 'custom') {
      setFormPermissions([...preset.defaultPerms]);
    }
  };

  const togglePermission = (perm: AdminPermission) => {
    setFormPermissions(prev => {
      const next = prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm];
      return next;
    });
    if (formRole !== 'team_official') setFormRole('custom');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formEmail.trim())) {
      setError('Please provide a valid email address.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isSuper = formRole === 'superadmin';
      if (formRole === 'team_official' && !formTeamId) {
        setError('Choose the team this official manages.');
        setSaving(false);
        return;
      }
      const res = await api.saveAdmin({
        email: formEmail.trim().toLowerCase(),
        name: formName.trim() || undefined,
        role: formRole,
        permissions: isSuper ? ['all'] : formPermissions,
        teamId: formRole === 'team_official' ? formTeamId : null,
      });
      setAdmins(res.admins || []);
      setSuccessMsg(`Admin permissions for ${formEmail.trim()} updated successfully.`);
      setIsModalOpen(false);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save admin user.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (email: string) => {
    if (email.toLowerCase() === superAdminEmail.toLowerCase()) {
      alert(`Cannot remove Super Admin (${superAdminEmail}).`);
      return;
    }
    if (!confirm(`Are you sure you want to revoke admin privileges for ${email}?`)) return;

    try {
      const res = await api.deleteAdmin(email);
      setAdmins(res.admins || []);
      setSuccessMsg(`Revoked admin access for ${email}.`);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove admin.');
    }
  };

  const getRoleBadge = (role: AdminRole, isSuper?: boolean) => {
    if (isSuper || role === 'superadmin') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-400 text-slate-950 border border-amber-300 shadow-sm">
          <Sparkles className="w-3 h-3" /> Super Admin
        </span>
      );
    }
    switch (role) {
      case 'league_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
            <Shield className="w-3 h-3" /> League Admin
          </span>
        );
      case 'contest_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <ShieldCheck className="w-3 h-3" /> Contest Admin
          </span>
        );
      case 'winner_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <Key className="w-3 h-3" /> Winner Admin
          </span>
        );
      case 'team_official':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
            <Users className="w-3 h-3" /> Team Official
          </span>
        );
      case 'social_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
            <Users className="w-3 h-3" /> Social Admin
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700/60 text-slate-200 border border-slate-600">
            Custom RBAC
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/30">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-white">Role-Based Access Control (RBAC)</h2>
                <p className="text-xs sm:text-sm text-slate-300">
                  Granular administrative permissions for Leagues, Contests, Winners, Social Feeds, and System Settings.
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-400">Master Super Admin:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 font-mono text-xs font-bold">
                {superAdminEmail}
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <Check className="w-3 h-3" /> Protected Account
              </span>
            </div>
          </div>
          <Button variant="primary" onClick={openAddModal} className="shrink-0 flex items-center gap-1.5 font-bold">
            <UserPlus className="w-4 h-4" /> Add Admin
          </Button>
        </div>
      </div>

      {isCurrentUserSuperAdmin && <TeamInvitesPanel teams={teams} />}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Role Preset Information Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLE_PRESETS.filter(p => p.id !== 'custom').map(preset => (
          <div key={preset.id} className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-black text-white">{preset.label}</span>
                {getRoleBadge(preset.id, preset.id === 'superadmin')}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{preset.desc}</p>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <span>Authorized Modules:</span>
              <span className="font-bold text-amber-300">
                {preset.id === 'superadmin' ? 'All' : preset.id === 'team_official' ? 'Own team' : `${preset.defaultPerms.length} areas`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Admin Users Table */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Active Portal Administrators</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
              {admins.length}
            </span>
          </div>
          <button
            onClick={loadAdmins}
            disabled={loading}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {loading && admins.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading administrator records…</div>
        ) : admins.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No administrators configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Admin</th>
                  <th className="py-3 px-4">Role Tier</th>
                  <th className="py-3 px-4">Granted Permissions</th>
                  <th className="py-3 px-4">Added</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {admins.map(admin => {
                  const isSuper = admin.isSuperAdmin || admin.email.toLowerCase() === superAdminEmail.toLowerCase();
                  const perms = admin.permissions || [];
                  const isAll = perms.includes('all') || isSuper;

                  return (
                    <tr key={admin.email} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${isSuper ? 'bg-amber-400 text-slate-950 font-black' : 'bg-slate-800 text-slate-200'}`}>
                            {admin.name ? admin.name[0].toUpperCase() : admin.email[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {admin.name || admin.email.split('@')[0]}
                              {isSuper && (
                                <span className="text-[10px] text-amber-400 bg-amber-400/10 px-1.5 py-0.2 rounded border border-amber-400/30 font-black">
                                  MASTER
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">{admin.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {getRoleBadge(admin.role, isSuper)}
                        {admin.role === 'team_official' && <div className="text-[10px] text-slate-400 mt-1">{teams.find(t => t.id === admin.teamId)?.name || 'No team set'}</div>}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        {isAll ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/30 font-black text-[10px]">
                            ★ Full access
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 flex-wrap">
                            {perms.map(p => {
                              const meta = ALL_PERMISSIONS.find(m => m.id === p);
                              return (
                                <span
                                  key={p}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${meta?.color || 'bg-slate-800 text-slate-300 border-slate-700'}`}
                                >
                                  {meta?.label || p}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                        <div>{admin.addedAt ? new Date(admin.addedAt).toLocaleDateString() : 'Initial Setup'}</div>
                        {admin.addedBy && <div className="text-[10px] text-slate-500">by {admin.addedBy}</div>}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(admin)}
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
                            title="Edit permissions"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isSuper ? (
                            <button
                              disabled
                              className="p-1.5 rounded-lg text-slate-600 cursor-not-allowed"
                              title="Super Admin cannot be deleted"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDelete(admin.email)}
                              className="p-1.5 rounded-lg bg-slate-800 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
                              title="Revoke access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Admin Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl text-slate-100 max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <span className="p-2 rounded-xl bg-amber-400/20 text-amber-400 border border-amber-400/40">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-black text-white">
                  {editingAdminEmail ? 'Edit Administrator RBAC' : 'Add New Administrator'}
                </h3>
                <p className="text-xs text-slate-300">Configure role tiers and exact administrative privileges</p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <Field label="Google Account Email">
                <TextInput
                  type="email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  placeholder="name@email.com"
                  disabled={!!editingAdminEmail}
                  required
                />
              </Field>

              <Field label="Display Name / Title (optional)">
                <TextInput
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. League Operations Lead"
                />
              </Field>

              <Field label="Administrative Role Preset">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  {ROLE_PRESETS.map(preset => {
                    const isSelected = formRole === preset.id;
                    const isSuperEmail = formEmail.trim().toLowerCase() === superAdminEmail.toLowerCase();
                    const disabled = preset.id === 'superadmin' && !isCurrentUserSuperAdmin && !isSuperEmail;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleRoleChange(preset.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-400/15 border-amber-400 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">{preset.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">{preset.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </Field>

              {formRole === 'team_official' && (
                <Field label="Team">
                  <Select value={formTeamId} onChange={e => setFormTeamId(e.target.value)} required>
                    <option value="">Choose a team…</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </Field>
              )}

              {formRole !== 'superadmin' && formRole !== 'team_official' && (
                <Field label="Granular Permissions">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5 p-3 rounded-2xl bg-slate-950 border border-slate-800 max-h-56 overflow-y-auto">
                    {ALL_PERMISSIONS.map(perm => {
                      const active = formPermissions.includes(perm.id) || formPermissions.includes('all');
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-start gap-2.5 p-2 rounded-xl border cursor-pointer transition-colors ${
                            active
                              ? 'bg-slate-900 border-amber-400/40 text-white'
                              : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => togglePermission(perm.id)}
                            className="mt-0.5 rounded text-amber-500 focus:ring-amber-400 bg-slate-800 border-slate-700"
                          />
                          <div>
                            <span className="font-bold text-xs block text-slate-200">{perm.label}</span>
                            <span className="text-[10px] text-slate-400 block leading-tight">{perm.desc}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </Field>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : editingAdminEmail ? 'Save Permissions' : 'Grant Admin Privileges'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
