import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { api } from '../api';
import { useLoad } from '../state';
import { useT } from '../i18n';
import { Card, Spinner, cx } from './ui';

/**
 * How Pick 5 points are worked out: the same scoreboard rules as Pick XI (runs, boundaries, strike
 * rate, wickets, economy, catches, stumpings and run outs), read from the match scorecard. The
 * numbers come from the server's own scoring table, so this page always matches what is scored.
 */
export function Pick5Rules({ open: startOpen = false, divisor = 5 }: { open?: boolean; divisor?: number }) {
  const t = useT();
  const [open, setOpen] = useState(startOpen);
  const rules = useLoad(() => api.getFantasyRules(), []);
  // Pick 5 has a captain (double points) and no vice-captain.
  const groups = (rules.data?.scoring || []).map(g =>
    /Multipliers/i.test(g.group) ? { group: g.group, rules: g.rules.filter(r => !/Vice/i.test(String(r[0]))).map(r => (/Captain/i.test(String(r[0])) ? [r[0], '2x'] as [string, string] : r)) } : g,
  );
  return (
    <Card className="p-0 overflow-hidden" data-testid="pick5-rules">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="w-full flex items-center justify-between gap-3 p-4 text-start">
        <span>
          <span className="block font-black text-white">{t('How Pick 5 points work')}</span>
          <span className="block text-xs text-slate-400">{t('Scored from the official scorecard: runs, boundaries, strike rate, wickets, economy, catches, stumpings and run outs.')}</span>
        </span>
        <ChevronDown className={cx('w-5 h-5 text-slate-400 transition-transform shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 text-sm">
          <ul className="list-disc ps-5 space-y-1 text-slate-300 text-xs">
            <li>{t('Pick 5 players from the team’s squad (once the playing XI is announced, only from the XI). One of them is your captain, who scores double.')}</li>
            <li>{t('Points come from the match scorecard: the live feed, or the scorecard entered by the team or league admins when live scores are not available.')}</li>
            <li>{t('Each player’s points are added up; your fan points are the total ÷ {d}, rounded. A corrected scorecard re-scores every pick.', { d: divisor })}</li>
            <li>{t('Run outs: the fielder named in “run out (Name)” gets the points; two fielders share them.')}</li>
          </ul>
          {rules.loading && !rules.data ? (
            <Spinner />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groups.map(g => (
                <div key={g.group} className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-300 mb-1.5">{g.group}</p>
                  <table className="w-full text-xs">
                    <tbody>
                      {g.rules.map(([label, pts]) => (
                        <tr key={String(label)} className="border-t border-slate-800/70 first:border-0">
                          <td className="py-1 pe-2 text-slate-300">{label}</td>
                          <td className={cx('py-1 text-end font-black tabular-nums', typeof pts === 'number' && pts < 0 ? 'text-red-300' : 'text-white')}>
                            {typeof pts === 'number' && pts > 0 ? `+${pts}` : pts}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
