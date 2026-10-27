import React, { useState } from 'react';
import { CheckCircle2, Shield } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { navigate, usePageMeta } from '../router';
import { Button, Card, ErrorBox, Notice, Spinner, TeamBadge } from '../components/ui';

/**
 * Where an invitation email leads. The invited person signs in with the address it was sent to and
 * accepts; they then manage their franchise in the team portal.
 */
export default function TeamInvitePage({ token }: { token: string }) {
  const { user, openAuth, setUser, logout, teamById, toast } = useApp();
  usePageMeta('Team portal invitation');
  const { data, error, loading, reload } = useLoad(() => api.getTeamInvite(token), [token, user?.id]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string | null>(null);

  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || 'This invitation link is not valid.'} onRetry={reload} />;
  const team = (data.team && teamById(data.team.id)) || data.team;

  const accept = async () => {
    setBusy(true);
    setFail(null);
    try {
      const r = await api.acceptTeamInvite(token);
      setUser(r.user);
      toast(`Welcome to the ${team?.name || 'team'} portal`);
      navigate('/team-portal');
    } catch (e: any) {
      setFail(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4" data-testid="team-invite">
      <Card className="p-6 space-y-4 text-center">
        {team && <div className="flex justify-center"><TeamBadge team={team as any} size="lg" /></div>}
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-xs font-black uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5" /> Team portal invitation
        </span>
        <h1 className="text-2xl font-black text-white">
          {data.name}, you're invited to run {team?.name || 'a team'}
        </h1>
        <p className="text-sm text-slate-300">
          Manage the team page, squad and player details, official accounts, posts, prizes for your fans, polls and messages to your fans.
        </p>

        {data.status === 'accepted' ? (
          <Notice tone="success">This invitation has been accepted. {user?.adminRole === 'team_official' ? 'Open the team portal below.' : 'Sign in with the invited email to open the portal.'}</Notice>
        ) : data.status !== 'pending' ? (
          <Notice tone="warn">This invitation has {data.status === 'expired' ? 'expired' : 'been withdrawn'}. Ask the league for a new one.</Notice>
        ) : !user ? (
          <>
            <p className="text-sm text-slate-400">Sign in with the email this invitation was sent to ({data.emailHint}).</p>
            <Button onClick={() => openAuth('Sign in with the email your team portal invitation was sent to.')} className="w-full">
              Sign in to accept
            </Button>
          </>
        ) : !data.signedInAsInvitee ? (
          <>
            <Notice tone="warn">
              You're signed in as {user.email}, but this invitation was sent to {data.emailHint}. Sign out and sign in with that address.
            </Notice>
            <Button variant="secondary" onClick={() => logout().then(() => reload())} className="w-full">
              Sign out
            </Button>
          </>
        ) : (
          <Button onClick={accept} loading={busy} className="w-full" data-testid="accept-invite">
            <CheckCircle2 className="w-4 h-4" /> Accept and open the team portal
          </Button>
        )}
        {fail && <ErrorBox message={fail} />}
        {data.status === 'pending' && <p className="text-[11px] text-slate-500">The link works until {new Date(data.expiresAt).toLocaleString()}.</p>}
        {user?.adminRole === 'team_official' && data.status === 'accepted' && (
          <Button onClick={() => navigate('/team-portal')} className="w-full">
            Open the team portal
          </Button>
        )}
      </Card>
    </div>
  );
}
