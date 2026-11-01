import React, { useEffect, useRef, useState } from 'react';
import { Award, CalendarDays, ChevronDown, Coins, Gamepad2, Home, LayoutGrid, LogIn, LogOut, QrCode, Settings, Share2, Shield, Languages, User, X } from 'lucide-react';
import { Link, navigate, Route, RouteName } from '../router';
import { useApp } from '../state';
import { LANGUAGES, useI18n, useT } from '../i18n';
import { NotificationCenter } from './NotificationCenter';
import { Avatar, Button, cx } from './ui';

export function BrandMark({ compact }: { compact?: boolean }) {
  const { config } = useApp();
  return (
    <Link to="/" className="inline-flex items-center gap-2.5 min-h-[44px] shrink-0 group" aria-label={config?.brandName || 'ADT10 Fans'}>
      <img
        src="/logos/adt10.png"
        alt="Abu Dhabi T10"
        className="w-10 h-10 object-contain rounded-xl p-0.5 bg-slate-900/90 border border-amber-500/40 shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform"
      />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-black text-white tracking-tight group-hover:text-amber-300 transition-colors">{config?.brandName || 'ADT10 Fans'}</span>
          <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-400/90">{config?.seasonLabel || 'Abu Dhabi T10'}</span>
        </span>
      )}
    </Link>
  );
}

const SECTION_OF: Partial<Record<RouteName, string>> = {
  home: 'home', matches: 'matches', match: 'matches', teams: 'teams', team: 'teams', players: 'teams', player: 'teams',
  social: 'social', videos: 'social', news: 'social', play: 'play', fantasy: 'play', fantasyMatch: 'play', games: 'play', contests: 'play',
  prizes: 'prizes', leaderboard: 'fans', fans: 'fans', forum: 'forum', thread: 'forum', fanspaces: 'fanspaces', profile: 'profile', admin: 'admin',
  duel: 'play', fanwall: 'fanwall', fanPost: 'fanwall', teamGames: 'play', pick5: 'play', fanclub: 'play', adminFanclub: 'admin',
};

