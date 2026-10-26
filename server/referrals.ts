import crypto from 'crypto';
import { AppStore, User } from './db';
import { awardPoints } from './points';

/**
 * Invite a friend. Each fan has a short code; the invite link is /?ref=CODE. When the friend signs
 * up through it and then takes part (enters a contest, saves a Pick XI, plays a daily game or posts
 * in the forum), both get the referral reward once. Signing up alone earns nothing, so fake
 * accounts are not worth creating.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function referralCodeFor(store: AppStore, user: User): string {
  if (user.referralCode) return user.referralCode;
  let code = '';
  do {
    const bytes = crypto.randomBytes(6);
    code = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
  } while (store.users.some(u => u.referralCode === code));
  user.referralCode = code;
  return code;
}

/** Links a brand-new account to the fan who invited them. Returns true when linked. */
export function attachReferral(store: AppStore, newUser: User, rawCode: unknown): boolean {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{4,12}$/.test(code) || newUser.referredBy) return false;
  const inviter = store.users.find(u => u.referralCode === code);
  if (!inviter || inviter.id === newUser.id) return false;
  newUser.referredBy = inviter.id;
  return true;
}

export function hasParticipated(store: AppStore, userId: string) {
  return (
    store.contestEntries.some(e => e.userId === userId) ||
    store.fantasyTeams.some(f => f.userId === userId) ||
    store.gamePlays.some(p => p.userId === userId && p.finished) ||
    store.forumThreads.some(t => t.userId === userId) ||
    store.forumComments.some(c => c.userId === userId)
  );
}

/** Pays the reward to both fans once the invited fan has taken part. Returns the points paid to each (0 if none). */
export function checkReferralReward(store: AppStore, user: User): number {
  if (!user.referredBy || user.referralRewardedAt) return 0;
  if (!hasParticipated(store, user.id)) return 0;
  const inviter = store.users.find(u => u.id === user.referredBy);
  const pts = Math.max(0, Math.round(store.settings.referralRewardPoints || 0));
  user.referralRewardedAt = new Date().toISOString();
  awardPoints(store, user, pts, 'referral', inviter ? `Joined with ${inviter.name}'s invite` : 'Joined with an invite', inviter?.id);
  if (inviter) {
    // The inviter is paid for a limited number of friends, so fake accounts can't farm points.
    const cap = Math.max(0, Math.round(store.settings.referralMaxRewarded ?? 10));
    const paidAlready = store.users.filter(u => u.referredBy === inviter.id && u.id !== user.id && u.referralRewardedAt && !u.referralInviterUnpaid).length;
    if (cap && paidAlready >= cap) user.referralInviterUnpaid = true;
    else awardPoints(store, inviter, pts, 'referral', `${user.name} joined with your invite and played`, user.id);
  }
  return pts;
}

export function referralSummary(store: AppStore, user: User) {
  const invited = store.users.filter(u => u.referredBy === user.id);
  const rewarded = invited.filter(u => u.referralRewardedAt);
  const pts = store.settings.referralRewardPoints || 0;
  return {
    code: referralCodeFor(store, user),
    rewardPoints: pts,
    invited: invited.length,
    joinedAndPlayed: rewarded.length,
    pointsEarned: rewarded.filter(u => !u.referralInviterUnpaid).length * pts,
    maxRewarded: store.settings.referralMaxRewarded ?? 10,
    friends: invited.slice(0, 50).map(u => ({ name: u.name, joinedAt: u.createdAt, rewarded: Boolean(u.referralRewardedAt) })),
  };
}
