import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Facebook, Globe, Instagram, Linkedin, Music2, Play, Rss, Youtube, AtSign } from 'lucide-react';
import { useT } from '../i18n';
import { Button, cx, useFormat } from './ui';
import type { FeedItem, SocialHandle, Team } from '../types';

/**
 * Social content inside the site.
 *
 * Videos play in place (YouTube, privacy-enhanced youtube-nocookie.com). Profiles use each
 * platform's own embed (X timeline, Facebook page plugin, TikTok creator embed); Instagram,
 * Threads and LinkedIn have no profile embed, so they show a profile card, and their single posts
 * embed when an admin adds them by link. Third-party embeds only load when the fan taps them,
 * so no tracking scripts run until then.
 */

export function XLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.9 2H22l-7.1 8.1L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.6-8.7L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.2 3.9H5.3L17.7 20Z" />
    </svg>
  );
}
function ThreadsLogo({ className = 'w-4 h-4' }: { className?: string }) {
  return <AtSign className={className} aria-hidden />;
}

export const PLATFORM_META: Record<string, { label: string; color: string; Icon: React.FC<{ className?: string }> }> = {
  YouTube: { label: 'YouTube', color: '#FF0033', Icon: Youtube },
  X: { label: 'X', color: '#E5E7EB', Icon: XLogo },
  Instagram: { label: 'Instagram', color: '#E1306C', Icon: Instagram },
  Threads: { label: 'Threads', color: '#E5E7EB', Icon: ThreadsLogo },
  Facebook: { label: 'Facebook', color: '#1877F2', Icon: Facebook },
  TikTok: { label: 'TikTok', color: '#25F4EE', Icon: Music2 },
  LinkedIn: { label: 'LinkedIn', color: '#0A66C2', Icon: Linkedin },
  RSS: { label: 'RSS', color: '#F59E0B', Icon: Rss },
  Web: { label: 'Web', color: '#94A3B8', Icon: Globe },
};

export function PlatformIcon({ platform, className = 'w-4 h-4' }: { platform: string; className?: string }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.Web;
  return (
    <span style={{ color: meta.color }} className="inline-flex">
      <meta.Icon className={className} />
    </span>
  );
}

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if ((existing as any)._loaded) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('blocked')));
      return;
    }
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => {
      (s as any)._loaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error('blocked'));
    document.body.appendChild(s);
  });
}

/** Click-to-load wrapper so third-party embeds only load when wanted. */
function Gate({ label, children, platform, minHeight = 220 }: { label: string; children: () => React.ReactNode; platform: string; minHeight?: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (open) return <>{children()}</>;
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:bg-slate-900 flex flex-col items-center justify-center gap-2 text-sm text-slate-300 font-bold"
      style={{ minHeight }}
      data-embed-gate={platform}
    >
      <PlatformIcon platform={platform} className="w-7 h-7" />
      <span>{label}</span>
      <span className="text-[11px] font-medium text-slate-500 max-w-xs px-4">{t('Loads content from {platform}', { platform: PLATFORM_META[platform]?.label || platform })}</span>
    </button>
  );
}

