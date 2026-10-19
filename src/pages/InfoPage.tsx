import React from 'react';
import { api } from '../api';
import { useApp, useLoad } from '../state';
import { useT } from '../i18n';
import { Link, usePageMeta } from '../router';
import { Card, PageHeader } from '../components/ui';

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-2">
      <h2 className="text-lg font-black text-white">{title}</h2>
      <div className="text-sm text-slate-300 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Rules() {
  const { config } = useApp();
  const t = useT();
  const { data } = useLoad(() => api.getFantasyRules(), []);
  const r = data?.rules;
  return (
    <div className="space-y-8">
      <Section title={t('Points and Fan Wars')}>
        <p>{t('Everything on the site is free to play. You earn season points from Dream XI, the daily games, predictions, daily check-ins, the forum and badges. The points also count for the team you back in Fan Wars. You can pick a team and switch once per season.')}</p>
        <p>{t('Spending points on prizes never lowers your leaderboard score: you have season points (for rankings) and a balance to spend.')}</p>
        <p>{t('Your profile shows every point you earned and spent, and why. If a post is removed, or a scorecard is corrected, the points it earned are adjusted and the change is listed there.')}</p>
      </Section>
      <Section id="dream-xi" title={t('Dream XI')}>
        {r && (
          <ul className="list-disc ps-5 space-y-1">
            <li>{t('Pick exactly {size} players for your fantasy squad from the two teams in a match.', { size: r.size })}</li>
            <li>{t('At most {max} players from one team, and {min}–{rmax} of each role (wicketkeeper, batter, all-rounder, bowler).', { max: r.maxFromOneTeam, min: r.roleMin, rmax: r.roleMax })}</li>
            <li>{t('Point allocation dynamically scales per player based on both historical form and upcoming pitch & match context.')}</li>
            <li>{t('Your captain scores {c}x and your vice-captain {vc}x.', { c: r.captainMultiplier, vc: r.viceCaptainMultiplier })}</li>
            <li>{t('You can change your team until the first ball. Points come from the official scorecard once the match ends.')}</li>
            <li>{t('Season points earned = your Dream XI points divided by {d}, rounded.', { d: r.fanPointsDivisor })}</li>
          </ul>
        )}
        {data && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {data.scoring.map(g => (
              <Card key={g.group} className="p-4">
                <p className="font-bold text-white mb-2">{t(g.group)}</p>
                <ul className="space-y-1 text-xs">
                  {g.rules.map(([label, pts]) => (
                    <li key={String(label)} className="flex justify-between gap-2">
                      <span>{t(String(label))}</span>
                      <span className="font-mono font-bold text-amber-300">{typeof pts === 'number' && pts > 0 ? `+${pts}` : pts}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </Section>
      <Section id="games" title={t('Daily games')}>
        <p>{t('Guess the Player: a mystery player from the six squads. You have 5 guesses; each wrong guess shows whether you matched the team and role, and reveals another clue. Solving it earns 50, 40, 30, 20 or 10 points depending on the guess.')}</p>
        <p>{t('Super Over: bat six balls with two wickets. Safer shots score less; riskier shots score more but get out more often. You earn your runs as points, plus 15 if you beat the day’s target.')}</p>
        <p>{t('Each game can be played once a day; both reset at midnight UAE time.')}</p>
      </Section>
      <Section id="predictions" title={t('Predictions')}>
        <p>{t('Each question shows its points. Predictions close at the time shown (usually the first ball). Points are added when the correct answers are confirmed. Instant quizzes are marked straight away and can be played once.')}</p>
        <p>{t('Quiz answers are shown when the quiz closes.')}</p>
      </Section>
      <Section id="draws" title={t('Prize draws and prizes')}>
        <p>{t('Prize draws are free to enter. Some are limited to fans of one team or need a minimum number of season points. Winners are picked with a verifiable method; open "Verify" on a drawn prize to see the seed and entrant hash.')}</p>
        <p>{t('Prizes can be claimed with your points while stock lasts. Each claim has a code and says how you will receive it. If a claim is cancelled, the points are returned.')}</p>
      </Section>
      <Section id="invites" title={t('Invite friends')}>
        <p>{t('Share your invite link from your profile. When a friend signs up with it and plays their first game (Dream XI, a daily game, a prediction or a forum post), you both get {n} points.', { n: config?.referralRewardPoints ?? 50 })}</p>
        {(config?.referralMaxRewarded ?? 10) > 0 && <p>{t('You are rewarded for up to {max} friends this season; friends who join after that still get their own points.', { max: config?.referralMaxRewarded ?? 10 })}</p>}
      </Section>
      <Section id="forum" title={t('Forum')}>
        <p>{t('Be respectful. No abuse, hate, spam or betting promotion. Posts reported by several fans are hidden until a moderator reviews them. Forum points are capped at 50 a day.')}</p>
        <p>{t('A thread earns 15 points and a reply 5. If a post is removed, its points are taken back.')}</p>
      </Section>
    </div>
  );
}

function Privacy() {
  const t = useT();
  return (
    <div className="space-y-6">
      <Section title={t('What we store')}>
        <p>{t('Your email address, display name, optional photo link, country and city, the team you back, your points and game entries, forum posts, prize claims and Fan Space passes. If you turn on push notifications we store your device’s push token.')}</p>
      </Section>
      <Section title={t('Why')}>
        <p>{t('To run your account, the games and leaderboards, to deliver prizes and passes, and to send the notifications you asked for. We do not sell personal data.')}</p>
      </Section>
      <Section title={t('Embedded content')}>
        <p>{t('Videos and posts from YouTube, X, Facebook, Instagram and TikTok load from those services: an official account’s feed loads when you scroll to it, and single posts load when you tap them. Those services may set their own cookies once loaded. YouTube videos use the privacy-enhanced youtube-nocookie.com player.')}</p>
      </Section>
      <Section title={t('Your choices')}>
        <p>{t('You can edit your details or delete your account at any time from your profile. Deleting removes your account, points and entries; forum posts stay but show as "Former fan".')}</p>
      </Section>
    </div>
  );
}

function Terms() {
  const t = useT();
  return (
    <div className="space-y-6">
      <Section title={t('About this site')}>
        <p>{t('This is an independent fan hub, brought to you by the Arabian Aces franchise. It is not the official Abu Dhabi T10 website. Team names and logos belong to their owners. News links go to the original publishers.')}</p>
      </Section>
      <Section title={t('Games and prizes')}>
        <p>{t('All games are free to play and involve no payment or wagering. Prizes and draws are subject to the conditions shown with each one. We may disqualify entries that use multiple accounts or automation.')}</p>
      </Section>
      <Section title={t('Your posts')}>
        <p>{t('You are responsible for what you post. Moderators may hide or remove posts that break the forum rules.')}</p>
      </Section>
    </div>
  );
}

export default function InfoPage({ kind }: { kind: 'rules' | 'privacy' | 'terms' }) {
  const { config } = useApp();
  const t = useT();
  const title = kind === 'rules' ? t('Rules and scoring') : kind === 'privacy' ? t('Privacy') : t('Terms of use');
  usePageMeta(title, undefined, config?.brandName);
  return (
    <div className="max-w-3xl">
      <PageHeader title={title} />
      {kind === 'rules' ? <Rules /> : kind === 'privacy' ? <Privacy /> : <Terms />}
      <p className="mt-10 text-xs text-slate-500">
        <Link to="/rules" className="underline">{t('Rules')}</Link> · <Link to="/privacy" className="underline">{t('Privacy')}</Link> · <Link to="/terms" className="underline">{t('Terms')}</Link>
      </p>
    </div>
  );
}
