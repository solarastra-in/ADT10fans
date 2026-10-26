import React, { useState } from 'react';
import { Copy, Share2, UserPlus } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Button, Card, StatTile } from './ui';

export function InviteCard({ compact }: { compact?: boolean }) {
  const { user, config, toast } = useApp();
  const t = useT();
  const { data } = useLoad(() => (user ? api.getReferral() : Promise.resolve(null)), [user?.id]);
  const [copied, setCopied] = useState(false);
  if (!user || !data) return null;
  const link = `${window.location.origin}/?ref=${data.code}`;
  const text = t('Join me on {brand}: free Pick XI, daily cricket games and prizes for the Abu Dhabi T10.', { brand: config?.brandName || 'ADT10 Fans' });

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: config?.brandName, text, url: link });
        return;
      } catch {
        /* cancelled: fall back to copy */
      }
    }
    await copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast(t('Invite link copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast(link, 'info');
    }
  };

  if (compact) {
    return (
      <Card className="p-4 flex items-center gap-4" data-testid="invite-card">
        <span className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <UserPlus className="w-6 h-6" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{t('Invite a friend')}</p>
          <p className="text-xs text-slate-400">{t('You both get {n} points when they play their first game.', { n: data.rewardPoints })}</p>
        </div>
        <Button variant="secondary" onClick={share}>
          <Share2 className="w-4 h-4" /> {t('Invite')}
        </Button>
      </Card>
    );
  }
  return (
    <Card className="p-5 space-y-4" data-testid="invite-card">
      <div className="flex items-center gap-2">
        <UserPlus className="w-5 h-5 text-emerald-400" />
        <h2 className="text-base font-black text-white">{t('Invite friends')}</h2>
      </div>
      <p className="text-sm text-slate-300">{t('Share your link. When a friend signs up with it and plays their first game, you both get {n} points.', { n: data.rewardPoints })}</p>
      <div className="flex gap-2">
        <input readOnly value={link} className="flex-1 min-w-0 min-h-[44px] px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-300 font-mono" aria-label={t('Your invite link')} data-testid="invite-link" />
        <Button variant="secondary" onClick={copy} aria-label={t('Copy link')}>
          <Copy className="w-4 h-4" /> {copied ? t('Copied') : t('Copy')}
        </Button>
      </div>
      <Button onClick={share} className="w-full">
        <Share2 className="w-4 h-4" /> {t('Share invite')}
      </Button>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label={t('Signed up')} value={data.invited} />
        <StatTile label={t('Played')} value={data.joinedAndPlayed} />
        <StatTile label={t('Points earned')} value={data.pointsEarned} accent />
      </div>
      {data.friends.length > 0 && (
        <ul className="text-xs text-slate-400 space-y-1">
          {data.friends.map((fr, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="truncate">{fr.name}</span>
              <span className={fr.rewarded ? 'text-emerald-400' : 'text-slate-500'}>{fr.rewarded ? t('Bonus paid') : t('Waiting for first game')}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
