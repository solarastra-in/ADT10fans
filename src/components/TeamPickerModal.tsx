import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { ErrorBox, Modal, Notice, TeamBadge, cx } from './ui';

export function TeamPickerModal() {
  const { teamPickerOpen, closeTeamPicker, teams, user, setUser, openAuth, toast, refreshTeams } = useApp();
  const t = useT();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = Boolean(user?.teamId && (user.teamChanges || 0) >= 1);

  const pick = async (teamId: string) => {
    if (!user) {
      closeTeamPicker();
      openAuth(t('Sign in to back a team. Your points count for them in Fan Wars.'));
      return;
    }
    if (teamId === user.teamId) return closeTeamPicker();
    setSaving(teamId);
    setError(null);
    try {
      const r = await api.selectTeam(teamId);
      setUser(r.user);
      toast(t('You now back {team}!', { team: teams.find(x => x.id === teamId)?.name || '' }));
      refreshTeams().catch(() => undefined);
      closeTeamPicker();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal open={teamPickerOpen} onClose={closeTeamPicker} title={t('Choose your team')} wide>
      <div className="space-y-3" data-testid="team-picker">
        <p className="text-sm text-slate-300">{t('Your points count for the team you back in Fan Wars. You can switch once during the season.')}</p>
        {user?.teamId && !locked && <Notice tone="warn">{t('You have one switch left this season.')}</Notice>}
        {locked && <Notice tone="warn">{t('You have already switched team once this season.')}</Notice>}
        {error && <ErrorBox message={error} />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {teams.map(team => {
            const mine = user?.teamId === team.id;
            return (
              <button
                key={team.id}
                type="button"
                disabled={Boolean(saving) || (locked && !mine)}
                onClick={() => pick(team.id)}
                className={cx('flex items-center gap-3 p-3 rounded-2xl border text-start transition-colors min-h-[64px] disabled:opacity-50', mine ? 'border-amber-400 bg-amber-400/10' : 'border-slate-800 bg-slate-950/60 hover:border-slate-600')}
                data-team={team.id}
              >
                <TeamBadge team={team} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-white truncate">{team.name}</span>
                  <span className="block text-xs text-slate-400">{t('{n} fans', { n: team.fans || 0 })}</span>
                </span>
                {mine && <Check className="w-5 h-5 text-amber-400" />}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
