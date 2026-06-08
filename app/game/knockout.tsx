import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ensureUserInDb, saveUserPredictions } from '../../lib/supabaseClient';
import {
  buildKnockoutBracket,
  resolveBracketTeams,
  KnockoutMatch,
} from '../../lib/knockout';
import Navbar from '../../components/Navbar';
import {
  CheckCircle,
  AlertCircle,
  Swords,
  Save,
  Database,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Props {
  allPredictions: Record<string, Record<string, { home_score: number; away_score: number }>>;
  onBackToGroups: () => void;
}

interface ScoreInput {
  home: string;
  away: string;
}

const STEPS = [
  { key: 'round_of_32', name: '\uD83D\uDD35 Round of 32', short: 'R32' },
  { key: 'round_of_16', name: '\uD83D\uDFE2 Round of 16', short: 'R16' },
  { key: 'quarter_final', name: '\uD83D\uDFE1 Quarter-Finals', short: 'QF' },
  { key: 'semi_final', name: '\uD83D\uDFE0 Semi-Finals', short: 'SF' },
  { key: 'finals', name: '\uD83D\uDD34 Finals', short: 'FIN' },
];

// Static match IDs per step (from buildKnockoutBracket in lib/knockout.ts)
const STEP_IDS: number[][] = [
  [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88],
  [89, 90, 91, 92, 93, 94, 95, 96],
  [97, 98, 99, 100],
  [101, 102],
  [103, 104],
];

function getMatchesForStep(bracket: KnockoutMatch[][], step: number): KnockoutMatch[] {
  if (step <= 3) return bracket[step] || [];
  return [...(bracket[4] || []), ...(bracket[5] || [])];
}

function hasWinner(a: string, b: string): boolean {
  const nA = parseInt(a, 10);
  const nB = parseInt(b, 10);
  return !isNaN(nA) && !isNaN(nB) && nA !== nB;
}

function deriveWinners(
  scores: Record<number, ScoreInput>,
  matchIds: number[],
): Record<number, 'home' | 'away'> {
  const out: Record<number, 'home' | 'away'> = {};
  for (const id of matchIds) {
    const s = scores[id];
    if (!s) continue;
    const h = parseInt(s.home, 10);
    const a = parseInt(s.away, 10);
    if (!isNaN(h) && !isNaN(a) && h !== a) {
      out[id] = h > a ? 'home' : 'away';
    }
  }
  return out;
}

const KnockoutStage = ({ allPredictions, onBackToGroups }: Props) => {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState(0);
  const [knockoutScores, setKnockoutScores] = useState<Record<number, ScoreInput>>({});
  const [bracketRounds, setBracketRounds] = useState<KnockoutMatch[][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selectedWinners = useMemo<Record<number, 'home' | 'away'>>(() => {
    const ids: number[] = [];
    for (let s = 0; s < currentStep; s++) {
      ids.push(...STEP_IDS[s]);
    }
    return deriveWinners(knockoutScores, ids);
  }, [knockoutScores, currentStep]);

  useEffect(() => {
    const rounds = buildKnockoutBracket(allPredictions);
    const resolved = resolveBracketTeams(rounds, allPredictions, selectedWinners);
    setBracketRounds(resolved);
  }, [allPredictions, selectedWinners]);

  // ── Per‑user localStorage helpers ──────────────────────────────
  const storagePrefix = useMemo(() => {
    const user = localStorage.getItem('worldcup_username');
    return user ? `wck_${user}` : 'wck';
  }, []);

  useEffect(() => {
    try {
      // Migrate old global worldcup_predictions_finalized to scoped key
      if (storagePrefix) {
        const oldFinalized = localStorage.getItem('worldcup_predictions_finalized');
        if (oldFinalized && !localStorage.getItem(`${storagePrefix}_finalized`)) {
          localStorage.setItem(`${storagePrefix}_finalized`, oldFinalized);
          localStorage.removeItem('worldcup_predictions_finalized');
        }
      }

      const step = localStorage.getItem(`${storagePrefix}_step`);
      const scores = localStorage.getItem(`${storagePrefix}_scores`);
      if (step) setCurrentStep(parseInt(step, 10));
      if (scores) setKnockoutScores(JSON.parse(scores));
    } catch { /* ignore */ }
  }, [storagePrefix]);

  useEffect(() => {
    localStorage.setItem(`${storagePrefix}_step`, String(currentStep));
  }, [currentStep, storagePrefix]);

  useEffect(() => {
    localStorage.setItem(`${storagePrefix}_scores`, JSON.stringify(knockoutScores));
  }, [knockoutScores, storagePrefix]);

  const currentMatches = useMemo(
    () => getMatchesForStep(bracketRounds, currentStep),
    [bracketRounds, currentStep],
  );

  const filledCount = currentMatches.filter((m) => {
    const s = knockoutScores[m.id];
    return s && hasWinner(s.home, s.away);
  }).length;

  const hasTbdTeams = currentMatches.some((m) => !m.home_team || !m.away_team);
  const allFilled = filledCount === currentMatches.length && currentMatches.length > 0 && !hasTbdTeams;
  const isLastStep = currentStep === STEPS.length - 1;

  const handleScoreChange = (matchId: number, side: 'home' | 'away', value: string) => {
    setKnockoutScores((prev) => ({
      ...prev,
      [matchId]: { ...(prev[matchId] || { home: '0', away: '0' }), [side]: value },
    }));
  };

  const handleSaveRound = () => {
    if (!allFilled) return;
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBackStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleFinalizeSave = async () => {
    if (!allFilled) return;

    const savedUser = localStorage.getItem('worldcup_username');
    const savedId = localStorage.getItem('worldcup_user_id');
    if (!savedUser || !savedId) {
      navigate('/');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const allIds: number[] = [];
      for (let s = 0; s < STEPS.length; s++) {
        const ms = getMatchesForStep(bracketRounds, s);
        ms.forEach((m) => allIds.push(m.id));
      }
      const allWinners = deriveWinners(knockoutScores, allIds);

      const finalBracket = bracketRounds.map((round) =>
        round.map((m) => ({
          ...m,
          winner: allWinners[m.id] || m.winner,
        })),
      );

      // Convert knockout scores to proper format for saving
      const knockoutScoresForSave: Record<number, { home_score: number; away_score: number }> = {};
      Object.entries(knockoutScores).forEach(([matchId, score]) => {
        const h = parseInt(score.home, 10);
        const a = parseInt(score.away, 10);
        if (!isNaN(h) && !isNaN(a)) {
          knockoutScoresForSave[parseInt(matchId)] = { home_score: h, away_score: a };
        }
      });

      const allData = {
        group_predictions: allPredictions,
        knockout_scores: knockoutScoresForSave,
        knockout_winners: allWinners,
        knockout_bracket: finalBracket.map((round) =>
          round.map((m) => ({
            id: m.id,
            round: m.round,
            home_team: m.home_team,
            away_team: m.away_team,
            winner: m.winner,
          })),
        ),
      };

      const savedPassword = localStorage.getItem('worldcup_password') || '';
      await ensureUserInDb(savedId, savedUser, savedPassword);
      await saveUserPredictions(savedId, allData as any);

      localStorage.setItem(`${storagePrefix}_finalized`, 'true');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 5000);
    } catch (err: any) {
      console.error('Error saving:', err);
      setSaveError(err.message || 'Failed to save predictions.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMatchCard = (match: KnockoutMatch) => {
    const id = match.id;
    const input = knockoutScores[id] || { home: '0', away: '0' };
    const isTouched = !!knockoutScores[id];
    const isDraw = isTouched && input.home === input.away;
    const hasValidScores = hasWinner(input.home, input.away);

    const homeWins = hasValidScores && parseInt(input.home, 10) > parseInt(input.away, 10);
    const awayWins = hasValidScores && parseInt(input.away, 10) > parseInt(input.home, 10);

    return (
      <div
        key={id}
        className={`glass-panel rounded-xl border p-3 transition-all ${
          hasValidScores
            ? 'border-cupEmerald-500/40 bg-slate-800/60'
            : isDraw
              ? 'border-amber-500/40 bg-slate-800/50'
              : 'border-slate-700/60 bg-slate-800/30'
        }`}
      >
        <div className="flex items-center gap-2 relative">
          <div className={`flex-1 text-right min-w-0 ${homeWins ? 'bg-cupGold-500/10 rounded-lg px-2 py-1 -ml-2' : ''}`}>
            <div className="flex items-center justify-end gap-1.5">
              <span className={`text-xs sm:text-sm font-semibold truncate ${homeWins ? 'text-cupGold-300' : 'text-slate-200'}`}>
                {match.home_team || 'TBD'}
              </span>
              {match.home_flag && (
                <img
                  src={match.home_flag}
                  alt=""
                  className={`w-5 h-4 object-cover rounded-sm flex-shrink-0 border ${homeWins ? 'border-cupGold-500/60' : 'border-slate-600'}`}
                />
              )}
              {homeWins && (
                <span className="text-[10px] text-cupGold-400 font-bold flex-shrink-0">✔</span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <button type="button" onClick={() => {
              const c = parseInt(input.home || '0', 10);
              if (c < 20) handleScoreChange(id, 'home', String(c + 1));
            }} disabled={parseInt(input.home || '0') >= 20}
              className="w-7 h-5 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-600"
            >+</button>
            <input type="number" min="0" max="20" placeholder="0" value={input.home}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (e.target.value === '' || (!isNaN(n) && n >= 0 && n <= 999)) {
                  handleScoreChange(id, 'home', e.target.value);
                }
              }}
              className={`w-9 h-9 text-center text-sm font-extrabold bg-slate-900 border rounded-lg text-white focus:outline-none transition-all placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isDraw ? 'border-amber-500 focus:border-amber-400'
                  : hasValidScores ? 'border-cupEmerald-500 focus:border-cupEmerald-400'
                  : 'border-slate-700 focus:border-cupGold-500'
              }`}
            />
            <button type="button" onClick={() => {
              const c = parseInt(input.home || '0', 10);
              if (c > 0) handleScoreChange(id, 'home', String(c - 1));
            }} disabled={parseInt(input.home || '0') <= 0}
              className="w-7 h-5 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-600"
            >−</button>
          </div>

          <span className="text-slate-500 font-bold text-sm self-center">:</span>

          <div className="flex flex-col items-center gap-0.5">
            <button type="button" onClick={() => {
              const c = parseInt(input.away || '0', 10);
              if (c < 20) handleScoreChange(id, 'away', String(c + 1));
            }} disabled={parseInt(input.away || '0') >= 20}
              className="w-7 h-5 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-600"
            >+</button>
            <input type="number" min="0" max="20" placeholder="0" value={input.away}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (e.target.value === '' || (!isNaN(n) && n >= 0 && n <= 999)) {
                  handleScoreChange(id, 'away', e.target.value);
                }
              }}
              className={`w-9 h-9 text-center text-sm font-extrabold bg-slate-900 border rounded-lg text-white focus:outline-none transition-all placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                isDraw ? 'border-amber-500 focus:border-amber-400'
                  : hasValidScores ? 'border-cupEmerald-500 focus:border-cupEmerald-400'
                  : 'border-slate-700 focus:border-cupGold-500'
              }`}
            />
            <button type="button" onClick={() => {
              const c = parseInt(input.away || '0', 10);
              if (c > 0) handleScoreChange(id, 'away', String(c - 1));
            }} disabled={parseInt(input.away || '0') <= 0}
              className="w-7 h-5 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-600"
            >−</button>
          </div>

          <div className={`flex-1 min-w-0 ${awayWins ? 'bg-cupGold-500/10 rounded-lg px-2 py-1 -mr-2' : ''}`}>
            <div className="flex items-center gap-1.5">
              {awayWins && (
                <span className="text-[10px] text-cupGold-400 font-bold flex-shrink-0">✔</span>
              )}
              {match.away_flag && (
                <img src={match.away_flag} alt="" className={`w-5 h-4 object-cover rounded-sm flex-shrink-0 border ${awayWins ? 'border-cupGold-500/60' : 'border-slate-600'}`} />
              )}
              <span className={`text-xs sm:text-sm font-semibold truncate ${awayWins ? 'text-cupGold-300' : 'text-slate-200'}`}>
                {match.away_team || 'TBD'}
              </span>
            </div>
          </div>
        </div>

        {isDraw && (
          <div className="mt-1.5 text-[10px] text-amber-400 text-center font-semibold">
            ⚠️ Draw - one team must win, adjust the scores
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar />

      <main className="max-w-3xl mx-auto px-3 sm:px-4">
        <div className="sticky top-16 z-40 bg-slate-950/95 backdrop-blur-sm pt-3 pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Swords className="h-5 w-5 text-cupGold-400 flex-shrink-0" />
              <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                {STEPS[currentStep]?.name || 'Knockout'}
              </h2>
            </div>

            {currentStep === 0 ? (
              <button onClick={onBackToGroups}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-1.5 border border-slate-700 rounded-lg transition-all flex-shrink-0"
              >← Groups</button>
            ) : (
              <button onClick={handleBackStep}
                className="flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-1.5 border border-slate-700 rounded-lg transition-all flex-shrink-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {STEPS[currentStep - 1]?.short || 'Back'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 mb-1">
            {STEPS.map((st, i) => (
              <div key={st.key}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  i < currentStep ? 'bg-cupEmerald-500'
                    : i === currentStep ? 'bg-cupGold-500'
                    : 'bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>{STEPS[currentStep]?.short || ''} - {filledCount}/{currentMatches.length} matches</span>
            <span className="text-cupGold-400 font-semibold">{currentStep + 1}/{STEPS.length}</span>
          </div>
        </div>

        {saveError && (
          <div className="mb-3 p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /><span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-3 p-3 rounded-xl bg-cupEmerald-950/20 border border-cupEmerald-900/40 text-cupEmerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" /><span>Predictions saved to database!</span>
          </div>
        )}

        <div className="space-y-2.5">
          {currentMatches.length === 0 && (
            <div className="text-center py-12 text-slate-500 text-sm">Loading matches...</div>
          )}
          {currentMatches.map((match) => {
            const id = match.id;
            // On finals step, add labels before each match
            if (currentStep === 4) {
              if (id === 103) {
                return (
                  <div key="finals-group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">🥉</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Third Place Match</span>
                    </div>
                    {renderMatchCard(match)}
                  </div>
                );
              }
              if (id === 104) {
                return (
                  <div key="finals-group-2">
                    <div className="flex items-center gap-2 mt-4 mb-2">
                      <span className="text-sm">🏆</span>
                      <span className="text-xs font-bold text-cupGold-400 uppercase tracking-wider">FINAL</span>
                    </div>
                    {renderMatchCard(match)}
                    {/* Champion display */}
                    {(() => {
                      const finInput = knockoutScores[104];
                      if (!finInput) return null;
                      const h = parseInt(finInput.home, 10);
                      const a = parseInt(finInput.away, 10);
                      if (isNaN(h) || isNaN(a) || h === a) return null;
                      const champName = h > a ? match.home_team : match.away_team;
                      const champFlag = h > a ? match.home_flag : match.away_flag;
                      return (
                        <div className="mt-4 p-4 bg-gradient-to-br from-cupGold-500/20 via-cupGold-600/10 to-slate-900 border-2 border-cupGold-500/50 rounded-2xl text-center">
                          <div className="text-5xl mb-3 animate-bounce">🏆</div>
                          <h3 className="text-xl font-extrabold text-cupGold-300 mb-1">
                            World Cup 2026 Champion
                          </h3>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            {champFlag && (
                              <img src={champFlag} alt="" className="w-8 h-6 object-cover rounded border border-cupGold-500/40" />
                            )}
                            <span className="text-2xl font-black text-white">{champName}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Predicted Champion</p>
                        </div>
                      );
                    })()}
                  </div>
                );
              }
            }
            return renderMatchCard(match);
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {!isLastStep && (
            <button onClick={handleSaveRound} disabled={!allFilled}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 font-bold rounded-xl transition-all text-sm ${
                allFilled
                  ? 'bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 shadow-lg shadow-cupGold-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="h-4 w-4" />
              <span>Save &amp; Continue - {STEPS[currentStep + 1]?.name || 'Next Round'}</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {isLastStep && (
            <button onClick={handleFinalizeSave} disabled={!allFilled || isSaving}
              className={`w-full flex items-center justify-center gap-2 px-5 py-3 font-bold rounded-xl transition-all text-sm ${
                allFilled && !isSaving
                  ? 'bg-gradient-to-r from-cupGold-500 to-cupGold-600 hover:from-cupGold-400 hover:to-cupGold-500 text-slate-950 shadow-lg shadow-cupGold-500/30'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Database className="h-4 w-4" />
              <span>{isSaving ? 'Saving...' : '\uD83C\uDFC6 Finalize &amp; Save Predictions'}</span>
            </button>
          )}

          {!allFilled && currentMatches.length > 0 && (
            <p className="text-center text-[11px] text-slate-500">
              Enter different scores for all matches to continue
            </p>
          )}
        </div>

        {currentMatches.length > 0 && (
          <div className="mt-4 glass-panel rounded-xl p-3 border border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>Round progress</span>
              <span className="font-semibold text-cupGold-400">{filledCount}/{currentMatches.length}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cupGold-500 to-cupEmerald-500 rounded-full transition-all duration-300"
                style={{ width: `${(filledCount / currentMatches.length) * 100}%` }} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default KnockoutStage;
