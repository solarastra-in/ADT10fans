import React, { useEffect, useState } from 'react';
import { Award, CalendarCheck, Crown, Flame, Gamepad2, Gift, LogOut, MessageSquare, MessagesSquare, Search, Target, Trash2, Trophy, UserPlus, Users, Zap } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, navigate, usePageMeta } from '../router';
import { Avatar, Button, Card, EmptyState, ErrorBox, Field, PageHeader, Pill, SectionTitle, Spinner, StatTile, TeamBadge, cx, inputCls, useFormat } from '../components/ui';
import { InviteCard } from '../components/InviteCard';
import { PointsHistory } from '../components/PointsHistory';

const ICONS: Record<string, React.FC<{ className?: string }>> = { Target, Award, Users, CalendarCheck, Trophy, Gamepad2, Search, Flame, MessageSquare, MessagesSquare, UserPlus, Zap, Crown, Gift };

export default function ProfilePage() {
  const { user, setUser, teamById, openAuth, openTeamPicker, logout, toast, config } = useApp();
  const t = useT();
  const f = useFormat();
  usePageMeta(t('My profile'), undefined, config?.brandName);
  const { data, error, loading, reload } = useLoad(() => (user ? api.getProfile() : Promise.resolve(null)), [user?.id]);
  const [form, setForm] = useState({ name: '', avatar: '', country: '', city: '', bio: '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (user) setForm({ name: user.name || '', avatar: user.avatar || '', country: user.country || '', city: user.city || '', bio: user.bio || '' });
  }, [user?.id]);

  if (!user)
    return (
      <EmptyState
        icon={<Trophy className="w-6 h-6" />}
        title={t('Your fan profile')}
        body={t('Sign in to track your points, badges, Dream XI history, prize claims and Fan Space passes.')}
        action={<Button onClick={() => openAuth()}>{t('Sign in')}</Button>}
      />
    );
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const team = teamById(user.teamId);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.updateProfile(form);
      setUser(r.user);
      toast(t('Profile saved'));
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };
  const claim = async (id: string) => {
    try {
      const r = await api.claimBadge(id);
      setUser(r.user);
      toast(t('+{n} points', { n: r.pointsAdded }));
      reload();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const del = async () => {
    if (prompt(t('This deletes your account, points and entries. Type DELETE to confirm.')) !== 'DELETE') return;
    try {
      await api.deleteAccount();
      await logout();
      toast(t('Your account has been deleted'));
      navigate('/');
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t('My profile')} />
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <Avatar name={user.name} src={user.avatar} size={72} />
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-white truncate">{user.name}</h2>
          <p className="text-sm text-slate-400 truncate">{user.email}</p>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {team ? (
              <Link to={`/teams/${team.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-white">
                <TeamBadge team={team} size="sm" /> {team.name}
              </Link>
            ) : (
              <Button size="sm" onClick={openTeamPicker}>{t('Choose your team')}</Button>
            )}
            {team && (user.teamChanges || 0) < 1 && <button type="button" onClick={openTeamPicker} className="text-xs text-slate-400 underline">{t('Switch team')}</button>}
            {user.role === 'admin' && <Pill tone="amber">{user.adminRole === 'team_official' ? t('Team official') : t('Admin')}</Pill>}
          </div>
        </div>
        <Button variant="ghost" onClick={async () => { await logout(); navigate('/'); }}>
          <LogOut className="w-4 h-4" /> {t('Sign out')}
        </Button>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label={t('Season points')} value={user.points} accent />
        <StatTile label={t('To spend')} value={user.balance ?? user.points} />
        <StatTile label={t('Check-in streak')} value={t('{n} days', { n: user.streak || 0 })} />
        <StatTile label={t('Badges')} value={`${data.stats.totalBadgesUnlocked}/${data.badges.length}`} />
      </div>

      <section id="points" className="scroll-mt-24">
        <SectionTitle title={t('Points history')} action={<Link to="/rules" className="text-xs font-bold text-amber-400">{t('How points work')}</Link>} />
        <PointsHistory />
      </section>

      <InviteCard />

      <section>
        <SectionTitle title={t('Badges')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.badges.map(b => {
            const Icon = ICONS[b.icon] || Award;
            return (
              <Card key={b.id} className={cx('p-4 flex gap-3', !b.unlocked && 'opacity-60')} data-testid="badge">
                <span className={cx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', b.unlocked ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-500')}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{t(b.name)}</p>
                  <p className="text-xs text-slate-400">{t(b.requirement)}</p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: `${(b.currentProgress / b.maxProgress) * 100}%` }} />
                  </div>
                  {b.unlocked && !b.claimed && (
                    <Button size="sm" className="mt-2" onClick={() => claim(b.id)}>{t('Claim {n} points', { n: b.rewardPoints })}</Button>
                  )}
                  {b.claimed && <p className="text-[11px] text-emerald-400 mt-1">{t('Reward claimed')}</p>}
                  {!b.unlocked && <Link to={b.link} className="text-[11px] text-amber-400 mt-1 inline-block">{t('Go')} →</Link>}
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle title={t('My season')} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label={t('Dream XI points')} value={data.fantasy.points} />
          <StatTile label={t('Best Dream XI')} value={data.fantasy.best} />
          <StatTile label={t('Predictions entered')} value={data.stats.contestsEntered} />
          <StatTile label={t('Daily games played')} value={data.games.played} />
          <StatTile label={t('Players guessed')} value={data.games.guessSolved} />
          <StatTile label={t('Best Super Over')} value={data.games.bestSuperOver} />
          <StatTile label={t('Forum threads')} value={data.stats.forumThreads} />
          <StatTile label={t('Friends invited')} value={data.stats.friendsInvited} />
        </div>
        {data.fantasyHistory.length > 0 && (
          <Card className="mt-3 divide-y divide-slate-800">
            {data.fantasyHistory.map(h => (
              <Link key={h.matchId} to={`/fantasy/${h.matchId}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-800/40">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="flex-1 text-sm text-white">{t('Match {n}', { n: h.matchNo ?? '' })}: {teamById(h.teamA)?.short} v {teamById(h.teamB)?.short}</span>
                <span className="text-sm font-black text-amber-400">{h.scored ? `${h.points} · #${h.rank}` : t('Pending')}</span>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {(data.redemptions.length > 0 || data.bookings.length > 0) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.redemptions.length > 0 && (
            <div>
              <SectionTitle title={t('Prize claims')} action={<Link to="/prizes" className="text-xs font-bold text-amber-400">{t('Prizes')}</Link>} />
              <Card className="divide-y divide-slate-800">
                {data.redemptions.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <span className="flex-1 truncate text-white">{r.prizeTitle}</span>
                    <span className="font-mono text-xs text-slate-400">{r.code}</span>
                    <Pill tone={r.status === 'fulfilled' ? 'green' : r.status === 'cancelled' ? 'red' : 'amber'}>{t(r.status === 'pending' ? 'Pending' : r.status === 'fulfilled' ? 'Fulfilled' : 'Cancelled')}</Pill>
                  </div>
                ))}
              </Card>
            </div>
          )}
          {data.bookings.length > 0 && (
            <div>
              <SectionTitle title={t('Fan Space passes')} action={<Link to="/fanspaces" className="text-xs font-bold text-amber-400">{t('Show QR')}</Link>} />
              <Card className="divide-y divide-slate-800">
                {data.bookings.map(b => (
                  <div key={b.id} className="flex items-center gap-2 px-4 py-2.5 text-sm">
                    <span className="flex-1 truncate text-white">{b.spaceName}</span>
                    <span className="text-xs text-slate-400">{f.date(b.date + 'T12:00:00')}</span>
                    {b.cancelledAt ? <Pill tone="red">{t('Cancelled')}</Pill> : b.checkedInAt ? <Pill tone="green">{t('Used')}</Pill> : <Pill>{t('Valid')}</Pill>}
                  </div>
                ))}
              </Card>
            </div>
          )}
        </section>
      )}

      <section id="details" className="scroll-mt-24">
        <SectionTitle title={t('Profile details')} />
        <Card as="form" className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3" onSubmit={save}>
          <Field label={t('Display name')}>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} minLength={2} maxLength={40} required />
          </Field>
          <Field label={t('Photo link (https://)')} hint={t('Optional. Leave empty to show your initials.')}>
            <input value={form.avatar} onChange={e => setForm({ ...form, avatar: e.target.value })} className={inputCls} type="url" placeholder="https://" />
          </Field>
          <Field label={t('Country')} hint={t('Optional. Shown on the Fan Base page.')}>
            <input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} className={inputCls} maxLength={56} list="countries" />
          </Field>
          <Field label={t('City')}>
            <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inputCls} maxLength={56} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('About you')}>
              <textarea value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} className={`${inputCls} min-h-[80px]`} maxLength={280} />
            </Field>
          </div>
          <datalist id="countries">
            {['United Arab Emirates', 'India', 'Pakistan', 'Sri Lanka', 'Bangladesh', 'Afghanistan', 'United Kingdom', 'West Indies', 'Saudi Arabia', 'Oman', 'Qatar', 'Kuwait', 'Bahrain', 'Canada', 'United States', 'Australia', 'New Zealand', 'South Africa', 'Nepal'].map(c => <option key={c} value={c} />)}
          </datalist>
          <div className="sm:col-span-2 flex flex-wrap gap-2 justify-between">
            <Button type="submit" loading={saving}>{t('Save profile')}</Button>
            <Button variant="danger" onClick={del}><Trash2 className="w-4 h-4" /> {t('Delete account')}</Button>
          </div>
        </Card>
      </section>
    </div>
  );
}
