import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllUserPredictions, getAllUsers } from '../../lib/supabaseClient';
import { getAllGroupMatches, evaluatePredictions, getFlagUrl } from '../../lib/matchesData';
import { getGroups, GroupInfo, GroupMatch } from '../../lib/matchesData';
import Navbar from '../../components/Navbar';
import { Trophy, Users, Award, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

interface LeaderboardEntry {
  username: string;
  userId: string;
  totalPoints: number;
  exactScores: number;
  correctOutcomes: number;
  predictionsCount: number;
  predictions?: Record<string, { home_score: number; away_score: number }>;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showResultsForm, setShowResultsForm] = useState(false);
  const [resultInputs, setResultInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [groups] = useState<GroupInfo[]>(getGroups());
  const [allMatches] = useState<GroupMatch[]>(getAllGroupMatches());
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userPredictionMap, setUserPredictionMap] = useState<Record<string, Record<string, { home_score: number; away_score: number }>>>({});

  const checkUserSession = () => {
    const savedUser = localStorage.getItem('worldcup_username');
    const savedId = localStorage.getItem('worldcup_user_id');
    if (!savedUser || !savedId) {
      navigate('/');
      return null;
    }
    return { id: savedId, username: savedUser };
  };

  // Load results from localStorage (persisted across sessions)
  useEffect(() => {
    const storedResults = localStorage.getItem('worldcup_2026_results');
    if (storedResults) {
      try {
        const parsed = JSON.parse(storedResults);
        const inputs: Record<string, { home: string; away: string }> = {};
        Object.entries(parsed).forEach(([key, val]: any) => {
          inputs[key] = {
            home: String(val.home_score ?? ''),
            away: String(val.away_score ?? ''),
          };
        });
        setResultInputs(inputs);
      } catch {}
    }
  }, []);

  const fetchData = async () => {
    const session = checkUserSession();
    if (!session) return;

    setIsLoading(true);

    try {
      // 1. Build results map from inputs
      const resultsMap: Record<string, { home_score: number; away_score: number } | null> = {};
      allMatches.forEach((match) => {
        const key = `${match.home_team}_vs_${match.away_team}`;
        const input = resultInputs[key];
        if (input && input.home !== '' && input.away !== '') {
          const h = parseInt(input.home, 10);
          const a = parseInt(input.away, 10);
          if (!isNaN(h) && !isNaN(a)) {
            resultsMap[key] = { home_score: h, away_score: a };
          } else {
            resultsMap[key] = null;
          }
        } else {
          resultsMap[key] = null;
        }
      });

      // 2. Calculate user scores from predictions
      const users = await getAllUsers();
      const allPredictions = await getAllUserPredictions();

      // Create a map of userId -> predictions
      const predMap: Record<string, Record<string, { home_score: number; away_score: number }>> = {};
      allPredictions.forEach((p) => {
        // The predictions stored include group_predictions, knockout_winners, knockout_bracket.
        // For group scoring we extract just the group_predictions part
        const data = p.predictions as any;
        const groupPreds = data?.group_predictions || data || {};
        predMap[p.user_id] = groupPreds;
      });
      setUserPredictionMap(predMap);

      // For each user, evaluate their predictions against the results
      const entries: LeaderboardEntry[] = users.map((user) => {
        let allUserPreds: Record<string, { home_score: number; away_score: number }> = {};
        const userData = predMap[user.id];
        if (userData) {
          // Flatten group predictions into a single map for evaluation
          Object.values(userData as any).forEach((groupPreds: any) => {
            if (groupPreds && typeof groupPreds === 'object') {
              Object.entries(groupPreds as Record<string, { home_score: number; away_score: number }>).forEach(([key, val]) => {
                allUserPreds[key] = val;
              });
            }
          });
        }
        const evaluation = evaluatePredictions(allUserPreds, resultsMap);
        return {
          username: user.username,
          userId: user.id,
          totalPoints: evaluation.totalPoints,
          exactScores: evaluation.exactScores,
          correctOutcomes: evaluation.correctOutcomes,
          predictionsCount: Object.keys(allUserPreds).length,
        };
      });

      // Sort: totalPoints DESC, exactScores DESC, username ASC
      entries.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
        return a.username.localeCompare(b.username);
      });

      setLeaderboard(entries);
    } catch (err: any) {
      console.error('Error computing leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const session = checkUserSession();
    if (session) {
      fetchData();
    }
  }, [navigate, resultInputs]);

  const handleResultChange = (matchKey: string, side: 'home' | 'away', value: string) => {
    setResultInputs((prev) => ({
      ...prev,
      [matchKey]: { ...prev[matchKey], [side]: value },
    }));
  };

  const handleSaveResults = () => {
    // Save to localStorage
    const results: Record<string, { home_score: number | null; away_score: number | null }> = {};
    Object.entries(resultInputs).forEach(([key, val]) => {
      const h = parseInt(val.home, 10);
      const a = parseInt(val.away, 10);
      results[key] = {
        home_score: !isNaN(h) ? h : null,
        away_score: !isNaN(a) ? a : null,
      };
    });
    localStorage.setItem('worldcup_2026_results', JSON.stringify(results));
    fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Trophy className="h-7 w-7 text-cupGold-400" />
              <span>Leaderboard</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter real match results below to calculate scores from predictions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowResultsForm(!showResultsForm)}
              className="flex items-center gap-2 px-4 py-2 border border-slate-700 bg-slate-900/65 hover:bg-slate-800/80 text-slate-300 text-sm font-semibold rounded-xl transition-all"
            >
              {showResultsForm ? (
                <><EyeOff className="h-4 w-4" /> Hide Results</>
              ) : (
                <><Eye className="h-4 w-4" /> Set Results</>
              )}
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 border border-slate-800 bg-slate-900/65 hover:bg-slate-800/80 disabled:opacity-50 text-slate-350 text-sm font-semibold rounded-xl transition-all"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Results Input Form */}
        {showResultsForm && (
          <div className="glass-panel rounded-2xl border border-slate-700 overflow-hidden mb-8">
            <div className="p-4 bg-slate-900/80 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Enter Real Match Results</h3>
              <p className="text-xs text-slate-400 mt-1">Fill in the actual scores for each match.</p>
            </div>

              {groups.map((group) => {
              const groupMatches = allMatches.filter((m) => m.group === group.group);

              return (
                <div key={group.group} className="p-4 border-b border-slate-800/60">
                  <h4 className="text-sm font-bold text-cupGold-400 mb-3">{group.group}</h4>
                  <div className="space-y-2">
                    {groupMatches.map((match) => {
                      const key = `${match.home_team}_vs_${match.away_team}`;
                      const input = resultInputs[key];

                      return (
                        <div key={key} className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg">
                          <span className="text-xs text-slate-500 w-12">{match.date}</span>
                          <span className="flex-1 text-right text-sm text-slate-300">{match.home_team}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={input?.home ?? ''}
                            onChange={(e) => handleResultChange(key, 'home', e.target.value)}
                            className="w-12 h-9 text-center text-sm font-bold bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cupGold-500 focus:outline-none placeholder-slate-600"
                          />
                          <span className="text-slate-500 text-xs">:</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={input?.away ?? ''}
                            onChange={(e) => handleResultChange(key, 'away', e.target.value)}
                            className="w-12 h-9 text-center text-sm font-bold bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cupGold-500 focus:outline-none placeholder-slate-600"
                          />
                          <span className="flex-1 text-sm text-slate-300">{match.away_team}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="p-4 bg-slate-900/80 flex justify-end">
              <button
                onClick={handleSaveResults}
                className="px-6 py-2.5 bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 font-bold rounded-xl transition-all"
              >
                Save Results & Recalculate
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 border border-slate-800 animate-pulse h-16" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
              {leaderboard.length === 0 ? (
                <div className="glass-panel rounded-3xl p-10 border border-slate-800 text-center">
                  <Users className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-slate-200">No Predictions Yet</h3>
                  <p className="text-sm text-slate-400 mt-1">Users need to save predictions first.</p>
                </div>
              ) : (
                leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isFirst = rank === 1;
                  const isActiveUser = entry.userId === localStorage.getItem('worldcup_user_id');
                  const isExpanded = expandedUser === entry.userId;

                  let rankBadge = (
                    <span className="text-slate-400 font-bold text-sm min-w-[24px] text-center">#{rank}</span>
                  );
                  if (rank === 1) rankBadge = <span className="text-2xl min-w-[24px] text-center">🥇</span>;
                  if (rank === 2) rankBadge = <span className="text-2xl min-w-[24px] text-center">🥈</span>;
                  if (rank === 3) rankBadge = <span className="text-2xl min-w-[24px] text-center">🥉</span>;

                  const userPreds = userPredictionMap[entry.userId] as Record<string, any> | undefined;

                  return (
                    <div key={entry.userId}>
                      {/* Card (clickable) */}
                      <button
                        onClick={() => setExpandedUser(isExpanded ? null : entry.userId)}
                        className={`w-full text-left relative overflow-hidden rounded-2xl p-4 border flex items-center justify-between transition-all ${
                          isExpanded
                            ? 'rounded-b-none border-b-0 bg-slate-900/90 border-cupGold-500/40'
                            : isFirst
                            ? 'bg-gradient-to-r from-cupGold-950/60 via-slate-900/90 to-slate-900/90 border-cupGold-500/40 shadow-lg shadow-cupGold-900/10'
                            : isActiveUser
                            ? 'bg-slate-900/80 border-slate-700'
                            : 'bg-slate-900/40 border-slate-850 hover:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          {rankBadge}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-base ${isFirst ? 'text-cupGold-300' : 'text-slate-200'}`}>
                                {entry.username}
                              </span>
                              {isActiveUser && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-cupGold-300 border border-slate-700">
                                  You
                                </span>
                              )}
                              {isFirst && <Award className="h-4 w-4 text-cupGold-400 animate-pulse" />}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                              <span>Preds: <span className="font-semibold text-slate-400">{entry.predictionsCount}</span></span>
                              <span>&bull;</span>
                              <span>Exact: <span className="font-semibold text-slate-400">{entry.exactScores}</span></span>
                              <span>&bull;</span>
                              <span>Correct: <span className="font-semibold text-slate-400">{entry.correctOutcomes}</span></span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className={`text-2xl font-black ${isFirst ? 'gold-gradient-text' : 'text-white'}`}>
                              {entry.totalPoints}
                            </span>
                            <span className="text-[10px] block font-bold uppercase tracking-wide text-slate-500 mt-0.5">
                              {entry.totalPoints === 1 ? 'Point' : 'Points'}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                          )}
                        </div>
                      </button>

                      {/* Expanded predictions */}
                      {isExpanded && userPreds && (
                        <div className="bg-slate-900/70 border border-cupGold-500/30 border-t-0 rounded-b-2xl p-4 overflow-hidden">
                          {Object.keys(userPreds).length === 0 ? (
                            <p className="text-xs text-slate-500 text-center py-2">No group predictions found.</p>
                          ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                              {Object.entries(userPreds).flatMap(([groupName, matches]) => {
                                if (!matches || typeof matches !== 'object') return [];
                                const matchEntries = Object.entries(matches as Record<string, { home_score: number; away_score: number }>);
                                if (matchEntries.length === 0) return [];
                                return [
                                  <div key={groupName} className="mb-2">
                                    <div className="text-[10px] font-bold text-cupGold-400 uppercase tracking-wider mb-1.5">
                                      {groupName}
                                    </div>
                                    <div className="space-y-1">
                                      {matchEntries.map(([matchKey, score]) => {
                                        const teams = matchKey.split('_vs_');
                                        const home = teams[0];
                                        const away = teams[1] || '?';
                                        return (
                                          <div
                                            key={matchKey}
                                            className="flex items-center justify-between bg-slate-800/40 px-2.5 py-1.5 rounded-lg"
                                          >
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                              {getFlagUrl(home) && (
                                                <img src={getFlagUrl(home)} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                                              )}
                                              <span className="text-xs font-medium text-slate-300 truncate">{home}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mx-2">
                                              <span className="w-5 text-center text-sm font-extrabold text-white">{score.home_score}</span>
                                              <span className="text-slate-600 text-[10px]">:</span>
                                              <span className="w-5 text-center text-sm font-extrabold text-white">{score.away_score}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                              <span className="text-xs font-medium text-slate-300 truncate">{away}</span>
                                              {getFlagUrl(away) && (
                                                <img src={getFlagUrl(away)} alt="" className="w-4 h-3 object-cover rounded-sm flex-shrink-0" />
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ];
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
        )}
      </main>
    </div>
  );
}