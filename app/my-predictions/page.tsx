import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserPredictions, deleteUserPredictions } from '../../lib/supabaseClient';
import { getGroups, getFlagUrl, GroupInfo } from '../../lib/matchesData';
import Navbar from '../../components/Navbar';
import {
  Trophy,
  AlertCircle,
  CheckCircle,
  Trash2,
  Eye,
  Swords,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type UserPredictions = Record<string, { home_score: number; away_score: number }>;

interface KnockoutBracketMatch {
  id: number;
  round: string;
  home_team: string | null;
  away_team: string | null;
  winner: 'home' | 'away' | null;
}

interface SavedData {
  group_predictions: Record<string, UserPredictions>;
  knockout_winners: Record<number, 'home' | 'away'>;
  knockout_bracket: KnockoutBracketMatch[][];
}

export default function MyPredictions() {
  const navigate = useNavigate();
  const [groups] = useState<GroupInfo[]>(getGroups());
  const [predictions, setPredictions] = useState<SavedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedKnockout, setExpandedKnockout] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const checkUserSession = () => {
    const savedUser = localStorage.getItem('worldcup_username');
    const savedId = localStorage.getItem('worldcup_user_id');
    if (!savedUser || !savedId) {
      navigate('/');
      return null;
    }
    return { id: savedId, username: savedUser };
  };

  useEffect(() => {
    const session = checkUserSession();
    if (!session) return;

    loadPredictions(session.id);
  }, [navigate]);

  const loadPredictions = async (userId: string) => {
    setIsLoading(true);
    try {
      const data = await getUserPredictions(userId);
      if (data) {
        setPredictions(data as unknown as SavedData);
      } else {
        setPredictions(null);
      }
    } catch (err: any) {
      console.error('Error loading predictions:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load predictions.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    const session = checkUserSession();
    if (!session) return;

    setIsDeleting(true);
    setMessage(null);
    try {
      await deleteUserPredictions(session.id);
      setPredictions(null);
      setDeleteConfirm(false);
      setMessage({ type: 'success', text: 'Predictions deleted successfully!' });
      // Clear localStorage knockout data too
      const user = localStorage.getItem('worldcup_username');
      const prefix = user ? `wck_${user}` : 'wck';
      localStorage.removeItem(`${prefix}_step`);
      localStorage.removeItem(`${prefix}_scores`);
      localStorage.removeItem('worldcup_in_knockout');
      localStorage.removeItem('worldcup_predictions_finalized');
      localStorage.removeItem('worldcup_local_predictions');
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error('Error deleting predictions:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to delete predictions.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const getRoundEmoji = (round: string): string => {
    switch (round) {
      case 'round_of_32': return '🔵';
      case 'round_of_16': return '🟢';
      case 'quarter_final': return '🟡';
      case 'semi_final': return '🟠';
      case 'third_place': return '🥉';
      case 'final': return '🏆';
      default: return '⚽';
    }
  };

  const getRoundName = (round: string): string => {
    switch (round) {
      case 'round_of_32': return 'Round of 32';
      case 'round_of_16': return 'Round of 16';
      case 'quarter_final': return 'Quarter-Finals';
      case 'semi_final': return 'Semi-Finals';
      case 'third_place': return 'Third Place Match';
      case 'final': return 'FINAL';
      default: return round;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Eye className="h-7 w-7 text-cupGold-400" />
              <span>My Predictions</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              View and manage your saved predictions.
            </p>
          </div>

          {predictions && (
            <div className="flex items-center gap-3">
              {deleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-400 font-semibold">Delete all predictions?</span>
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded-lg transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-red-900/30 bg-red-950/20 hover:bg-red-950/50 text-red-400 text-xs font-bold rounded-lg transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete All</span>
                </button>
              )}
            </div>
          )}
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-cupEmerald-950/20 border border-cupEmerald-900/40 text-cupEmerald-300'
                : 'bg-red-950/20 border border-red-900/40 text-red-300'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 border border-slate-800 animate-pulse h-20" />
            ))}
          </div>
        ) : !predictions ? (
          <div className="glass-panel rounded-3xl p-12 border border-slate-800 text-center">
            <Eye className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-300">No Predictions Yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              You haven't saved any predictions yet. Go to the Predict page to make your predictions for the World Cup 2026!
            </p>
            <button
              onClick={() => navigate('/game')}
              className="mt-4 px-5 py-2 bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 font-bold rounded-xl transition-all"
            >
              Go to Predict
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Group Predictions */}
            {predictions.group_predictions && (
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                <div className="p-4 bg-slate-900/80 border-b border-slate-800">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-cupGold-400" />
                    <span>Group Stage Predictions</span>
                    <span className="text-xs font-normal text-slate-400 ml-auto">
                      {Object.keys(predictions.group_predictions).length}/{groups.length} groups
                    </span>
                  </h3>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {Object.entries(predictions.group_predictions).map(([groupName, matches]) => {
                    const isExpanded = expandedGroup === groupName;
                    const matchCount = Object.keys(matches).length;

                    return (
                      <div key={groupName}>
                        <button
                          onClick={() => setExpandedGroup(isExpanded ? null : groupName)}
                          className="w-full flex items-center justify-between p-3 hover:bg-slate-800/40 transition-all text-left"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-cupGold-300">{groupName}</span>
                            <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">
                              {matchCount} matches
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-1.5">
                            {Object.entries(matches).map(([matchKey, score]) => {
                              const teams = matchKey.split('_vs_');
                              const home = teams[0];
                              const away = teams[1] || '?';
                              const homeFlag = getFlagUrl(home);
                              const awayFlag = getFlagUrl(away);

                              return (
                                <div
                                  key={matchKey}
                                  className="flex items-center justify-between bg-slate-800/40 p-2 rounded-lg"
                                >
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    {homeFlag && (
                                      <img src={homeFlag} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                                    )}
                                    <span className="text-xs font-semibold text-slate-300 truncate">{home}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mx-3">
                                    <span className="w-6 text-center text-sm font-extrabold text-white">{score.home_score}</span>
                                    <span className="text-slate-600 text-xs">:</span>
                                    <span className="w-6 text-center text-sm font-extrabold text-white">{score.away_score}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                    <span className="text-xs font-semibold text-slate-300 truncate">{away}</span>
                                    {awayFlag && (
                                      <img src={awayFlag} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Knockout Predictions */}
            {predictions.knockout_bracket && predictions.knockout_bracket.length > 0 && (
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                <button
                  onClick={() => setExpandedKnockout(!expandedKnockout)}
                  className="w-full p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between hover:bg-slate-900/60 transition-all"
                >
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Swords className="h-4 w-4 text-cupGold-400" />
                    <span>Knockout Stage Predictions</span>
                  </h3>
                  {expandedKnockout ? (
                    <ChevronUp className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {expandedKnockout && (
                  <div className="p-3 space-y-3">
                    {predictions.knockout_bracket.map((round, ri) => {
                      if (round.length === 0) return null;
                      return (
                        <div key={ri}>
                          <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <span>{getRoundEmoji(round[0].round)}</span>
                            <span>{getRoundName(round[0].round)}</span>
                          </h4>
                          <div className="space-y-1.5">
                            {round.map((match) => {
                              const winnerSide = predictions.knockout_winners?.[match.id];

                              return (
                                <div
                                  key={match.id}
                                  className="flex items-center justify-between bg-slate-800/30 p-2 rounded-lg"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      {match.home_team && (
                                        <img
                                          src={getFlagUrl(match.home_team)}
                                          alt=""
                                          className="w-4 h-3 object-cover rounded-sm flex-shrink-0"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      )}
                                      <span className={`text-xs font-semibold truncate ${
                                        winnerSide === 'home' ? 'text-cupGold-300' : 'text-slate-400'
                                      }`}>
                                        {match.home_team || 'TBD'}
                                      </span>
                                      {winnerSide === 'home' && (
                                        <span className="text-[10px] text-cupGold-400 font-bold">✔</span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-slate-600 mx-2">vs</span>
                                  <div className="flex-1 min-w-0 text-right">
                                    <div className="flex items-center gap-1.5 justify-end">
                                      {winnerSide === 'away' && (
                                        <span className="text-[10px] text-cupGold-400 font-bold">✔</span>
                                      )}
                                      <span className={`text-xs font-semibold truncate ${
                                        winnerSide === 'away' ? 'text-cupGold-300' : 'text-slate-400'
                                      }`}>
                                        {match.away_team || 'TBD'}
                                      </span>
                                      {match.away_team && (
                                        <img
                                          src={getFlagUrl(match.away_team)}
                                          alt=""
                                          className="w-4 h-3 object-cover rounded-sm flex-shrink-0"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}

                    {/* Champion */}
                    {predictions.knockout_winners?.[104] && (
                      <div className="mt-3 p-3 bg-gradient-to-r from-cupGold-500/10 via-slate-800/50 to-slate-800/50 border border-cupGold-500/30 rounded-xl text-center">
                        <span className="text-lg">🏆</span>
                        <span className="text-sm font-extrabold text-cupGold-300 ml-2">
                          Predicted Champion
                        </span>
                        {(() => {
                          const finalMatch = predictions.knockout_bracket
                            ?.flat()
                            .find((m) => m.id === 104);
                          if (!finalMatch) return null;
                          const champName = predictions.knockout_winners[104] === 'home'
                            ? finalMatch.home_team
                            : finalMatch.away_team;
                          return (
                            <div className="text-base font-bold text-white mt-1">
                              {champName || 'TBD'}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Info message */}
            <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 text-xs text-slate-400 text-center">
              <p>You can delete all your predictions if you're not satisfied. After deleting, you can make new predictions from the Predict page.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
