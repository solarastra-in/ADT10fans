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
  const [badgeFilter, setBadgeFilter] = useState<'all' | 'unlocked' | 'locked'>('all');
  useEffect(() => {
    if (user) setForm({ name: user.name || '', avatar: user.avatar || '', country: user.country || '', city: user.city || '', bio: user.bio || '' });
  }, [user?.id]);

  if (!user)
    return (
      <EmptyState
        icon={<Trophy className="w-6 h-6" />}
        title={t('Your fan profile')}
        body={t('Sign in to track your points, badges, Pick XI history, prize claims and Fan Space passes.')}
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

  const filteredBadges = (data?.badges || []).filter(b => {
    if (badgeFilter === 'unlocked') return b.unlocked;
    if (badgeFilter === 'locked') return !b.unlocked;
    return true;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <PageHeader title={t('My Profile')} subtitle={t('Manage your fan profile, track badges, claim rewards, and review your fantasy and daily game performance.')} />
        <Button
          variant="danger"
          className="shrink-0 self-start sm:self-auto flex items-center gap-2"
          onClick={async () => {
            await logout();
            toast(t('You have been signed out.'));
            navigate('/');
          }}
        >
          <LogOut className="w-4 h-4" /> {t('Sign Out / Logout')}
        </Button>
      </div>

      {/* Quick Navigation Sticky Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label={t('Profile Sections')}>
        <a href="#overview" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0">
          {t('Overview')}
        </a>
        <a href="#details" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300 hover:bg-slate-800 shrink-0 flex items-center gap-1.5">
          ✏️ {t('Update Profile & Avatar')}
        </a>
        <a href="#badges" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0 flex items-center gap-1.5">
          🏅 {t('Badges ({n})', { n: data.stats.totalBadgesUnlocked })}
        </a>
        <a href="#points" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0">
          🪙 {t('Points History')}
        </a>
        <a href="#season" className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 hover:text-white shrink-0">
          🏆 {t('My Season')}
        </a>
      </div>

      <Card id="overview" className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 scroll-mt-24">
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
        <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => {
              const el = document.getElementById('details');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('Edit Profile Details')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await logout();
              toast(t('You have been signed out.'));
              navigate('/');
            }}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
          >
            <LogOut className="w-4 h-4" /> {t('Sign out')}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatTile label={t('Season points')} value={user.points} accent />
        <StatTile label={t('To spend')} value={user.balance ?? user.points} />
        <StatTile label={t('Check-in streak')} value={t('{n} days', { n: user.streak || 0 })} />
        <StatTile label={t('Badges unlocked')} value={`${data.stats.totalBadgesUnlocked}/${data.badges.length}`} />
      </div>

      <section id="badges" className="scroll-mt-24 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <SectionTitle
            title={t('Badges & Milestones')}
            action={
              <span className="text-xs font-bold text-slate-400">
                {t('{unlocked} of {total} unlocked', { unlocked: data.stats.totalBadgesUnlocked, total: data.badges.length })}
              </span>
            }
          />
          <div className="flex items-center gap-1 self-start sm:self-auto bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setBadgeFilter('all')}
              className={cx('px-2.5 py-1 rounded-lg font-bold transition-colors', badgeFilter === 'all' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
            >
              {t('All ({n})', { n: data.badges.length })}
            </button>
            <button
              type="button"
              onClick={() => setBadgeFilter('unlocked')}
              className={cx('px-2.5 py-1 rounded-lg font-bold transition-colors', badgeFilter === 'unlocked' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
            >
              {t('Unlocked ({n})', { n: data.badges.filter(b => b.unlocked).length })}
            </button>
            <button
              type="button"
              onClick={() => setBadgeFilter('locked')}
              className={cx('px-2.5 py-1 rounded-lg font-bold transition-colors', badgeFilter === 'locked' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white')}
            >
              {t('In Progress ({n})', { n: data.badges.filter(b => !b.unlocked).length })}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredBadges.map(b => {
            const Icon = ICONS[b.icon] || Award;
            return (
              <Card key={b.id} className={cx('p-4 flex gap-3 transition-colors', !b.unlocked && 'opacity-65')} data-testid="badge">
                <span className={cx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', b.unlocked ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500')}>
                  <Icon className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-bold text-white text-sm truncate">{t(b.name)}</p>
                    <span className="text-[10px] font-bold text-amber-400 shrink-0">+{b.rewardPoints} pts</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{t(b.requirement)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full bg-amber-400 transition-all" style={{ width: `${Math.min(100, (b.currentProgress / b.maxProgress) * 100)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-mono">{b.currentProgress}/{b.maxProgress}</span>
                    {b.unlocked && !b.claimed && (
                      <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => claim(b.id)}>{t('Claim +{n}', { n: b.rewardPoints })}</Button>
                    )}
                    {b.claimed && <span className="text-emerald-400 font-bold">{t('Claimed ✓')}</span>}
                    {!b.unlocked && <Link to={b.link} className="text-amber-400 font-bold hover:underline">{t('Play now')} →</Link>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="points" className="scroll-mt-24">
        <SectionTitle title={t('Points history')} action={<Link to="/rules" className="text-xs font-bold text-amber-400">{t('How points work')}</Link>} />
        <PointsHistory />
      </section>

      <InviteCard />

      <section id="season" className="scroll-mt-24">
        <SectionTitle title={t('My season')} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label={t('Pick XI points')} value={data.fantasy.points} />
          <StatTile label={t('Best Pick XI')} value={data.fantasy.best} />
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
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-400">{t('Match {n}', { n: h.matchNo ?? '' })}:</span>
                  <TeamBadge team={teamById(h.teamA)} size="sm" />
                  <span className="text-xs font-bold text-white">{teamById(h.teamA)?.name}</span>
                  <span className="text-amber-400 font-bold text-xs">v</span>
                  <TeamBadge team={teamById(h.teamB)} size="sm" />
                  <span className="text-xs font-bold text-white">{teamById(h.teamB)?.name}</span>
                </div>
                <span className="text-sm font-black text-amber-400 shrink-0">{h.scored ? `${h.points} · #${h.rank}` : t('Pending')}</span>
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
