import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Trophy, Gamepad2, LogOut, User, Eye } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');

  useEffect(() => {
    const savedUser = localStorage.getItem('worldcup_username');
    if (!savedUser) {
      navigate('/');
    } else {
      setUsername(savedUser);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('worldcup_username');
    localStorage.removeItem('worldcup_user_id');
    navigate('/');
  };

  return (
    <nav className="glass-panel sticky top-0 z-50 px-4 py-3 border-b border-slate-800 backdrop-blur-md mb-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Title / Logo */}
        <div className="flex items-center justify-between">
          <Link to="/game" className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-cupGold-450 animate-pulse text-cupGold-400" />
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-cupGold-300 bg-clip-text text-transparent">
              WC Predictor
            </span>
          </Link>
          <button
            onClick={handleLogout}
            className="md:hidden flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-900/30 bg-red-950/20 hover:bg-red-950/50 text-red-400 transition-all duration-200"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Leave</span>
          </button>
        </div>

        {/* User Info */}
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 bg-slate-900/90 px-3 py-1.5 rounded-full border border-slate-800">
            <User className="h-3.5 w-3.5 text-cupGold-400" />
            <span className="font-semibold text-slate-200">{username}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto">
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800/85 w-full md:w-auto">
            <Link
              to="/game"
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all w-1/2 md:w-auto ${
                location.pathname === '/game'
                  ? 'bg-cupGold-500 text-slate-950 font-bold shadow-md shadow-cupGold-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
              <span>Predict</span>
            </Link>
            <Link
              to="/my-predictions"
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all w-1/2 md:w-auto ${
                location.pathname === '/my-predictions'
                  ? 'bg-cupGold-500 text-slate-950 font-bold shadow-md shadow-cupGold-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Eye className="h-4 w-4" />
              <span>My Predictions</span>
            </Link>
            <Link
              to="/leaderboard"
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all w-1/2 md:w-auto ${
                location.pathname === '/leaderboard'
                  ? 'bg-cupGold-500 text-slate-950 font-bold shadow-md shadow-cupGold-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <Trophy className="h-4 w-4" />
              <span>Leaderboard</span>
            </Link>
          </div>

          <button
            onClick={handleLogout}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-red-900/30 bg-red-950/20 hover:bg-red-950/50 text-red-400 text-sm font-medium transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
