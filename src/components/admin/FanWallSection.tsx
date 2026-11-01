import React, { useEffect, useState } from 'react';
import { Check, EyeOff, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { api } from '../../api';
import type { FanPostView, Team } from '../../types';
import { Button, Card, Chip, EmptyState, Field, Notice, SectionHeader, Sheet, TextInput, formatDateTime, useRunner } from './ui';

type Status = 'pending' | 'reported' | 'live' | 'hidden';

/**
 * Fan wall moderation and Fan of the Day. Photos wait here until approved (Settings → fan wall
 * review). Picking a Fan of the Day gives the fan points and notifies them; picking another post the
 * same day moves the title and the points.
 */
export const FanWallSection: React.FC<{ teams: Team[]; /** Team portal: moderation only (Fan of the Day is the league's pick). */ teamMode?: boolean }> = ({ teams, teamMode }) => {
  const [status, setStatus] = useState<Status>('pending');
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getAdminFanWall>> | null>(null);
  const [feature, setFeature] = useState<{ post: FanPostView; points: string; note: string } | null>(null);
  const { busy, notice, setNotice, run } = useRunner();
  const load = async (s = status) => {
    const r = await api.getAdminFanWall(s).catch(e => {
      setNotice({ kind: 'err', text: e.message });
      return null;
    });
    if (r) setData(r);
  };
  useEffect(() => {
    void load(status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);
  const act = async (p: FanPostView, action: 'approve' | 'hide' | 'restore' | 'delete') => {
    if (action === 'delete' && !window.confirm('Delete this post and its photo? The fan loses the points it earned.')) return;
    if (await run(`${action}:${p.id}`, () => api.moderateFanPost(p.id, action), action === 'approve' ? 'Approved: it is on the wall.' : action === 'hide' ? 'Hidden.' : action === 'restore' ? 'Back on the wall.' : 'Deleted.')) load();
  };
  const pick = async () => {
    if (!feature) return;
    const points = Number(feature.points);
    const r = await run('feature', () => api.featureFanPost(feature.post.id, { points: Number.isFinite(points) ? points : undefined, note: feature.note.trim() || undefined }), `${feature.post.userName} is today's Fan of the Day.`);
    if (r) {
      setFeature(null);
      load();
    }
  };
  const teamName = (id: string | null) => (id ? teams.find(t => t.id === id)?.short || id : '—');
  const tabs: [Status, string, number | undefined][] = [
    ['pending', 'Waiting for review', data?.counts.pending],
    ['reported', 'Reported', data?.counts.reported],
    ['live', 'On the wall', data?.counts.live],
    ['hidden', 'Hidden', undefined],
  ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Fan wall"
        description="Approve fans' photos, deal with reports, and pick a Fan of the Day. What waits for review, and how many points Fan of the Day is worth, are set in Settings."
      />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!teamMode && <Card className="p-4 flex flex-wrap items-center gap-3">
        <Trophy className="w-5 h-5 text-amber-400" />
        {data?.today ? (
          <p className="text-sm text-slate-200">
            Today's Fan of the Day: <strong className="text-white">{data.today.userName}</strong> (+{data.today.points} points). Pick another post to move the title.
          </p>
        ) : (
          <p className="text-sm text-slate-300">No Fan of the Day yet today. Open "On the wall" and pick one.</p>
        )}
      </Card>}
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${status === id ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-slate-700 text-slate-300'}`}
          >
            {label}
            {n ? ` (${n})` : ''}
          </button>
        ))}
      </div>
      {!data ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : data.posts.length === 0 ? (
        <EmptyState title="Nothing here" description={status === 'pending' ? 'No posts are waiting for review.' : 'No posts in this list.'} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {data.posts.map(p => (
            <Card key={p.id} className="overflow-hidden">
              {p.photoUrl && <img src={p.photoUrl} alt="" className="w-full max-h-64 object-cover bg-slate-950" loading="lazy" />}
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <strong className="text-white">{p.userName}</strong>
                  <span>{teamName(p.teamId)}</span>
                  <span>·</span>
                  <span>{formatDateTime(p.createdAt)}</span>
                  {p.featuredOn.length > 0 && <Chip tone="amber">Fan of the Day</Chip>}
                </div>
                {p.text && <p className="text-sm text-slate-200 whitespace-pre-line">{p.text}</p>}
                {(p.reports || 0) > 0 && (
                  <p className="text-xs text-rose-300">
                    {p.reports} report(s): {(p.reportReasons || []).slice(0, 3).join('; ')}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {p.status !== 'live' && (
                    <Button size="sm" variant="primary" icon={<Check className="w-4 h-4" />} loading={busy === `approve:${p.id}`} onClick={() => act(p, 'approve')}>
                      Approve
                    </Button>
                  )}
                  {p.status === 'live' && (p.reports || 0) > 0 && (
                    <Button size="sm" icon={<RotateCcw className="w-4 h-4" />} loading={busy === `restore:${p.id}`} onClick={() => act(p, 'restore')}>
                      Keep (clear reports)
                    </Button>
                  )}
                  {p.status === 'live' && !teamMode && (
                    <Button size="sm" variant="primary" icon={<Trophy className="w-4 h-4" />} onClick={() => setFeature({ post: p, points: String(data.fanOfTheDayPoints), note: '' })}>
                      Fan of the Day
                    </Button>
                  )}
                  {p.status !== 'hidden' && (
                    <Button size="sm" icon={<EyeOff className="w-4 h-4" />} loading={busy === `hide:${p.id}`} onClick={() => act(p, 'hide')}>
                      Hide
                    </Button>
                  )}
                  <Button size="sm" variant="danger" icon={<Trash2 className="w-4 h-4" />} loading={busy === `delete:${p.id}`} onClick={() => act(p, 'delete')}>
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Sheet
        open={Boolean(feature)}
        title="Fan of the Day"
        onClose={() => setFeature(null)}
        footer={
          <>
            <Button onClick={() => setFeature(null)}>Cancel</Button>
            <Button variant="primary" onClick={pick} loading={busy === 'feature'}>
              Make Fan of the Day
            </Button>
          </>
        }
      >
        {feature && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              <strong className="text-white">{feature.post.userName}</strong> gets the points and a notification, and the post goes to the top of the wall for today.
            </p>
            <Field label="Points" hint="0 to 1000. The default is set in Settings.">
              <TextInput type="number" min={0} max={1000} value={feature.points} onChange={e => setFeature({ ...feature, points: e.target.value })} />
            </Field>
            <Field label="Why (optional, shown on the wall)" hint="e.g. “Drove from Al Ain for every match”">
              <TextInput value={feature.note} maxLength={200} onChange={e => setFeature({ ...feature, note: e.target.value })} />
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
};
