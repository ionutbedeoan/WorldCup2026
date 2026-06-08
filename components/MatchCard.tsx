import { useState, useEffect } from 'react';
import { Lock, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { calculatePoints } from '../lib/scoring';

interface Match {
  id: number;
  home_team: string;
  away_team: string;
  home_flag: string | null;
  away_flag: string | null;
  start_time: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
}

interface MatchCardProps {
  match: Match;
  initialPrediction: { home_score: number; away_score: number } | null;
  onSavePrediction: (matchId: number, homeScore: number, awayScore: number) => Promise<boolean>;
}

export default function MatchCard({ match, initialPrediction, onSavePrediction }: MatchCardProps) {
  const [homePred, setHomePred] = useState<string>(
    initialPrediction !== null ? String(initialPrediction.home_score) : ''
  );
  const [awayPred, setAwayPred] = useState<string>(
    initialPrediction !== null ? String(initialPrediction.away_score) : ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Keep state sync if initial prediction is loaded async
  useEffect(() => {
    if (initialPrediction !== null) {
      setHomePred(String(initialPrediction.home_score));
      setAwayPred(String(initialPrediction.away_score));
    }
  }, [initialPrediction]);

  const matchDate = new Date(match.start_time);
  const isLocked = matchDate <= new Date() || match.status === 'finished';

  const handleSave = async () => {
    if (isLocked) return;
    const hScore = parseInt(homePred, 10);
    const aScore = parseInt(awayPred, 10);

    if (isNaN(hScore) || isNaN(aScore) || hScore < 0 || aScore < 0) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
      return;
    }

    setIsSaving(true);
    const success = await onSavePrediction(match.id, hScore, aScore);
    setIsSaving(false);

    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } else {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 3000);
    }
  };

  // Score points calculation for display
  const finalPoints = match.status === 'finished' && initialPrediction
    ? calculatePoints(
        initialPrediction.home_score,
        initialPrediction.away_score,
        match.home_score,
        match.away_score
      )
    : null;

  return (
    <div className={`glass-panel rounded-2xl p-5 border transition-all duration-300 relative overflow-hidden ${
      isLocked ? 'border-slate-800 bg-slate-950/40' : 'border-slate-800 hover:border-cupGold-500/30 bg-slate-900/40'
    }`}>
      {/* Background status overlay */}
      {match.status === 'finished' && (
        <div className="absolute top-0 right-0 bg-cupEmerald-800/80 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-xl border-l border-b border-cupEmerald-600/40">
          Finished
        </div>
      )}
      {match.status === 'live' && (
        <div className="absolute top-0 right-0 bg-red-650 bg-red-650 bg-red-600/80 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-xl border-l border-b border-red-500/40 animate-pulse">
          Live
        </div>
      )}

      {/* Header Info */}
      <div className="text-center mb-3">
        <span className="text-[11px] font-semibold tracking-wider text-slate-400 bg-slate-900 px-2.5 py-1 rounded-full border border-slate-800">
          {matchDate.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>

      {/* Match Layout */}
      <div className="flex items-center justify-between gap-2 md:gap-4 my-4">
        {/* Home Team */}
        <div className="flex flex-col items-center flex-1 text-center min-w-0">
          <span className="text-3xl md:text-4xl mb-1.5 select-none" role="img" aria-label={match.home_team}>
            {match.home_flag || '⚽'}
          </span>
          <span className="font-bold text-sm md:text-base text-slate-200 truncate w-full">
            {match.home_team}
          </span>
          {match.status === 'finished' && match.home_score !== null && (
            <span className="text-xs text-slate-400 mt-0.5">
              Result: <span className="font-bold text-slate-200 text-sm">{match.home_score}</span>
            </span>
          )}
        </div>

        {/* Prediction Inputs */}
        <div className="flex items-center gap-1.5 justify-center">
          <input
            type="number"
            min="0"
            disabled={isLocked}
            value={homePred}
            onChange={(e) => setHomePred(e.target.value)}
            className={`w-14 h-14 text-center text-xl font-extrabold rounded-xl border focus:outline-none transition-all ${
              isLocked
                ? 'bg-slate-950/60 border-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 border-slate-700 text-white focus:border-cupGold-500 focus:ring-1 focus:ring-cupGold-500'
            }`}
            placeholder="-"
          />
          <span className="text-slate-500 font-bold px-1">:</span>
          <input
            type="number"
            min="0"
            disabled={isLocked}
            value={awayPred}
            onChange={(e) => setAwayPred(e.target.value)}
            className={`w-14 h-14 text-center text-xl font-extrabold rounded-xl border focus:outline-none transition-all ${
              isLocked
                ? 'bg-slate-950/60 border-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 border-slate-700 text-white focus:border-cupGold-500 focus:ring-1 focus:ring-cupGold-500'
            }`}
            placeholder="-"
          />
        </div>

        {/* Away Team */}
        <div className="flex flex-col items-center flex-1 text-center min-w-0">
          <span className="text-3xl md:text-4xl mb-1.5 select-none" role="img" aria-label={match.away_team}>
            {match.away_flag || '⚽'}
          </span>
          <span className="font-bold text-sm md:text-base text-slate-200 truncate w-full">
            {match.away_team}
          </span>
          {match.status === 'finished' && match.away_score !== null && (
            <span className="text-xs text-slate-400 mt-0.5">
              Result: <span className="font-bold text-slate-200 text-sm">{match.away_score}</span>
            </span>
          )}
        </div>
      </div>

      {/* Points & Locked / Action Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs min-h-[40px]">
        {/* Points Display */}
        <div>
          {finalPoints !== null ? (
            <span className={`px-2.5 py-1 rounded-md font-bold ${
              finalPoints === 3
                ? 'bg-cupGold-500/10 text-cupGold-400 border border-cupGold-500/20'
                : finalPoints === 1
                ? 'bg-cupEmerald-500/10 text-cupEmerald-400 border border-cupEmerald-500/20'
                : 'bg-slate-800 text-slate-400'
            }`}>
              {finalPoints === 3 ? 'Exact Score! (+3 pts)' : finalPoints === 1 ? 'Correct Outcome (+1 pt)' : 'No Points (0 pts)'}
            </span>
          ) : isLocked ? (
            <span className="flex items-center gap-1 text-slate-400 font-medium bg-slate-950/40 px-2 py-0.5 rounded border border-slate-850">
              <Lock className="h-3 w-3 text-slate-500" /> Locked
            </span>
          ) : (
            <span className="text-slate-500 italic">Prediction open</span>
          )}
        </div>

        {/* Save button / notifications */}
        {!isLocked && (
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="flex items-center gap-1 text-cupEmerald-400 font-semibold animate-fade-in">
                <CheckCircle className="h-4 w-4" /> Saved!
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1 text-red-400 font-semibold animate-pulse">
                <AlertCircle className="h-4 w-4" /> Invalid
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cupGold-500 hover:bg-cupGold-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-lg shadow-sm hover:shadow transition-all duration-200"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
