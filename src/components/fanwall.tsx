import React, { useState } from 'react';
import { Flag, Share2, Trash2, Trophy } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../state';
import { useT } from '../i18n';
import { Link } from '../router';
import type { FanOfTheDayView, FanPostKind, FanPostView } from '../types';
import { Avatar, Card, Notice, Pill, TeamBadge, cx, useFormat } from './ui';

/** Fan wall pieces shared by the wall, a post's page and the home page. */

const REACTIONS = ['👏', '🔥', '😂', '😮', '💯'];

export function useKindLabels() {
  const t = useT();
  return {
    moment: t('Fan moment'),
    matchday: t('Matchday'),
    memorabilia: t('Shirts & collection'),
    travel: t('Trip to the stadium'),
    other: t('Other'),
  } as Record<FanPostKind, string>;
}

export function FanPostCard({ post, onRemoved, big }: { post: FanPostView; onRemoved?: () => void; big?: boolean }) {
  const t = useT();
  const f = useFormat();
  const { user, openAuth, toast, teamById } = useApp();
  const kinds = useKindLabels();
  const [reactions, setReactions] = useState(post.reactions);
  const [reported, setReported] = useState(false);
  const team = teamById(post.teamId || '');
  const react = async (emoji: string) => {
    if (!user) return openAuth(t('Sign in to react.'));
    try {
      setReactions((await api.reactFanPost(post.id, emoji)).reactions);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const share = async () => {
    const url = `${window.location.origin}/fanwall/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: t('{name} on the fan wall', { name: post.userName }), url });
      else {
        await navigator.clipboard.writeText(url);
        toast(t('Link copied'));
      }
    } catch {
      /* cancelled */
    }
  };
  const report = async () => {
    if (!user) return openAuth(t('Sign in to report a post.'));
    const reason = window.prompt(t('What is wrong with this post?'), t('Inappropriate'));
    if (!reason) return;
    try {
      toast((await api.reportFanPost(post.id, reason)).message);
      setReported(true);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const remove = async () => {
    if (!window.confirm(t('Delete this post? Points you earned for it are taken back.'))) return;
    try {
      await api.deleteFanPost(post.id);
      toast(t('Post deleted'));
      onRemoved?.();
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };
  const featured = post.featuredOn.length > 0;
  return (
    <Card className={cx('overflow-hidden flex flex-col', featured && 'ring-2 ring-amber-400/70')} data-testid="fan-post">
      {post.photoUrl && (
        <Link to={`/fanwall/${post.id}`} className="block bg-slate-950">
          <img
            src={post.photoUrl}
            alt={post.text ? post.text.slice(0, 120) : t('Photo by {name}', { name: post.userName })}
            width={post.photoWidth}
            height={post.photoHeight}
            loading="lazy"
            decoding="async"
            className={cx('w-full object-cover', big ? 'max-h-[70vh] object-contain' : 'max-h-96')}
            style={post.photoWidth && post.photoHeight && !big ? { aspectRatio: `${post.photoWidth} / ${post.photoHeight}` } : undefined}
          />
        </Link>
      )}
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex items-center gap-2">
          <Avatar name={post.userName} src={post.userAvatar} size={32} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{post.userName}</p>
            <p className="text-[11px] text-slate-500">
              {kinds[post.kind]} · {f.ago(post.createdAt)}
            </p>
          </div>
          {team && <TeamBadge team={team} size="sm" />}
        </div>
        {featured && (
          <Pill tone="amber">
            <Trophy className="w-3 h-3 inline -mt-0.5" /> {t('Fan of the Day')}
          </Pill>
        )}
        {post.status === 'pending' && <Notice>{t('Waiting for a moderator. Only you can see it for now.')}</Notice>}
        {post.text && <p className={cx('text-slate-200 whitespace-pre-line break-words', big ? 'text-base' : 'text-sm')}>{post.text}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          {REACTIONS.map(e => {
            const r = reactions.find(x => x.emoji === e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                disabled={post.status !== 'live'}
                aria-pressed={Boolean(r?.mine)}
                className={cx('min-h-[36px] rounded-full border px-2.5 text-sm', r?.mine ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-slate-700 text-slate-300 hover:border-slate-500')}
              >
                {e} {r?.count ? <span className="text-xs font-bold">{r.count}</span> : null}
              </button>
            );
          })}
          <span className="flex-1" />
          <button type="button" onClick={share} className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center" aria-label={t('Share')}>
            <Share2 className="w-4 h-4" />
          </button>
          {post.mine ? (
            <button type="button" onClick={remove} className="w-9 h-9 rounded-lg text-slate-400 hover:text-red-300 hover:bg-slate-800 inline-flex items-center justify-center" aria-label={t('Delete')}>
              <Trash2 className="w-4 h-4" />
            </button>
          ) : (
            <button type="button" onClick={report} disabled={reported} className="w-9 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 inline-flex items-center justify-center disabled:opacity-40" aria-label={t('Report')}>
              <Flag className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function FanOfTheDayHero({ fotd }: { fotd: FanOfTheDayView }) {
  const t = useT();
  const f = useFormat();
  const { teamById } = useApp();
  const p = fotd.post;
  if (!p) return null;
  const team = teamById(p.teamId || '');
  return (
    <Link to={`/fanwall/${p.id}`} className="block rounded-3xl overflow-hidden border border-amber-400/50 bg-gradient-to-br from-amber-400/20 via-slate-900 to-slate-950 hover:border-amber-300" data-testid="fan-of-the-day">
      <div className="grid sm:grid-cols-2">
        {p.photoUrl ? <img src={p.photoUrl} alt={p.text || t('Photo by {name}', { name: p.userName })} className="w-full h-64 sm:h-full object-cover" /> : null}
        <div className="p-5 space-y-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
            <Trophy className="w-4 h-4" /> {t('Fan of the Day')} · {f.date(`${fotd.day}T12:00:00Z`, { day: 'numeric', month: 'short' })}
          </p>
          <div className="flex items-center gap-2">
            <Avatar name={p.userName} src={p.userAvatar} size={40} />
            <div>
              <p className="text-lg font-black text-white">{p.userName}</p>
              {team && <p className="text-xs text-slate-300">{t('{team} fan', { team: team.name })}</p>}
            </div>
          </div>
          {fotd.note && <p className="text-sm text-amber-100 italic">“{fotd.note}”</p>}
          {p.text && <p className="text-sm text-slate-200 line-clamp-4">{p.text}</p>}
          {fotd.points > 0 && <Pill tone="amber">{t('+{n} points', { n: fotd.points })}</Pill>}
        </div>
      </div>
    </Link>
  );
}