export function LanguagePicker({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const t = useT();
  return (
    <label className={cx('relative inline-flex items-center', className)}>
      <span className="sr-only">{t('Language')}</span>
      <Languages className="w-4 h-4 text-slate-400 absolute start-2.5 pointer-events-none" />
      <select value={lang} onChange={e => setLang(e.target.value as any)} className="min-h-[40px] ps-8 pe-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 appearance-none" data-testid="lang-select">
        {LANGUAGES.map(l => (
          <option key={l.code} value={l.code}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  );
}

export function UserDropdown() {
  const { user, logout, openTeamPicker, openQrPass, teamById, toast } = useApp();
  const t = useT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  if (!user) return null;
  const team = teamById(user.teamId);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    toast(t('You have been signed out.'));
    navigate('/');
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 min-h-[44px] ps-1 pe-2 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
        data-testid="profile-link"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Avatar name={user.name} src={user.avatar} size={32} />
        <span className="hidden md:block text-start leading-tight">
          <span className="block text-xs font-bold text-white max-w-[120px] truncate">{user.name}</span>
          <span className="block text-[11px] text-amber-400 font-bold tabular-nums">{t('{n} pts', { n: user.points })}</span>
        </span>
        <ChevronDown className={cx('w-3.5 h-3.5 text-slate-400 transition-transform duration-200 hidden sm:block', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl p-2 z-50 text-start"
        >
          {/* User brief */}
          <div className="p-2.5 pb-3 border-b border-slate-800 mb-1">
            <p className="font-bold text-white text-sm truncate">{user.name}</p>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
            {user.instagramHandle && (
              <div className="mt-1.5 flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300">
                <span className="flex items-center gap-1 font-bold truncate">
                  <svg className="w-3 h-3 fill-current text-pink-400 shrink-0" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
                  </svg>
                  {user.instagramHandle}
                </span>
                <span className="text-[10px] font-black text-emerald-400 shrink-0">✓ Verified</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-bold text-amber-400 tabular-nums">{t('{n} points', { n: user.points })}</span>
              {team ? (
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: team.color }} />
                  {team.short || team.name}
                </span>
              ) : (
                <button type="button" onClick={() => { setOpen(false); openTeamPicker(); }} className="text-[11px] text-amber-400 font-bold hover:underline">
                  {t('Pick team')}
                </button>
              )}
            </div>
          </div>

          {/* Quick Navigation Links */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openQrPass();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-black text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 transition-colors text-start"
              role="menuitem"
            >
              <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('Matchday QR Pass')}</span>
              <span className="ms-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">+100 pts</span>
            </button>
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80"
              role="menuitem"
            >
              <User className="w-4 h-4 text-slate-400" />
              {t('My Profile & Stats')}
            </Link>
            <Link
              to="/profile#details"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80"
              role="menuitem"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              {t('Update Profile Details')}
            </Link>
            <Link
              to="/profile#badges"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80"
              role="menuitem"
            >
              <Award className="w-4 h-4 text-amber-400" />
              {t('Badges & Achievements')}
            </Link>
            <Link
              to="/profile#points"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80"
              role="menuitem"
            >
              <Coins className="w-4 h-4 text-emerald-400" />
              {t('Points History')}
            </Link>
            <Link
              to="/games"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800/80"
              role="menuitem"
            >
              <Gamepad2 className="w-4 h-4 text-sky-400" />
              {t('Daily Games')}
            </Link>
            {user.role === 'admin' && (user.adminRole === 'team_official' || user.isSuperAdmin) && (
              <Link
                to="/team-portal"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-slate-800/80"
                role="menuitem"
              >
                <Shield className="w-4 h-4 text-amber-400" />
                {t('Team portal')}
              </Link>
            )}
            {user.role === 'admin' && user.adminRole !== 'team_official' && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-amber-300 hover:text-amber-200 hover:bg-slate-800/80"
                role="menuitem"
              >
                <Shield className="w-4 h-4 text-amber-400" />
                {t('Admin Console')}
              </Link>
            )}
          </div>

          {/* Quick Logout Action */}
          <div className="pt-1.5 mt-1.5 border-t border-slate-800">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
              role="menuitem"
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              {t('Log Out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({ route }: { route: Route }) {
  const { user, openAuth, openQrPass, openInstaModal, config } = useApp();
  const t = useT();
  const current = SECTION_OF[route.name];
  const targetHandle = config?.instagramTargetHandle || '@ArabianAcesofficial';
  const hasInstaFollowed = Boolean(user?.instagramFollowed || (typeof window !== 'undefined' && localStorage.getItem('aces_instagram_verified') === 'true'));
  const storedHandle = (typeof window !== 'undefined' ? localStorage.getItem('aces_instagram_handle') : null) || user?.instagramHandle || targetHandle;

  const links: [string, string, string][] = [
    ['/matches', t('Matches'), 'matches'],
    ['/teams', t('Teams'), 'teams'],
    ['/play', t('Play'), 'play'],
    ['/social', t('Social'), 'social'],
    ['/forum', t('Forum'), 'forum'],
    ['/fanwall', t('Fan wall'), 'fanwall'],
    ['/prizes', t('Prizes'), 'prizes'],
    ['/fans', t('Fans'), 'fans'],
  ];
  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-slate-900 pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
        <BrandMark />
        <nav aria-label={t('Main')} className="hidden lg:flex items-center gap-1 ms-4">
          {links.map(([to, label, key]) => (
            <Link key={to} to={to} className={cx('px-3 min-h-[40px] inline-flex items-center rounded-xl text-sm font-bold', current === key ? 'text-amber-300 bg-amber-400/10' : 'text-slate-300 hover:text-white hover:bg-slate-900')} aria-current={current === key ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5 sm:gap-2">
          {/* Instagram Follow / Verified Status */}
          {hasInstaFollowed ? (
            <button
              type="button"
              onClick={openInstaModal}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 text-[11px] font-bold text-pink-300 transition-colors"
              title="Instagram Verified Fan"
            >
              <svg className="w-3.5 h-3.5 fill-current text-pink-400" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
              </svg>
              <span className="truncate max-w-[100px]">{storedHandle}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </button>
          ) : (
            <button
              type="button"
              onClick={openInstaModal}
              className="inline-flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-500/20 hover:from-pink-500/30 hover:to-rose-500/30 text-pink-300 border border-pink-500/40 text-xs font-black transition-all shadow-sm shadow-pink-500/10 active:scale-95"
              title={`Follow ${targetHandle} on Instagram`}
            >
              <svg className="w-3.5 h-3.5 fill-current text-pink-400" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
              </svg>
              <span className="hidden sm:inline">Follow Aces</span>
              <span className="text-[10px] bg-pink-500/30 text-pink-200 px-1.5 py-0.5 rounded font-black">+25 pts</span>
            </button>
          )}

          {/* Quick Matchday Pass QR button - easily accessible from top nav */}
          <button
            type="button"
            onClick={openQrPass}
            className="inline-flex items-center gap-1.5 min-h-[38px] px-2.5 sm:px-3 rounded-xl bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 text-xs font-black transition-all shadow-sm shadow-amber-500/10 active:scale-95"
            title={t('Open Matchday Fan Pass QR Code')}
            data-testid="header-qr-pass-btn"
          >
            <QrCode className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">{t('My QR Pass')}</span>
            <span className="sm:hidden text-[11px] font-bold">QR</span>
          </button>
          {/* On phones the language picker lives in the "More" sheet. */}
          <div className="hidden sm:block">
            <LanguagePicker />
          </div>
          <NotificationCenter />
          {user?.role === 'admin' && (
            <Link to="/admin" className="hidden sm:inline-flex w-11 h-11 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 items-center justify-center" aria-label={t('Admin console')}>
              <Shield className="w-5 h-5" />
            </Link>
          )}
          {user ? (
            <UserDropdown />
          ) : (
            <button type="button" onClick={() => openAuth()} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl bg-amber-400 text-slate-950 text-sm font-black hover:bg-amber-300" data-testid="sign-in">
              <LogIn className="w-4 h-4" /> {t('Sign in')}
            </button>
          )}
        </div>
      </div>
      {/* Platform Access Instagram Requirement Announcement for visitors who haven't followed */}
      {!hasInstaFollowed && (
        <div className="bg-gradient-to-r from-purple-950 via-rose-950 to-amber-950 border-t border-b border-pink-500/30 text-xs font-bold text-white px-4 py-1.5 flex items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-2 truncate">
            <span className="text-pink-400 font-black flex items-center gap-1.5 shrink-0 text-[11px] uppercase tracking-wider">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z"/>
              </svg>
              Platform Requirement:
            </span>
            <span className="text-slate-200 truncate text-[11px] sm:text-xs">
              Follow <strong className="text-amber-300">{targetHandle}</strong> on Instagram to play match games, submit Pick XI, and check in at fan venues!
            </span>
          </div>
          <button
            type="button"
            onClick={openInstaModal}
            className="shrink-0 px-2.5 py-1 bg-gradient-to-r from-pink-500 to-amber-500 hover:from-pink-400 hover:to-amber-400 text-slate-950 font-black rounded-lg text-[11px] shadow-sm transition-transform active:scale-95"
          >
            Follow on Instagram
          </button>
        </div>
      )}
      {config?.tickerText ? (
        <div className="bg-amber-400 text-slate-950 text-xs font-black overflow-hidden whitespace-nowrap">
          <div className="max-w-6xl mx-auto px-4 py-1 truncate">{config.tickerText}</div>
        </div>
      ) : null}
    </header>
  );
}

export function BottomNav({ route }: { route: Route }) {
  const t = useT();
  const { user, logout, toast, openQrPass } = useApp();
  const [more, setMore] = useState(false);
  const current = SECTION_OF[route.name];
  const items: [string, string, React.FC<{ className?: string }>, string][] = [
    ['/', t('Home'), Home, 'home'],
    ['/matches', t('Matches'), CalendarDays, 'matches'],
    ['/play', t('Play'), Gamepad2, 'play'],
    ['/social', t('Social'), Share2, 'social'],
  ];
  const moreLinks: [string, string][] = [
    ['/teams', t('Teams & squads')],
    ['/players', t('Players')],
    ['/videos', t('Videos')],
    ['/news', t('News')],
    ['/fantasy', t('Pick XI')],
    ['/team-games', t('Team games')],
    ['/games', t('Daily games')],
    ['/fanclub', t('Fan club pass')],
    ['/fanwall', t('Fan wall')],
    ['/contests', t('Predictions')],
    ['/prizes', t('Prizes & draws')],
    ['/leaderboard', t('Leaderboard')],
    ['/fans', t('Fan base')],
    ['/forum', t('Forum')],
    ['/fanspaces', t('Fan Spaces')],
    ['/rules', t('Rules')],
    [user ? '/profile' : '/rules', user ? t('My profile & stats') : t('How it works')],
    ...(user ? ([['/profile#details', t('Update profile')], ['/profile#badges', t('My badges')]] as [string, string][]) : []),
    ...(user?.role === 'admin' && user.adminRole === 'fanclub_admin' ? ([['/admin/fanclub', t('Fan club desk')]] as [string, string][]) : []),
    ...(user?.role === 'admin' && user.adminRole !== 'team_official' && user.adminRole !== 'fanclub_admin' ? ([['/admin', t('Admin console')]] as [string, string][]) : []),
    ...(user?.role === 'admin' && (user.adminRole === 'team_official' || user.isSuperAdmin) ? ([['/team-portal', t('Team portal')]] as [string, string][]) : []),
  ];
  return (
    <>
      <nav aria-label={t('Main')} className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5">
          {items.map(([to, label, Icon, key]) => (
            <Link key={to} to={to} className={cx('flex flex-col items-center justify-center gap-0.5 min-h-[58px] text-[11px] font-bold', current === key ? 'text-amber-400' : 'text-slate-400')} aria-current={current === key ? 'page' : undefined}>
              <Icon className="w-5 h-5" />
              {label}
            </Link>
          ))}
          <button type="button" onClick={() => setMore(true)} className={cx('flex flex-col items-center justify-center gap-0.5 min-h-[58px] text-[11px] font-bold', !items.some(i => i[3] === current) ? 'text-amber-400' : 'text-slate-400')} data-testid="more-button">
            <LayoutGrid className="w-5 h-5" />
            {t('More')}
          </button>
        </div>
      </nav>
      {more && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('More')}>
          <div className="absolute inset-0 bg-black/70" onClick={() => setMore(false)} />
          <div className="absolute bottom-0 inset-x-0 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-black text-white">{t('More Navigation')}</span>
              <button type="button" onClick={() => setMore(false)} className="w-10 h-10 rounded-xl text-slate-400 hover:text-white inline-flex items-center justify-center" aria-label={t('Close')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Quick Matchday Pass in drawer */}
            <button
              type="button"
              onClick={() => {
                setMore(false);
                openQrPass();
              }}
              className="w-full mb-3 flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-transparent border border-amber-400/50 text-white hover:border-amber-400 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-amber-500/30">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-start">
                  <div className="text-xs font-black text-amber-300">{t('Matchday QR Pass')}</div>
                  <div className="text-[11px] text-slate-300">{t('Fan club check-in for points')}</div>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400 px-2 py-1 rounded bg-amber-400/15">View →</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              {moreLinks.map(([to, label]) => (
                <button key={to + label} type="button" onClick={() => { setMore(false); navigate(to); }} className="min-h-[48px] px-3 rounded-xl bg-slate-950/70 border border-slate-800 text-sm font-bold text-slate-200 text-start hover:border-slate-600">
                  {label}
                </button>
              ))}
            </div>
            {user && (
              <div className="mt-4 pt-3 border-t border-slate-800">
                <Button
                  variant="danger"
                  className="w-full flex items-center justify-center gap-2 min-h-[44px]"
                  onClick={async () => {
                    setMore(false);
                    await logout();
                    toast(t('You have been signed out.'));
                    navigate('/');
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  {t('Log Out')}
                </Button>
              </div>
            )}
            <LanguagePicker className="mt-3 w-full [&>select]:w-full" />
          </div>
        </div>
      )}
    </>
  );
}

export function Footer() {
  const { config } = useApp();
  const t = useT();
  const year = new Date().getFullYear();
  const cols: [string, [string, string][]][] = [
    [t('Season'), [['/matches', t('Matches')], ['/teams', t('Teams')], ['/players', t('Players')], ['/videos', t('Videos')], ['/news', t('News')]]],
    [t('Play'), [['/team-games', t('Team games')], ['/fanclub', t('Fan club pass')], ['/fantasy', t('Pick XI')], ['/games', t('Daily games')], ['/contests', t('Predictions')], ['/prizes', t('Prizes & draws')], ['/leaderboard', t('Leaderboard')]]],
    [t('Community'), [['/fanwall', t('Fan wall')], ['/forum', t('Forum')], ['/fans', t('Fan base')], ['/fanspaces', t('Fan Spaces')], ['/social', t('Social')]]],
    [t('About'), [['/rules', t('Rules')], ['/privacy', t('Privacy')], ['/terms', t('Terms')]]],
  ];
  return (
    <footer className="border-t border-slate-900 bg-slate-950 pt-10 pb-28 lg:pb-10 text-sm text-slate-400">
      <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-5 gap-6">
        <div className="col-span-2 md:col-span-1 space-y-2">
          <BrandMark />
          <p className="text-xs leading-relaxed">{t('An independent fan hub for the Abu Dhabi T10. Not the official league website.')}</p>
          <a href="https://abudhabit10.com/" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-amber-400 hover:text-amber-300">
            {t('Official league site')} ↗
          </a>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">{title}</p>
            <ul className="space-y-1.5">
              {links.map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="hover:text-white">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-slate-900 text-xs flex flex-col sm:flex-row gap-2 justify-between">
        <span>
          © {year} {config?.copyrightHolder || 'Azlir Sports'}. {t('Brought to you by the Arabian Aces franchise.')}{' '}
          <a href="https://www.arabianaces.ae" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
            arabianaces.ae
          </a>
        </span>
        <span>{t('Team names and logos belong to their owners.')}</span>
      </div>
    </footer>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="fixed z-[70] bottom-24 lg:bottom-6 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none" aria-live="polite">
      {toasts.map(x => (
        <button
          key={x.id}
          type="button"
          onClick={() => dismissToast(x.id)}
          className={cx('pointer-events-auto max-w-md w-full text-start px-4 py-3 rounded-2xl shadow-2xl border text-sm font-bold', x.kind === 'error' ? 'bg-red-950 border-red-500/50 text-red-100' : x.kind === 'info' ? 'bg-slate-900 border-slate-600 text-slate-100' : 'bg-emerald-950 border-emerald-500/50 text-emerald-100')}
          data-testid="toast"
        >
          {x.text}
        </button>
      ))}
    </div>
  );
}

export function FloatingQRButton() {
  const { openQrPass } = useApp();
  const t = useT();
  return (
    <button
      type="button"
      onClick={openQrPass}
      className="fixed z-30 bottom-20 lg:bottom-6 end-4 sm:end-6 inline-flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-full bg-slate-900/95 hover:bg-slate-800 text-amber-300 border border-amber-400/50 shadow-2xl shadow-black/80 hover:shadow-amber-500/25 transition-all hover:scale-105 active:scale-95 backdrop-blur group"
      aria-label={t('My Matchday QR Pass')}
      data-testid="floating-qr-button"
    >
      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-bold shadow">
        <QrCode className="w-4 h-4" />
      </div>
      <span className="text-xs font-black tracking-tight text-white group-hover:text-amber-300">
        {t('QR Pass')}
      </span>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
        +100
      </span>
    </button>
  );
}

