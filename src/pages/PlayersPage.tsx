import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useApp } from '../state';
import { useT } from '../i18n';
import { usePageMeta } from '../router';
import { playerLinkProps } from '../components/PlayerCard';
import { Avatar, PageHeader, Pill, Tabs, inputCls, ROLE_LABEL } from '../components/ui';

export default function PlayersPage() {
  const { teams, config, teamById } = useApp();
  const t = useT();
  usePageMeta(t('{season} players', { season: config?.seasonLabel || 'Abu Dhabi T10' }), t('Every player in the six squads, by team and role.'), config?.brandName);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('all');
  const [team, setTeam] = useState('all');
  const all = useMemo(() => teams.flatMap(x => x.squad), [teams]);
  const list = all
    .filter(p => (role === 'all' || p.role === role) && (team === 'all' || p.teamId === team) && (!q.trim() || p.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => Number(b.isIcon) - Number(a.isIcon) || (a.category === 'Platinum' ? -1 : 0) - (b.category === 'Platinum' ? -1 : 0) || a.name.localeCompare(b.name));
  return (
    <div>
      <PageHeader eyebrow={config?.seasonLabel} title={t('Players')} subtitle={t('{n} players across six squads.', { n: all.length })} />
      <div className="space-y-3 mb-5">
        <label className="relative block">
          <span className="sr-only">{t('Search players')}</span>
          <Search className="w-4 h-4 text-slate-500 absolute start-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search players')} className={`${inputCls} ps-9`} type="search" />
        </label>
        <Tabs value={role} onChange={setRole} items={[{ id: 'all', label: t('All roles') }, ...Object.entries(ROLE_LABEL).map(([id, label]) => ({ id, label: t(label) }))]} />
        <Tabs value={team} onChange={setTeam} items={[{ id: 'all', label: t('All teams') }, ...teams.map(x => ({ id: x.id, label: x.short }))]} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {list.map(p => {
          const tm = teamById(p.teamId);
          return (
            <a key={p.id} {...playerLinkProps(p.id)} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-600">
              <Avatar name={p.name} src={p.photoUrl} size={44} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-white truncate">{p.name}</span>
                <span className="block text-[11px] text-slate-400 truncate">
                  <span className="inline-block w-2 h-2 rounded-full me-1 align-middle" style={{ background: tm?.color }} />
                  {tm?.name} · {t(ROLE_LABEL[p.role])}
                </span>
              </span>
              {p.category && <Pill tone={p.category === 'Icon' ? 'amber' : 'blue'}>{t(p.category)}</Pill>}
            </a>
          );
        })}
      </div>
      {!list.length && <p className="text-sm text-slate-400 text-center py-10">{t('No players match.')}</p>}
    </div>
  );
}