export function YouTubePlayer({ videoId, title, image, autoLoad }: { videoId: string; title: string; image?: string | null; autoLoad?: boolean }) {
  const t = useT();
  const [playing, setPlaying] = useState(Boolean(autoLoad));
  const thumb = image || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          data-testid="yt-iframe"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="absolute inset-0 w-full h-full group" aria-label={t('Play video: {title}', { title })} data-testid="yt-play">
          <img src={thumb} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-16 h-16 rounded-full bg-red-600/95 group-hover:bg-red-500 flex items-center justify-center shadow-xl">
              <Play className="w-7 h-7 text-white fill-white ms-1" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

/** Plays a channel's latest uploads (the channel's "uploads" playlist is UU + the channel id without UC). */
export function ChannelPlayer({ channelId, title }: { channelId: string; title: string }) {
  const t = useT();
  const list = `UU${channelId.slice(2)}`;
  return (
    <Gate label={t('Play latest videos from {name}', { name: title })} platform="YouTube" minHeight={200}>
      {() => (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/videoseries?list=${list}&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            data-testid="yt-channel-iframe"
          />
        </div>
      )}
    </Gate>
  );
}

function XTimeline({ screenName }: { screenName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const t = useT();
  useEffect(() => {
    let cancelled = false;
    loadScript('https://platform.twitter.com/widgets.js', 'x-widgets')
      .then(() => {
        if (!cancelled && ref.current) (window as any).twttr?.widgets?.load(ref.current);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [screenName]);
  if (failed) return <p className="text-xs text-slate-400 p-3">{t('The X timeline could not load here. Open the profile on X instead.')}</p>;
  return (
    <div ref={ref} className="rounded-xl overflow-hidden bg-slate-950 min-h-[200px]" data-testid="x-timeline">
      <a className="twitter-timeline" data-theme="dark" data-height="560" data-dnt="true" href={`https://twitter.com/${screenName}`}>
        {t('Posts by @{name}', { name: screenName })}
      </a>
    </div>
  );
}

function FacebookPage({ url, name }: { url: string; name: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    if (ref.current) setWidth(Math.max(180, Math.min(500, Math.floor(ref.current.clientWidth))));
  }, []);
  const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(url)}&tabs=timeline&width=${width}&height=560&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`;
  return (
    <div ref={ref} className="w-full flex justify-center rounded-xl overflow-hidden bg-white">
      <iframe src={src} title={`${name} on Facebook`} width={width} height={560} style={{ border: 'none', overflow: 'hidden' }} scrolling="no" allow="encrypted-media; clipboard-write; picture-in-picture; web-share" data-testid="fb-iframe" />
    </div>
  );
}

function TikTokCreator({ username }: { username: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // TikTok's embed script scans the page once when it loads, so it is re-added each time.
    document.getElementById('tiktok-embed')?.remove();
    const s = document.createElement('script');
    s.id = 'tiktok-embed';
    s.src = 'https://www.tiktok.com/embed.js';
    s.async = true;
    document.body.appendChild(s);
  }, [username]);
  return (
    <div ref={ref} className="rounded-xl overflow-hidden bg-slate-950 min-h-[200px]" data-testid="tiktok-embed">
      <blockquote className="tiktok-embed" cite={`https://www.tiktok.com/@${username}`} data-unique-id={username} data-embed-type="creator" style={{ maxWidth: 780, minWidth: 288, margin: 0 }}>
        <section>
          <a target="_blank" rel="noopener noreferrer" href={`https://www.tiktok.com/@${username}?refer=creator_embed`}>
            @{username}
          </a>
        </section>
      </blockquote>
    </div>
  );
}

/** A handle as it appears in the site: the best in-site experience each platform allows. */
export function HandleEmbed({ handle, team }: { handle: SocialHandle; team?: Team | null }) {
  const t = useT();
  const name = team?.name || 'Abu Dhabi T10';
  const screen = handle.handle.replace(/^@/, '');
  switch (handle.platform) {
    case 'YouTube':
      return handle.meta?.channelId ? <ChannelPlayer channelId={handle.meta.channelId} title={`${name} on YouTube`} /> : <ProfileCard handle={handle} team={team} />;
    case 'X':
      return (
        <Gate label={t('Show posts from {handle}', { handle: handle.handle })} platform="X">
          {() => <XTimeline screenName={screen} />}
        </Gate>
      );
    case 'Facebook':
      return (
        <Gate label={t('Show the {name} Facebook page', { name })} platform="Facebook">
          {() => <FacebookPage url={handle.url} name={name} />}
        </Gate>
      );
    case 'TikTok':
      return (
        <Gate label={t('Show TikTok videos from {handle}', { handle: handle.handle })} platform="TikTok">
          {() => <TikTokCreator username={screen} />}
        </Gate>
      );
    default:
      return <ProfileCard handle={handle} team={team} />;
  }
}

export function ProfileCard({ handle, team }: { handle: SocialHandle; team?: Team | null }) {
  const t = useT();
  const meta = PLATFORM_META[handle.platform] || PLATFORM_META.Web;
  return (
    <a href={handle.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-600 group" data-testid="profile-card">
      <span className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
        <PlatformIcon platform={handle.platform} className="w-6 h-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white truncate">{handle.handle}</span>
        <span className="block text-xs text-slate-400 truncate">
          {team?.name || t('League')} · {meta.label}
        </span>
      </span>
      <span className="text-xs font-bold text-amber-400 group-hover:text-amber-300 inline-flex items-center gap-1 shrink-0">
        {t('Open')} <ExternalLink className="w-3.5 h-3.5" />
      </span>
    </a>
  );
}

const instagramShortcode = (url: string) => url.match(/instagram\.com\/(?:p|reel|tv)\/([\w-]+)/)?.[1] || null;
const tiktokVideoId = (url: string) => url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/)?.[1] || null;
const tweetId = (url: string) => url.match(/(?:x|twitter)\.com\/\w+\/status\/(\d+)/)?.[1] || null;

function TweetEmbed({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    loadScript('https://platform.twitter.com/widgets.js', 'x-widgets').then(() => ref.current && (window as any).twttr?.widgets?.load(ref.current)).catch(() => undefined);
  }, [url]);
  return (
    <div ref={ref} data-testid="tweet-embed">
      <blockquote className="twitter-tweet" data-theme="dark" data-dnt="true">
        <a href={url.replace('://x.com/', '://twitter.com/')}>{url}</a>
      </blockquote>
    </div>
  );
}

/** Whether a post can be shown in place (as opposed to linking out). */
export function canEmbed(item: FeedItem) {
  return Boolean(item.videoId || instagramShortcode(item.url) || tiktokVideoId(item.url) || tweetId(item.url) || (item.platform === 'Facebook' && /\/(posts|videos|reel)\//.test(item.url)));
}

export function PostEmbed({ item }: { item: FeedItem }) {
  const t = useT();
  if (item.videoId) return <YouTubePlayer videoId={item.videoId} title={item.title} image={item.image} />;
  const ig = instagramShortcode(item.url);
  if (ig)
    return (
      <Gate label={t('Show this Instagram post')} platform="Instagram" minHeight={180}>
        {() => <iframe src={`https://www.instagram.com/p/${ig}/embed/`} title={item.title} className="w-full rounded-xl bg-white" style={{ height: 620 }} loading="lazy" data-testid="ig-iframe" />}
      </Gate>
    );
  const tk = tiktokVideoId(item.url);
  if (tk)
    return (
      <Gate label={t('Play this TikTok')} platform="TikTok" minHeight={180}>
        {() => (
          <div className="flex justify-center">
            <iframe src={`https://www.tiktok.com/embed/v2/${tk}`} title={item.title} className="rounded-xl bg-black" style={{ width: 325, height: 740, maxWidth: '100%' }} allow="encrypted-media; fullscreen" data-testid="tiktok-iframe" />
          </div>
        )}
      </Gate>
    );
  if (tweetId(item.url))
    return (
      <Gate label={t('Show this post from X')} platform="X" minHeight={140}>
        {() => <TweetEmbed url={item.url} />}
      </Gate>
    );
  if (item.platform === 'Facebook' && /\/(posts|videos|reel)\//.test(item.url)) {
    const isVideo = /\/(videos|reel)\//.test(item.url);
    return (
      <Gate label={t('Show this Facebook post')} platform="Facebook" minHeight={160}>
        {() => (
          <iframe
            src={`https://www.facebook.com/plugins/${isVideo ? 'video' : 'post'}.php?href=${encodeURIComponent(item.url)}&show_text=true&width=500`}
            title={item.title}
            className="w-full rounded-xl bg-white"
            style={{ height: isVideo ? 480 : 600, border: 'none' }}
            allow="encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        )}
      </Gate>
    );
  }
  return null;
}

export function FeedCard({ item, team, compact }: { item: FeedItem; team?: Team | null; compact?: boolean }) {
  const t = useT();
  const f = useFormat();
  const [expanded, setExpanded] = useState(false);
  const embeddable = canEmbed(item);
  const isNews = item.category === 'news';
  return (
    <article className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden flex flex-col" data-testid="feed-card" data-platform={item.platform}>
      {item.videoId ? (
        <YouTubePlayer videoId={item.videoId} title={item.title} image={item.image} />
      ) : expanded && embeddable ? (
        <div className="p-3">
          <PostEmbed item={item} />
        </div>
      ) : item.image && !compact ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block aspect-video bg-slate-950 overflow-hidden">
          <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" onError={e => ((e.target as HTMLElement).parentElement!.style.display = 'none')} />
        </a>
      ) : null}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-400 min-w-0">
          <PlatformIcon platform={item.platform} />
          <span className="font-semibold text-slate-300 truncate">{item.source}</span>
          {team && (
            <span className="inline-flex items-center gap-1 shrink-0">
              · <span className="w-2 h-2 rounded-full" style={{ background: team.color }} /> {team.short}
            </span>
          )}
          <span className="ms-auto shrink-0">{f.ago(item.publishedAt)}</span>
        </div>
        {item.status === 'pinned' && <span className="text-[10px] font-black uppercase text-amber-400">{t('Pinned')}</span>}
        <a href={item.url} target="_blank" rel="noopener noreferrer" className={cx('font-bold text-white hover:text-amber-200 leading-snug break-words', compact ? 'text-sm line-clamp-2' : 'text-[15px] line-clamp-3')}>
          {item.title}
        </a>
        {!compact && item.summary && item.summary !== item.title && <p className="text-xs text-slate-400 line-clamp-3 break-words">{item.summary}</p>}
        <div className="mt-auto pt-1 flex items-center gap-2 flex-wrap">
          {embeddable && !item.videoId && (
            <Button size="sm" variant="secondary" onClick={() => setExpanded(v => !v)}>
              {expanded ? t('Hide') : t('Show here')}
            </Button>
          )}
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-amber-400 hover:text-amber-300 inline-flex items-center gap-1 min-h-[36px]">
            {isNews ? t('Read at {source}', { source: item.source }) : t('Open on {platform}', { platform: PLATFORM_META[item.platform]?.label || item.platform })}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {item.views && <span className="text-[11px] text-slate-500 ms-auto">{item.views}</span>}
        </div>
      </div>
    </article>
  );
}
