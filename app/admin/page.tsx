import { useState, useEffect } from 'react';
import {
  getAllUsersWithPredictions,
  deleteUserPredictions,
} from '../../lib/supabaseClient';
import {
  Shield,
  Lock,
  Unlock,
  Trash2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Swords,
  Trophy,
  RefreshCw,
} from 'lucide-react';

type UserWithPredictions = {
  id: string;
  username: string;
  predictions: Record<string, any> | null;
  created_at: string;
};

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  const [users, setUsers] = useState<UserWithPredictions[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const ADMIN_PASSWORD = 'admin';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setWrongPassword(false);
      setMessage(null);
    } else {
      setWrongPassword(true);
      setMessage({ type: 'error', text: 'Incorrect password. Access denied.' });
    }
  };

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await getAllUsersWithPredictions();
      setUsers(data);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to load users.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadUsers();
    }
  }, [isAuthenticated]);

  const handleDelete = async (userId: string) => {
    setIsDeleting(true);
    setMessage(null);
    try {
      await deleteUserPredictions(userId);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, predictions: null } : u
        )
      );
      setDeleteConfirm(null);
      setMessage({ type: 'success', text: 'Predictions deleted successfully!' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error('Error deleting predictions:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to delete predictions.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const countPredictions = (predictions: Record<string, any> | null): number => {
    if (!predictions) return 0;
    let count = 0;
    const data = predictions as any;
    // Count group predictions
    if (data.group_predictions) {
      Object.values(data.group_predictions).forEach((groupPreds: any) => {
        if (groupPreds && typeof groupPreds === 'object') {
          count += Object.keys(groupPreds).length;
        }
      });
    }
    // Count knockout predictions
    if (data.knockout_bracket) {
      data.knockout_bracket.forEach((round: any[]) => {
        count += round.length;
      });
    }
    return count;
  };

  const hasAnyPredictions = (predictions: Record<string, any> | null): boolean => {
    return countPredictions(predictions) > 0;
  };

  // If not authenticated, show password form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="glass-panel rounded-3xl border border-slate-800 p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl border border-slate-700 mb-4">
                <Shield className="h-8 w-8 text-slate-400" />
              </div>
              <h1 className="text-2xl font-extrabold text-white">Admin Access</h1>
              <p className="text-sm text-slate-400 mt-1">
                Enter the admin password to continue.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setWrongPassword(false);
                  }}
                  placeholder="Enter admin password"
                  className={`w-full pl-10 pr-4 py-3 bg-slate-900 border ${
                    wrongPassword ? 'border-red-500' : 'border-slate-700'
                  } rounded-xl text-white text-sm font-semibold placeholder-slate-500 focus:outline-none focus:border-cupGold-500 transition-all`}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={!password}
                className="w-full py-3 bg-cupGold-500 hover:bg-cupGold-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <Unlock className="h-4 w-4" />
                <span>Unlock Admin Panel</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      {/* Minimal dark header */}
      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-400" />
            <span className="font-extrabold text-lg text-white">Admin Panel</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {users.length} user{users.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setIsAuthenticated(false);
                setPassword('');
                setMessage(null);
              }}
              className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-semibold rounded-lg transition-all"
            >
              Lock
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 mt-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <Trash2 className="h-6 w-6 text-red-400" />
              <span>Manage Predictions</span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              View all users and delete their predictions if needed.
            </p>
          </div>
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-700 bg-slate-900/65 hover:bg-slate-800/80 disabled:opacity-50 text-slate-300 text-sm font-semibold rounded-xl transition-all"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Message */}
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

        {/* Users list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 border border-slate-800 animate-pulse h-16" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="glass-panel rounded-3xl p-10 border border-slate-800 text-center">
            <Users className="h-10 w-10 text-slate-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-200">No Users Found</h3>
            <p className="text-sm text-slate-400 mt-1">No users have registered yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const isExpanded = expandedUser === user.id;
              const isDeletingThis = deleteConfirm === user.id;
              const predCount = countPredictions(user.predictions);
              const hasPreds = hasAnyPredictions(user.predictions);

              return (
                <div key={user.id}>
                  {/* User card header */}
                  <div
                    className={`w-full text-left relative overflow-hidden rounded-2xl p-4 border flex items-center justify-between transition-all ${
                      isExpanded
                        ? 'rounded-b-none border-b-0 bg-slate-900/90 border-red-500/30'
                        : hasPreds
                        ? 'bg-slate-900/80 border-slate-700 hover:border-slate-600'
                        : 'bg-slate-900/40 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-slate-600">
                        <span className="text-sm font-extrabold text-slate-300">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-200 truncate">
                            {user.username}
                          </span>
                          {hasPreds ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cupEmerald-900/30 text-cupEmerald-400 border border-cupEmerald-800/50">
                              {predCount} preds
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-500">
                              no preds
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[200px]">
                          ID: {user.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasPreds && (
                        <div className="flex items-center gap-1">
                          {isDeletingThis ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleDelete(user.id)}
                                disabled={isDeleting}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition-all disabled:opacity-50"
                              >
                                {isDeleting ? '...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-bold rounded-lg transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(user.id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-red-900/40 bg-red-950/20 hover:bg-red-950/50 text-red-400 text-[10px] font-bold rounded-lg transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => setExpandedUser(isExpanded ? null : user.id)}
                        className="p-1 hover:bg-slate-800 rounded-lg transition-all"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded predictions view */}
                  {isExpanded && (
                    <div className="bg-slate-900/70 border border-red-500/20 border-t-0 rounded-b-2xl p-4 overflow-hidden">
                      {!hasPreds ? (
                        <p className="text-xs text-slate-500 text-center py-2">
                          This user has no saved predictions.
                        </p>
                      ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar pr-1">
                          {/* Group predictions */}
                          {user.predictions?.group_predictions && (
                            <div>
                              <h4 className="text-[10px] font-bold text-cupGold-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Trophy className="h-3 w-3" />
                                <span>Group Stage</span>
                              </h4>
                              {Object.entries(user.predictions.group_predictions).map(([groupName, matches]: [string, any]) => {
                                const matchEntries = Object.entries(matches || {});
                                if (matchEntries.length === 0) return null;
                                return (
                                  <div key={groupName} className="mb-2">
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                                      {groupName}
                                    </div>
                                    <div className="space-y-1">
                                      {matchEntries.map(([matchKey, score]: [string, any]) => {
                                        const teams = matchKey.split('_vs_');
                                        return (
                                          <div
                                            key={matchKey}
                                            className="flex items-center justify-between bg-slate-800/40 px-2.5 py-1.5 rounded-lg"
                                          >
                                            <span className="text-xs text-slate-300 truncate flex-1">
                                              {teams[0]}
                                            </span>
                                            <span className="text-xs font-extrabold text-white mx-2">
                                              {score.home_score} : {score.away_score}
                                            </span>
                                            <span className="text-xs text-slate-300 truncate flex-1 text-right">
                                              {teams[1] || '?'}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Knockout predictions */}
                          {user.predictions?.knockout_bracket && user.predictions.knockout_bracket.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-bold text-cupGold-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                <Swords className="h-3 w-3" />
                                <span>Knockout Stage</span>
                              </h4>
                              {user.predictions.knockout_bracket.map((round: any[], ri: number) => {
                                if (round.length === 0) return null;
                                const roundNames: Record<string, string> = {
                                  round_of_32: 'Round of 32',
                                  round_of_16: 'Round of 16',
                                  quarter_final: 'Quarter-Finals',
                                  semi_final: 'Semi-Finals',
                                  third_place: 'Third Place',
                                  final: 'Final',
                                };
                                return (
                                  <div key={ri} className="mb-2">
                                    <div className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
                                      {roundNames[round[0].round] || round[0].round}
                                    </div>
                                    <div className="space-y-1">
                                      {round.map((match: any) => {
                                        const winner = user.predictions?.knockout_winners?.[match.id];
                                        return (
                                          <div
                                            key={match.id}
                                            className="flex items-center justify-between bg-slate-800/40 px-2.5 py-1.5 rounded-lg"
                                          >
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                              <span className={`text-xs truncate ${winner === 'home' ? 'text-cupGold-300 font-bold' : 'text-slate-400'}`}>
                                                {match.home_team || 'TBD'}
                                              </span>
                                              {winner === 'home' && <span className="text-[9px] text-cupGold-400">★</span>}
                                            </div>
                                            <span className="text-[10px] text-slate-600 mx-2">vs</span>
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                                              {winner === 'away' && <span className="text-[9px] text-cupGold-400">★</span>}
                                              <span className={`text-xs truncate ${winner === 'away' ? 'text-cupGold-300 font-bold' : 'text-slate-400'}`}>
                                                {match.away_team || 'TBD'}
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info */}
        <div className="mt-6 p-3 rounded-xl bg-slate-800/30 border border-slate-700/50 text-xs text-slate-500 text-center">
          <p>This panel is for administrators only. Use the delete button next to any user to remove all their predictions.</p>
        </div>
      </main>
    </div>
  );
}
