import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserPredictions } from '../../lib/supabaseClient';
import { getGroups, getMatchesByGroup, calculateGroupStandings, getFlagUrl, GroupInfo } from '../../lib/matchesData';
import { getBestThirdPlaced } from '../../lib/knockout';
import Navbar from '../../components/Navbar';
import KnockoutStage from './knockout';
import { Save, CheckCircle, AlertCircle, Edit3, ArrowRight, ArrowLeft, Trophy, Swords, Medal, Eye } from 'lucide-react';

export default function Game() {
  const navigate = useNavigate();
  const [groups] = useState<GroupInfo[]>(getGroups());
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [allPredictions, setAllPredictions] = useState<Record<string, Record<string, { home_score: number; away_score: number }>>>({});
  const [groupInputs, setGroupInputs] = useState<Record<string, { home: string; away: string }>>({});
  const [touchedKeys, setTouchedKeys] = useState<Set<string>>(new Set());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showKnockout, setShowKnockout] = useState(false);
  const [savedGroupCount, setSavedGroupCount] = useState(0);
  const [bestThirdTeams, setBestThirdTeams] = useState<{group: string; team: string; flag_url: string; points: number; gd: number; gf: number}[]>([]);

  const checkUserSession = () => {
    const savedUser = localStorage.getItem('worldcup_username');
    const savedId = localStorage.getItem('worldcup_user_id');
    if (!savedUser || !savedId) {
      navigate('/');
      return null;
    }
    return { id: savedId, username: savedUser };
  };

  const [hasExistingPredictions, setHasExistingPredictions] = useState(false);

  useEffect(() => {
    const session = checkUserSession();
    if (!session) return;

    const init = async () => {
      try {
        // Check if user already has predictions saved in DB
        const existing = await getUserPredictions(session.id);
        if (existing && Object.keys(existing).length > 0) {
          setHasExistingPredictions(true);
          setIsLoading(false);
          return;
        }

        const stored = localStorage.getItem('worldcup_local_predictions');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.predictions) setAllPredictions(parsed.predictions);
          if (typeof parsed.currentGroupIndex === 'number') setCurrentGroupIndex(parsed.currentGroupIndex);
        }
        // Check if already in knockout mode
        if (localStorage.getItem('worldcup_in_knockout') === 'true') {
          setShowKnockout(true);
        }
      } catch (err) {
        console.error('Error loading predictions:', err);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [navigate]);

  const saveToLocalStorage = (predictions: Record<string, Record<string, { home_score: number; away_score: number }>>, groupIdx: number) => {
    localStorage.setItem('worldcup_local_predictions', JSON.stringify({ predictions, currentGroupIndex: groupIdx }));
  };

  const currentGroup = groups[currentGroupIndex];
  const currentMatches = currentGroup ? getMatchesByGroup(currentGroup.group) : [];
  const isCurrentGroupSaved = currentGroup ? !!allPredictions[currentGroup.group] : false;
  const allGroupsDone = currentGroupIndex >= groups.length;

  // Calculate best third-place teams when all groups are completed
  useEffect(() => {
    if (allGroupsDone && savedGroupCount === groups.length) {
      // Get the basic third‑place data (group, points, gd, gf)
      const thirdData = getBestThirdPlaced(allPredictions);
      // Enrich it with the actual team name that finished third in each group
      const enriched = thirdData.map((t) => {
        // Build results map for the group
        const resultsMap: Record<string, { home_score: number; away_score: number } | null> = {};
        const groupPreds = allPredictions[`Group ${t.group}`];
        if (groupPreds) {
          Object.entries(groupPreds).forEach(([key, val]) => { resultsMap[key] = val; });
        }
        // Calculate full standings for the group
        const standings = calculateGroupStandings(`Group ${t.group}`, resultsMap);
        const thirdTeam = standings[2]?.team ?? '';
        const thirdTeamFlag = standings[2]?.flag_url ?? '';
        return { ...t, team: thirdTeam, flag_url: thirdTeamFlag };
      });
      setBestThirdTeams(enriched);
    }
  }, [allGroupsDone, savedGroupCount, groups.length, allPredictions]);

  // Update saved count whenever predictions change
  useEffect(() => {
    setSavedGroupCount(Object.keys(allPredictions).length);
  }, [allPredictions]);

  useEffect(() => {
    if (currentGroup) {
      if (allPredictions[currentGroup.group]) {
        const saved = allPredictions[currentGroup.group];
        const inputs: Record<string, { home: string; away: string }> = {};
        const keys: Set<string> = new Set();
        Object.entries(saved).forEach(([key, val]) => {
          inputs[key] = { home: String(val.home_score), away: String(val.away_score) };
          keys.add(key);
        });
        setGroupInputs(inputs);
        setTouchedKeys(keys);
      } else {
        const inputs: Record<string, { home: string; away: string }> = {};
        currentMatches.forEach((match) => {
          const key = `${match.home_team}_vs_${match.away_team}`;
          inputs[key] = { home: '0', away: '0' };
        });
        setGroupInputs(inputs);
        setTouchedKeys(new Set());
      }
    }
  }, [currentGroupIndex, allPredictions]);

  const handleScoreChange = (matchKey: string, side: 'home' | 'away', value: string) => {
    setGroupInputs((prev) => ({ ...prev, [matchKey]: { ...prev[matchKey], [side]: value } }));
    setTouchedKeys((prev) => new Set(prev).add(matchKey));
  };

  const handleSaveGroup = () => {
    if (!currentGroup) return;
    const predictions: Record<string, { home_score: number; away_score: number }> = {};
    for (const match of currentMatches) {
      const key = `${match.home_team}_vs_${match.away_team}`;
      const input = groupInputs[key];
      const h = parseInt(input?.home ?? '0', 10);
      const a = parseInt(input?.away ?? '0', 10);
      if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
        setSaveError(`Invalid scores for ${match.home_team} vs ${match.away_team}`);
        return;
      }
      predictions[key] = { home_score: h, away_score: a };
    }
    const updated = { ...allPredictions, [currentGroup.group]: predictions };
    setAllPredictions(updated);
    saveToLocalStorage(updated, currentGroupIndex);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
    setSaveError('');
  };

  const handleNextGroup = () => {
    const resultsMap: Record<string, { home_score: number; away_score: number } | null> = {};
    const groupPreds = allPredictions[currentGroup.group];
    if (groupPreds) Object.entries(groupPreds).forEach(([key, val]) => { resultsMap[key] = val; });
    const standings = calculateGroupStandings(currentGroup.group, resultsMap);
    localStorage.setItem(`worldcup_group_standings_${currentGroup.group}`, JSON.stringify(standings));
    setCurrentGroupIndex((prev) => prev + 1);
    setSaveError('');
  };

  const handleEditGroup = (groupName: string) => {
    const idx = groups.findIndex((g) => g.group === groupName);
    if (idx >= 0) setCurrentGroupIndex(idx);
  };

  const goToGroup = (idx: number) => { setCurrentGroupIndex(idx); setSaveError(''); };

  const handleProceedToKnockout = () => {
    localStorage.setItem('worldcup_in_knockout', 'true');
    setShowKnockout(true);
  };

  const handleBackToGroups = () => {
    localStorage.setItem('worldcup_in_knockout', 'false');
    setShowKnockout(false);
  };

  // If we're in knockout mode, show the knockout stage
  if (showKnockout) {
    return (
      <KnockoutStage
        allPredictions={allPredictions}
        onBackToGroups={handleBackToGroups}
      />
    );
  }

  // All groups done screen - now with "Proceed to Knockout" button instead of Finalize
  if (allGroupsDone) {
    return (
      <div className="min-h-screen bg-slate-950 pb-16">
        <Navbar />
        <main className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                <Trophy className="h-7 w-7 text-cupGold-400" />
                <span>All Groups Completed!</span>
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                You've predicted {savedGroupCount} out of {groups.length} groups. Proceed to the knockout stage.
              </p>
            </div>
            <button onClick={handleProceedToKnockout}
              className="flex items-center gap-2 px-5 py-2.5 bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cupGold-500/10"
            >
              <Swords className="h-4 w-4" />
              <span>Proceed to Knockout Stage →</span>
            </button>
          </div>

          {/* Best Third Place Teams Section */}
          {bestThirdTeams.length > 0 && (
            <div className="mb-8 glass-panel rounded-2xl border border-cupGold-500/30 bg-slate-900/60 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-cupGold-500/20 to-cupGold-600/20 border-b border-cupGold-500/30">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Medal className="h-5 w-5 text-cupGold-400" />
                  <span>Best 3rd Place Teams</span>
                  <span className="text-sm font-normal text-cupGold-300 ml-auto">Advancing to Round of 32</span>
                </h3>
                <p className="text-sm text-slate-300 mt-1">Based on your predictions, these are the top 8 third-place teams</p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {bestThirdTeams.map((team, index) => (
                    <div key={team.group} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 hover:border-cupGold-500/30 transition-all">
                      <div className="flex items-center justify-center w-8 h-8 bg-cupGold-500/20 border border-cupGold-500/30 rounded-full flex-shrink-0">
                        <span className="text-sm font-bold text-cupGold-400">{index + 1}</span>
                      </div>
                      {team.flag_url && (
                        <img src={team.flag_url} alt={team.team} className="w-7 h-5 object-cover rounded-sm flex-shrink-0 border border-slate-600" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white truncate">{team.team || 'TBD'}</div>
                        <div className="text-xs text-slate-400">Group {team.group}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-cupGold-400">{team.points} pts</div>
                        <div className="text-xs text-slate-500">GD: {team.gd > 0 ? '+' : ''}{team.gd}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group) => {
              const isSaved = !!allPredictions[group.group];
              const grm: Record<string, { home_score: number; away_score: number } | null> = {};
              if (isSaved) Object.entries(allPredictions[group.group]).forEach(([k, v]) => { grm[k] = v; });
              const st = isSaved ? calculateGroupStandings(group.group, grm) : [];
              const t2 = st.slice(0, 2);
              return (
                <div key={group.group} className={`glass-panel rounded-2xl p-4 border transition-all ${isSaved ? 'border-cupGold-500/30 bg-slate-900/60' : 'border-slate-800 bg-slate-900/30 opacity-60'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-bold text-white">{group.group}</h3>
                    {isSaved ? <span className="text-[10px] font-bold text-cupEmerald-400 bg-cupEmerald-950/30 px-2 py-0.5 rounded-full border border-cupEmerald-500/30">✓ Saved</span> : <span className="text-[10px] text-slate-500">Not set</span>}
                  </div>
                  {isSaved && t2.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <div className="text-[10px] text-slate-500 font-semibold">Predicted Standings:</div>
                      {t2.map((s, i) => (
                        <div key={s.team} className="text-xs text-slate-300 flex items-center gap-1">
                          <span className="text-cupGold-400">{i === 0 ? '🥇' : '🥈'}</span>
                          <span className="font-semibold">{s.team}</span><span className="text-slate-500 ml-auto">{s.points}pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => handleEditGroup(group.group)} disabled={!isSaved}
                    className={`w-full text-xs font-bold py-2 rounded-lg transition-all ${isSaved ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-slate-900/50 text-slate-600 cursor-not-allowed'}`}
                  >{isSaved ? 'Edit Predictions' : 'Complete earlier groups first'}</button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 glass-panel rounded-2xl p-4 border border-slate-800">
            <div className="flex items-center justify-between text-sm text-slate-400 mb-2">
              <span>Progress: {savedGroupCount}/{groups.length} groups</span>
              <span className="font-semibold text-cupGold-400">{Math.round((savedGroupCount / groups.length) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-cupGold-500 to-cupGold-400 rounded-full transition-all duration-500" style={{ width: `${(savedGroupCount / groups.length) * 100}%` }} />
            </div>
          </div>

          {/* Proceed to knockout button at bottom too */}
          {savedGroupCount === groups.length && (
            <div className="mt-6 text-center">
              <button onClick={handleProceedToKnockout}
                className="px-8 py-3 bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cupGold-500/20 text-lg"
              >
                <Swords className="h-5 w-5 inline mr-2" />
                Proceed to Knockout Stage
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  if (hasExistingPredictions) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="glass-panel rounded-3xl p-12 border border-slate-800 text-center">
            <Eye className="h-12 w-12 text-cupGold-400 mx-auto mb-4" />
            <h2 className="text-2xl font-extrabold text-white mb-2">Predictions Already Saved</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto mb-6">
              You have already saved predictions for World Cup 2026. If you want to make new predictions,
              please delete your existing ones from <strong>My Predictions</strong> first.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => navigate('/my-predictions')}
                className="px-6 py-2.5 bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 font-bold rounded-xl transition-all"
              >
                Go to My Predictions
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="glass-panel rounded-2xl p-6 border border-slate-800 h-32" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!currentGroup) return null;

  const liveStandings = (() => {
    const resultsMap: Record<string, { home_score: number; away_score: number } | null> = {};
    currentMatches.forEach((match) => {
      const key = `${match.home_team}_vs_${match.away_team}`;
      if (touchedKeys.has(key)) {
        const input = groupInputs[key];
        if (input && input.home !== '' && input.away !== '') {
          const h = parseInt(input.home, 10);
          const a = parseInt(input.away, 10);
          if (!isNaN(h) && !isNaN(a)) resultsMap[key] = { home_score: h, away_score: a };
        }
      }
    });
    return calculateGroupStandings(currentGroup.group, resultsMap);
  })();
  const filledCount = currentMatches.length;

  const handlePrevGroup = () => {
    if (currentGroupIndex > 0) { setCurrentGroupIndex((prev) => prev - 1); setSaveError(''); }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Edit3 className="h-6 w-6 text-cupGold-400" />
              <span>Predict: {currentGroup.group}</span>
            </h2>
            <span className="text-sm text-slate-400">Group {currentGroupIndex + 1} of {groups.length}</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cupGold-500 to-cupGold-400 rounded-full transition-all duration-300" style={{ width: `${(currentGroupIndex / groups.length) * 100}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">{currentGroup.teams.map((t: any) => t.name || t).join(' • ')}</span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs text-slate-500">{filledCount} matches</span>
            </div>

            {currentMatches.map((match) => {
              const key = `${match.home_team}_vs_${match.away_team}`;
              const input = groupInputs[key];
              return (
                <div key={key} className="glass-panel rounded-2xl p-3 sm:p-4 border border-slate-800 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-1.5 sm:gap-3">
                    <div className="flex-1 text-right min-w-0">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm sm:text-base font-semibold text-slate-200 truncate">{match.home_team}</span>
                        {getFlagUrl(match.home_team) && (
                          <img src={getFlagUrl(match.home_team)} alt={match.home_team} className="w-5 h-4 sm:w-6 sm:h-4 object-cover rounded-sm flex-shrink-0" />
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-0.5">
                      <button type="button" onClick={() => { const c = parseInt(input?.home ?? '0', 10); if (c < 10) handleScoreChange(key, 'home', String(c + 1)); }}
                        className="w-7 h-5 sm:w-8 sm:h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                        disabled={parseInt(input?.home ?? '0') >= 10}>+</button>
                      <input type="number" min="0" max="10" placeholder="0" value={input?.home ?? '0'}
                        onChange={(e) => { const n = parseInt(e.target.value, 10); if (e.target.value === '' || (!isNaN(n) && n >= 0 && n <= 999)) handleScoreChange(key, 'home', e.target.value); }}
                        className="w-9 h-9 sm:w-12 sm:h-10 text-center text-sm sm:text-base font-extrabold bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cupGold-500 focus:outline-none transition-all placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <button type="button" onClick={() => { const c = parseInt(input?.home ?? '0', 10); if (c > 0) handleScoreChange(key, 'home', String(c - 1)); }}
                        className="w-7 h-5 sm:w-8 sm:h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                        disabled={parseInt(input?.home ?? '0') <= 0}>−</button>
                    </div>

                    <span className="text-slate-500 font-bold text-sm sm:text-base self-center">:</span>

                    <div className="flex flex-col items-center gap-0.5">
                      <button type="button" onClick={() => { const c = parseInt(input?.away ?? '0', 10); if (c < 10) handleScoreChange(key, 'away', String(c + 1)); }}
                        className="w-7 h-5 sm:w-8 sm:h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                        disabled={parseInt(input?.away ?? '0') >= 10}>+</button>
                      <input type="number" min="0" max="10" placeholder="0" value={input?.away ?? '0'}
                        onChange={(e) => { const n = parseInt(e.target.value, 10); if (e.target.value === '' || (!isNaN(n) && n >= 0 && n <= 999)) handleScoreChange(key, 'away', e.target.value); }}
                        className="w-9 h-9 sm:w-12 sm:h-10 text-center text-sm sm:text-base font-extrabold bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cupGold-500 focus:outline-none transition-all placeholder-slate-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                      <button type="button" onClick={() => { const c = parseInt(input?.away ?? '0', 10); if (c > 0) handleScoreChange(key, 'away', String(c - 1)); }}
                        className="w-7 h-5 sm:w-8 sm:h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white font-bold rounded text-xs transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-slate-700"
                        disabled={parseInt(input?.away ?? '0') <= 0}>−</button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {getFlagUrl(match.away_team) && (
                          <img src={getFlagUrl(match.away_team)} alt={match.away_team} className="w-5 h-4 sm:w-6 sm:h-4 object-cover rounded-sm flex-shrink-0" />
                        )}
                        <span className="text-sm sm:text-base font-semibold text-slate-200 truncate">{match.away_team}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800/60">
              <button onClick={handlePrevGroup} disabled={currentGroupIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-400 hover:text-slate-200 disabled:text-slate-700 disabled:cursor-not-allowed transition-all"
              ><ArrowLeft className="h-4 w-4" /> Previous</button>
              <div className="flex items-center gap-3">
                {saveSuccess && <span className="flex items-center gap-1.5 text-cupEmerald-400 font-semibold text-sm"><CheckCircle className="h-4 w-4" /> Saved!</span>}
                <button onClick={handleSaveGroup}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-700"
                ><Save className="h-4 w-4" /><span>{isCurrentGroupSaved ? 'Update' : 'Save Group'}</span></button>
                <button onClick={handleNextGroup} disabled={!isCurrentGroupSaved}
                  className="flex items-center gap-2 px-5 py-2 bg-cupGold-500 hover:bg-cupGold-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold rounded-xl transition-all shadow-lg shadow-cupGold-500/10"
                ><span>{currentGroupIndex + 1 < groups.length ? `Next: ${groups[currentGroupIndex + 1].group}` : 'Finish Groups'}</span><ArrowRight className="h-4 w-4" /></button>
              </div>
            </div>
            {saveError && (
              <div className="mt-2 p-3 rounded-xl bg-red-950/20 border border-red-900/40 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /><span>{saveError}</span>
              </div>
            )}
          </div>

          <div className="lg:col-span-1">
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden sticky top-24">
              <div className="p-3 bg-slate-900/80 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-2"><Trophy className="h-4 w-4 text-cupGold-400" /> Live Standings</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Based on your predictions</p>
              </div>
              <div className="p-3">
                {liveStandings.length === 0 ? null : (
                  <div className="space-y-1">
                    <div className="flex items-center text-[10px] text-slate-500 font-semibold px-2 py-1">
                      <span className="w-5">#</span><span className="flex-1">Team</span><span className="w-5 text-center">P</span>
                      <span className="w-5 text-center">GF</span><span className="w-5 text-center">GA</span><span className="w-5 text-center">GD</span><span className="w-6 text-center font-bold">Pts</span>
                    </div>
                    {liveStandings.map((standing, idx) => {
                      const isTop2 = idx < 2;
                      return (
                        <div key={standing.team} className={`flex items-center text-xs px-2 py-1.5 rounded-lg ${isTop2 ? 'bg-cupGold-500/10 text-slate-200' : 'text-slate-400'}`}>
                          <span className="w-5 font-bold">{idx + 1}</span>
                          <span className="flex-1 truncate font-semibold">{standing.team}</span>
                          <span className="w-5 text-center">{standing.played}</span>
                          <span className="w-5 text-center">{standing.goals_for}</span>
                          <span className="w-5 text-center">{standing.goals_against}</span>
                          <span className="w-5 text-center font-bold">{standing.goal_diff > 0 ? '+' : ''}{standing.goal_diff}</span>
                          <span className="w-6 text-center font-bold text-cupGold-400">{standing.points}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-800">
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span>Matches</span><span>{filledCount}</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cupGold-500 rounded-full transition-all duration-300" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-8">
          {groups.map((group, idx) => {
            const isSaved = !!allPredictions[group.group];
            const isCurrent = idx === currentGroupIndex;
            const isDisabled = idx > currentGroupIndex && !isSaved && !isCurrent;
            return (
              <button key={group.group} onClick={() => goToGroup(idx)} disabled={isDisabled}
                className={`w-8 h-8 rounded-full text-[10px] font-bold transition-all ${isCurrent ? 'bg-cupGold-500 text-slate-950 shadow-lg shadow-cupGold-500/30' : isSaved ? 'bg-cupEmerald-600/30 text-cupEmerald-400 border border-cupEmerald-500/40' : 'bg-slate-800 text-slate-600'} ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-slate-700'}`}
                title={group.group}>{idx + 1}</button>
            );
          })}
        </div>
      </main>
    </div>
  );
}