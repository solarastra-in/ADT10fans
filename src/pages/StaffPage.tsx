import React, { useEffect } from 'react';
import { Building2, ShieldCheck, Store } from 'lucide-react';
import { useApp } from '../state';
import { Link, navigate, usePageMeta } from '../router';
import { Button, Card, PageHeader } from '../components/ui';

/** Where each kind of staff account works. */
export function staffHome(u: { role?: string; adminRole?: string } | null | undefined): string | null {
  if (!u || u.role !== 'admin') return null;
  if (u.adminRole === 'team_official') return '/team-portal';
  if (u.adminRole === 'fanclub_admin') return '/venue';
  return '/admin';
}

const DOORS = [
  { to: '/admin', icon: ShieldCheck, title: 'Super admin and league admins', body: 'The admin console: matches, teams, games, prizes, fan clubs, Instagram checks and settings.', testid: 'staff-admin' },
  { to: '/team-portal', icon: Building2, title: 'Team admins', body: 'Your franchise’s portal: team page, squad, channels, prizes for your fans and messages. Use the email your invitation was sent to.', testid: 'staff-team' },
  { to: '/venue', icon: Store, title: 'Fan venue admins', body: 'The fan club desk: check fans in on matchdays, redeem offers and manage your club’s offers.', testid: 'staff-venue' },
];

/**
 * Staff sign-in: the staff pages (this one, /admin, /team-portal, /venue) never show the fans'
 * Instagram check. Once signed in, each staff account goes straight to where it works.
 */
export default function StaffPage() {
  const { user, openAuth, config } = useApp();
  usePageMeta('Staff sign-in', undefined, config?.brandName);
  const home = staffHome(user);
  useEffect(() => {
    if (home) navigate(home, { replace: true });
  }, [home]);

  return (
    <div className="space-y-5 max-w-2xl mx-auto" data-testid="staff-page">
      <PageHeader eyebrow="Staff" title="Staff sign-in" subtitle="For the league, team and fan venue admins. Staff accounts do not need the fans’ Instagram check." />
      {!user ? (
        <Button onClick={() => openAuth('Sign in with your staff email.')} data-testid="staff-sign-in">Sign in with your staff email</Button>
      ) : !home ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100" data-testid="staff-not-staff">
          {user.email} is not a staff account. Ask a super admin to add you, or sign in with the email you were invited with.
        </p>
      ) : null}
      <div className="grid gap-3">
        {DOORS.map(d => (
          <Link key={d.to} to={d.to} className="block group" data-testid={d.testid}>
            <Card className="p-4 flex gap-3 items-start hover:border-amber-400/50">
              <d.icon className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block font-black text-white group-hover:text-amber-300">{d.title}</span>
                <span className="block text-sm text-slate-400">{d.body}</span>
                <span className="block text-xs font-mono text-slate-500 mt-1">ADT10fans.com{d.to}</span>
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
