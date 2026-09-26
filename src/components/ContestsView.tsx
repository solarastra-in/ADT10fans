import React, { useState } from 'react';
import { Contest, Team, User, Player } from '../types';
import { 
  Sparkles, 
  Trophy, 
  HelpCircle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  ArrowRight,
  Flame,
  Award,
  Users
} from 'lucide-react';

interface ContestsViewProps {
  contests: Contest[];
  teams: Team[];
  user: User | null;
  onOpenAuth: () => void;
  onEnterContest: (contestId: string, answers: Record<string, string>) => Promise<any>;
  onSubmitFantasy: (matchId: string, playerIds: string[], captainId: string) => Promise<any>;
  onNavigateToProfile?: () => void;
}

export const ContestsView: React.FC<ContestsViewProps> = ({
  contests,
  teams,
  user,
  onOpenAuth,
  onEnterContest,
  onSubmitFantasy,
  onNavigateToProfile
}) => {
  const [activeTab, setActiveTab] = useState<'contests' | 'fantasy' | 'trivia'>('contests');
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; points?: number } | null>(null);

  // Fantasy 10 State
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [captainId, setCaptainId] = useState<string>('');
  const [fantasySubmitted, setFantasySubmitted] = useState(false);

  // All players pool
  const allPlayers = teams.flatMap(t => t.squad);
  const maxCredits = 55.0;
  const currentCredits = selectedPlayers.reduce((acc, pId) => {
    const p = allPlayers.find(pl => pl.id === pId);
    return acc + (p?.credits || 0);
  }, 0);

  const togglePlayer = (pId: string) => {
    if (selectedPlayers.includes(pId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== pId));
      if (captainId === pId) setCaptainId('');
    } else {
      if (selectedPlayers.length >= 6) {
        alert('You can select maximum 6 players for your T10 Fantasy squad.');
        return;
      }
      const player = allPlayers.find(pl => pl.id === pId);
      if (player && currentCredits + player.credits > maxCredits) {
        alert(`Credit limit exceeded! Remaining budget: ${(maxCredits - currentCredits).toFixed(1)}`);
        return;
      }
      setSelectedPlayers([...selectedPlayers, pId]);
    }
  };

  const handleContestSubmit = async (contest: Contest) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await onEnterContest(contest.id, answers);
      setFeedback({
        message: contest.instant 
          ? `Quiz complete! You earned ${res.pointsAwarded || 0} fan points!` 
          : 'Prediction locked in! Good luck!',
        points: res.pointsAwarded
      });
    } catch (e: any) {
      alert(e?.message || 'Error submitting prediction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFantasySubmit = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (selectedPlayers.length !== 6) {
      alert('Please select exactly 6 players.');
      return;
    }
    if (!captainId) {
      alert('Please choose a Captain for 2x points.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitFantasy('m-1', selectedPlayers, captainId);
      setFantasySubmitted(true);
    } catch (e: any) {
      alert(e?.message || 'Error submitting Fantasy squad');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Trophy className="w-4 h-4" /> Fan Contests & Fantasy 10
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Compete, Predict & Earn Points
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Test your cricket IQ in the 90-minute format. Every point you score powers your franchise in Fan Wars.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold">
          <button
            onClick={() => { setActiveTab('contests'); setSelectedContest(null); setFeedback(null); }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'contests'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Predictors & Oracle
          </button>
          <button
            onClick={() => { setActiveTab('fantasy'); setSelectedContest(null); setFeedback(null); }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'fantasy'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Fantasy 10 Squad
          </button>
          <button
            onClick={() => { setActiveTab('trivia'); setSelectedContest(null); setFeedback(null); }}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'trivia'
                ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            History Quiz
          </button>
        </div>
      </div>

      {/* Achievement Badges Spotlight Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center flex-shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <span>Achievement Badges Active</span>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">New</span>
            </h4>
            <p className="text-xs text-slate-300">
              Entering match predictors, scoring contest victories, and drafting Fantasy 10 lineups unlocks official metallic badges and bonus Fan Points.
            </p>
          </div>
        </div>

        {onNavigateToProfile && user && (
          <button
            onClick={onNavigateToProfile}
            className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-400 border border-amber-500/30 hover:border-amber-400 text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <span>View Badges in Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Contests / Predictor Tab */}
      {activeTab === 'contests' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {contests.filter(c => c.type !== 'trivia').map(contest => {
            const isSelected = selectedContest?.id === contest.id;

            return (
              <div
                key={contest.id}
                className="rounded-2xl p-5 sm:p-6 bg-slate-900 border border-slate-800 hover:border-amber-400/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 font-black text-[10px] uppercase">
                      {contest.type}
                    </span>
                    <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Status: <strong className="text-emerald-400 capitalize">{contest.status}</strong>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg text-white mb-1.5">
                    {contest.title}
                  </h3>
                  <p className="text-xs text-slate-300 mb-4">
                    {contest.description}
                  </p>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs mb-4">
                    <span className="text-slate-400">Prize Reward:</span>
                    <p className="text-amber-300 font-bold mt-0.5">{contest.prize}</p>
                  </div>

                  {/* Questions Form */}
                  {isSelected && (
                    <div className="space-y-4 pt-3 border-t border-slate-800/80 animate-in fade-in">
                      {contest.questions.map((q, idx) => (
                        <div key={q.id} className="space-y-2">
                          <label className="block text-xs font-bold text-white">
                            {idx + 1}. {q.prompt} ({q.points} pts)
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            {q.options.map(opt => {
                              const checked = answers[q.id] === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setAnswers({ ...answers, [q.id]: opt })}
                                  className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all ${
                                    checked
                                      ? 'bg-amber-400 text-slate-950 border-amber-400 font-black shadow-md'
                                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {feedback && (
                        <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
                          {feedback.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-xs text-slate-400">
                    {contest.questions.length} Question(s)
                  </span>

                  {isSelected ? (
                    <button
                      onClick={() => handleContestSubmit(contest)}
                      disabled={submitting}
                      className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20"
                    >
                      {submitting ? 'Locking In...' : 'Confirm & Lock In'}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setSelectedContest(contest); setAnswers({}); setFeedback(null); }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700"
                    >
                      Open Questions →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Fantasy 10 Builder Tab */}
      {activeTab === 'fantasy' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Roster Selection */}
          <div className="lg:col-span-8 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-base text-white">Select Your 6-Player Fantasy 10 Squad</h3>
                <p className="text-xs text-slate-400">Choose across all teams. Stay under 55 credits total.</p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div>
                  <span className="text-slate-400">Players: </span>
                  <span className={selectedPlayers.length === 6 ? 'text-emerald-400 font-mono text-sm' : 'text-amber-400 font-mono text-sm'}>
                    {selectedPlayers.length}/6
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Credits: </span>
                  <span className={currentCredits > maxCredits ? 'text-red-400 font-mono text-sm' : 'text-emerald-400 font-mono text-sm'}>
                    {currentCredits.toFixed(1)} / {maxCredits.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
              {allPlayers.map(p => {
                const isSelected = selectedPlayers.includes(p.id);
                const isCaptain = captainId === p.id;
                const team = teams.find(t => t.id === p.teamId);

                return (
                  <div
                    key={p.id}
                    onClick={() => togglePlayer(p.id)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white"
                        style={{ backgroundColor: team?.color || '#E8B04A' }}
                      >
                        {team?.short}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-white">{p.name}</span>
                          {p.isIcon && (
                            <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1 rounded font-bold">
                              ICON
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize">{p.role} · {team?.name}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-bold text-xs text-amber-300">{p.credits} cr</span>
                      {isSelected && (
                        <div className="mt-1">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setCaptainId(p.id); }}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isCaptain
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300 hover:text-white'
                            }`}
                          >
                            {isCaptain ? 'Captain (2x)' : 'Set C'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Squad Summary Card */}
          <div className="lg:col-span-4 rounded-2xl p-5 bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="font-extrabold text-sm text-white">Your Lineup</h3>
              </div>

              {selectedPlayers.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Click on players from the list to add them to your 6-player squad.
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  {selectedPlayers.map(pId => {
                    const p = allPlayers.find(pl => pl.id === pId);
                    if (!p) return null;
                    const isCap = captainId === p.id;
                    return (
                      <div key={p.id} className="p-2 rounded-lg bg-slate-950 flex items-center justify-between text-xs">
                        <span className="font-bold text-white flex items-center gap-1.5">
                          {p.name} {isCap && <span className="text-amber-400 font-mono font-black">(C · 2x)</span>}
                        </span>
                        <span className="text-slate-400 font-mono">{p.credits} cr</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-400">Captain Picked:</span>
                <span className={captainId ? 'text-amber-400' : 'text-red-400'}>
                  {captainId ? allPlayers.find(p => p.id === captainId)?.name : 'Required'}
                </span>
              </div>

              {fantasySubmitted ? (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">
                  ✓ Fantasy Squad Locked In! +50 Fan Bonus Awarded
                </div>
              ) : (
                <button
                  onClick={handleFantasySubmit}
                  disabled={submitting || selectedPlayers.length !== 6 || !captainId || currentCredits > maxCredits}
                  className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Confirm Fantasy 10 Lineup'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History Quiz / Trivia Tab */}
      {activeTab === 'trivia' && (
        <div className="max-w-2xl mx-auto space-y-6">
          {contests.filter(c => c.type === 'trivia').map(contest => (
            <div key={contest.id} className="rounded-2xl p-6 bg-slate-900 border border-amber-500/30 shadow-xl">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-400/10 text-amber-400 mb-2">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-white">{contest.title}</h3>
                <p className="text-xs text-slate-400 mt-1">{contest.description}</p>
              </div>

              <div className="space-y-6">
                {contest.questions.map((q, idx) => {
                  const chosen = answers[q.id];
                  const isAnswered = !!chosen;
                  const isCorrect = chosen === q.answer;

                  return (
                    <div key={q.id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-extrabold text-sm text-white">
                          {idx + 1}. {q.prompt}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-amber-400">
                          +{q.points} pts
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map(opt => {
                          const isThisOption = chosen === opt;
                          let btnStyle = 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700';

                          if (isAnswered) {
                            if (opt === q.answer) {
                              btnStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold';
                            } else if (isThisOption && !isCorrect) {
                              btnStyle = 'bg-red-500/20 text-red-300 border-red-500/50 line-through';
                            }
                          }

                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                if (!isAnswered) {
                                  setAnswers({ ...answers, [q.id]: opt });
                                }
                              }}
                              className={`p-2.5 rounded-xl text-xs text-left border transition-all ${btnStyle}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {isAnswered && q.explain && (
                        <div className={`p-2.5 rounded-lg text-xs ${isCorrect ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'}`}>
                          {isCorrect ? '✓ Correct! ' : '✗ Incorrect. '}
                          {q.explain}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">
                  {Object.keys(answers).length}/{contest.questions.length} Answered
                </span>
                <button
                  onClick={() => handleContestSubmit(contest)}
                  disabled={submitting || Object.keys(answers).length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Claiming Points...' : 'Claim Fan Points'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
