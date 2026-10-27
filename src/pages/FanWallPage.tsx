import React, { useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import type { FanPostKind, FanPostView, FanWallResponse } from '../types';
import { Avatar, Button, Card, EmptyState, ErrorBox, PageHeader, Spinner, Tabs, cx } from '../components/ui';
import { FanOfTheDayHero, FanPostCard, useKindLabels } from '../components/fanwall';
import { preparePhoto } from '../utils/photo';

/**
 * The fan wall: fans show how big a fan they are (a matchday photo, the shirt collection, the trip
 * to the stadium). The organisers pick a Fan of the Day, who gets points.
 */

function Composer({ wall, onPosted }: { wall: FanWallResponse; onPosted: (p: FanPostView) => void }) {
  const t = useT();
  const { user, openAuth, setUser, toast, teamById } = useApp();
  const kinds = useKindLabels();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<FanPostKind>('moment');
  const [photo, setPhoto] = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!user)
    return (
      <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
        <Camera className="w-8 h-8 text-amber-400 shrink-0" />
        <p className="flex-1 text-sm text-slate-300">{t('Sign in to post your photo or matchday moment, and you could be Fan of the Day.')}</p>
        <Button onClick={() => openAuth(t('Sign in to post on the fan wall.'))}>{t('Sign in')}</Button>
      </Card>
    );
  const choose = async (file?: File | null) => {
    if (!file) return;
    setPreparing(true);
    try {
      setPhoto(await preparePhoto(file));
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setPreparing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const submit = async () => {
    if (!text.trim() && !photo) return toast(t('Add a photo or a few words'), 'error');
    setBusy(true);
    try {
      const r = await api.createFanPost({ text: text.trim(), kind, photo: photo?.dataUrl });
      setUser(r.user);
      toast(r.pointsAdded ? `${t(r.message)} +${r.pointsAdded}` : t(r.message));
      onPosted(r.post);
      setText('');
      setPhoto(null);
    } catch (e: any) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const team = teamById(user.teamId || '');
  return (
    <Card className="p-4 space-y-3" data-testid="fanwall-composer">
      <div className="flex items-center gap-2">
        <Avatar name={user.name} src={user.avatar} size={32} />
        <p className="text-sm font-bold text-white">{team ? t('Show how big a {team} fan you are', { team: team.name }) : t('Show how big a fan you are')}</p>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value.slice(0, 500))}
        rows={3}
        placeholder={t('Your matchday moment, your collection, how far you travelled…')}
        className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-base sm:text-sm text-white placeholder:text-slate-500"
        aria-label={t('What do you want to share?')}
      />
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(kinds) as FanPostKind[]).map(k => (
          <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k} className={cx('rounded-full border px-3 py-1.5 text-xs font-bold', kind === k ? 'border-amber-400 bg-amber-400/15 text-white' : 'border-slate-700 text-slate-300')}>
            {kinds[k]}
          </button>
        ))}
      </div>
      {photo && (
        <div className="relative inline-block">
          <img src={photo.dataUrl} alt={t('Your photo')} className="max-h-48 rounded-xl" />
          <button type="button" onClick={() => setPhoto(null)} className="absolute top-1 end-1 w-8 h-8 rounded-full bg-black/60 text-white inline-flex items-center justify-center" aria-label={t('Remove photo')}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => choose(e.target.files?.[0])} />
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={!wall.photosEnabled || preparing} loading={preparing}>
          <ImagePlus className="w-4 h-4" /> {photo ? t('Change photo') : t('Add a photo')}
        </Button>
        <span className="flex-1 text-[11px] text-slate-500">{text.length}/500</span>
        <Button size="sm" onClick={submit} loading={busy}>
          {t('Post')}
        </Button>
      </div>
      <p className="text-[11px] text-slate-500">
        {!wall.photosEnabled
          ? t('Photo posts open soon; you can post text now.')
          : wall.review === 'none'
            ? t('Photos are shrunk and their location data removed before upload.')
            : t('Photos are shrunk and their location data removed before upload, and checked by a moderator before they show.')}
      </p>
    </Card>
  );
}

export default function FanWallPage() {
  const t = useT();
  const { user, config, teams } = useApp();
  const kinds = useKindLabels();
  usePageMeta(t('Fan wall'), t('Abu Dhabi T10 fans share their photos and matchday moments. The organisers pick a Fan of the Day.'), config?.brandName);
  const [filter, setFilter] = useState<string>('all');
  const params = filter === 'mine-team' ? { teamId: user?.teamId || undefined } : filter !== 'all' ? { kind: filter } : {};
  const { data, setData, error, loading, reload } = useLoad(() => api.getFanWall(params), [filter, user?.id]);
  const [loadingMore, setLoadingMore] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error || ''} onRetry={reload} />;
  const today = data.fansOfTheDay[0];
  const more = async () => {
    setLoadingMore(true);
    try {
      const r = await api.getFanWall({ ...params, before: data.posts[data.posts.length - 1]?.createdAt });
      setData({ ...data, posts: [...data.posts, ...r.posts], more: r.more });
    } finally {
      setLoadingMore(false);
    }
  };
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t('Fans')}
        title={t('Fan wall')}
        subtitle={t('Show how big a fan you are. Every day the organisers pick a Fan of the Day who wins {n} points.', { n: data.fanOfTheDayPoints })}
      />
      {today?.post && <FanOfTheDayHero fotd={today} />}
      <Composer wall={data} onPosted={p => setData({ ...data, posts: [p, ...data.posts] })} />
      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all', label: t('All') },
          ...(user?.teamId ? [{ id: 'mine-team', label: teams.find(x => x.id === user.teamId)?.short || t('My team') }] : []),
          ...(Object.keys(kinds) as FanPostKind[]).map(k => ({ id: k, label: kinds[k] })),
        ]}
      />
      {data.posts.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
          {data.posts.map(p => (
            <FanPostCard key={p.id} post={p} onRemoved={() => setData({ ...data, posts: data.posts.filter(x => x.id !== p.id) })} />
          ))}
        </div>
      ) : (
        <EmptyState icon={<Camera className="w-8 h-8" />} title={t('Be the first on the wall')} body={t('Post a photo from the stadium, your shirt collection or your watch party.')} />
      )}
      {data.more && (
        <div className="text-center">
          <Button variant="secondary" onClick={more} loading={loadingMore}>
            {t('Show more')}
          </Button>
        </div>
      )}
      {data.fansOfTheDay.length > 1 && (
        <section>
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 mb-2">{t('Recent Fans of the Day')}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data.fansOfTheDay.slice(1).map(f =>
              f.post ? (
                <Link key={f.day} to={`/fanwall/${f.post.id}`} className="shrink-0 w-40 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden hover:border-slate-600">
                  {f.post.photoUrl ? <img src={f.post.photoUrl} alt="" loading="lazy" className="w-full h-28 object-cover" /> : <div className="h-28 flex items-center justify-center text-3xl">🏆</div>}
                  <p className="px-2.5 py-2 text-xs font-bold text-white truncate">{f.post.userName}</p>
                </Link>
              ) : null,
            )}
          </div>
        </section>
      )}
      <Card className="p-4 text-xs text-slate-400 space-y-1">
        <p className="font-black text-slate-200">{t('How it works')}</p>
        <p>{t('Posting earns 5 points, twice a day. Reactions and reports keep the wall friendly; posts reported by several fans wait for a moderator.')}</p>
        <p>{t('Fan of the Day is picked by the organisers from the wall. Please only post photos you took and have permission to share.')}</p>
      </Card>
    </div>
  );
}
