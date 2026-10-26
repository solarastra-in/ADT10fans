import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setFreshReads, clearStoredToken } from './api';
import type { Match, PublicConfig, Team, User } from './types';

export interface Toast {
  id: number;
  text: string;
  kind: 'success' | 'error' | 'info';
}

interface AppState {
  ready: boolean;
  bootError: string | null;
  config: PublicConfig | null;
  user: User | null;
  setUser: (u: User | null | ((prev: User | null) => User | null)) => void;
  teams: Team[];
  matches: Match[];
  teamById: (id?: string | null) => Team | undefined;
  refreshTeams: () => Promise<void>;
  refreshMatches: () => Promise<void>;
  refreshUser: () => Promise<void>;
  reloadAll: () => Promise<void>;
  logout: () => Promise<void>;
  authOpen: boolean;
  authReason: string;
  openAuth: (reason?: string) => void;
  closeAuth: () => void;
  teamPickerOpen: boolean;
  openTeamPicker: () => void;
  closeTeamPicker: () => void;
  toasts: Toast[];
  toast: (text: string, kind?: Toast['kind']) => void;
  dismissToast: (id: number) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState('');
  const [teamPickerOpen, setTeamPickerOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const refreshTeams = useCallback(async () => {
    const r = await api.getTeams();
    setTeams(r.teams);
  }, []);
  const refreshMatches = useCallback(async () => {
    const r = await api.getMatches();
    setMatches(r.matches);
  }, []);
  const refreshUser = useCallback(async () => {
    const r = await api.getMe().catch(() => ({ user: null }));
    setUser(r.user);
  }, []);
  const reloadAll = useCallback(async () => {
    const [cfg, me, t, m] = await Promise.all([api.getConfig(), api.getMe().catch(() => ({ user: null })), api.getTeams(), api.getMatches()]);
    setConfig(cfg.config);
    setUser(me.user);
    setTeams(t.teams);
    setMatches(m.matches);
  }, []);

  useEffect(() => {
    reloadAll()
      .then(() => setBootError(null))
      .catch(e => setBootError(e?.message || 'Could not load the site'))
      .finally(() => setReady(true));
  }, [reloadAll]);

  // Admins read public data past the CDN cache, so their own edits show at once.
  useEffect(() => {
    setFreshReads(user?.role === 'admin');
  }, [user]);

  // Live matches refresh every 30 seconds; otherwise every 5 minutes. Not while the tab is hidden;
  // coming back to it refreshes straight away.
  const hasLive = matches.some(m => m.status === 'live');
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      refreshMatches().catch(() => undefined);
    };
    const id = setInterval(tick, hasLive ? 30_000 : 300_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && hasLive) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [hasLive, refreshMatches]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = ++toastId.current;
    setToasts(t => [...t.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      ready,
      bootError,
      config,
      user,
      setUser,
      teams,
      matches,
      teamById: (id?: string | null) => (id ? teams.find(t => t.id === id) : undefined),
      refreshTeams,
      refreshMatches,
      refreshUser,
      reloadAll,
      logout: async () => {
        await api.logout().catch(() => undefined);
        clearStoredToken();
        setUser(null);
      },
      authOpen,
      authReason,
      openAuth: (reason = '') => {
        setAuthReason(reason);
        setAuthOpen(true);
      },
      closeAuth: () => setAuthOpen(false),
      teamPickerOpen,
      openTeamPicker: () => setTeamPickerOpen(true),
      closeTeamPicker: () => setTeamPickerOpen(false),
      toasts,
      toast,
      dismissToast: (id: number) => setToasts(t => t.filter(x => x.id !== id)),
    }),
    [ready, bootError, config, user, teams, matches, refreshTeams, refreshMatches, refreshUser, reloadAll, authOpen, authReason, teamPickerOpen, toasts, toast],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

/** Loads data for a page; returns { data, error, loading, reload }. */
export function useLoad<T>(loader: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(async () => {
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await loader();
      if (n === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e: any) {
      if (n === seq.current) setError(e?.message || 'Something went wrong');
    } finally {
      if (n === seq.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    run();
  }, [run]);
  return { data, setData, error, loading, reload: run };
}
