import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, ShieldAlert } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // If already logged in, redirect to game
  useEffect(() => {
    const savedUser = localStorage.getItem('worldcup_username');
    if (savedUser) {
      navigate('/game');
    }
  }, [navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = username.trim();

    if (!cleanUsername) {
      setErrorMsg('Please enter a username.');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }

    setIsLoading(true);

    try {
      // Generate a unique user ID based on username + timestamp
      const userId = `${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;

      // Save to localStorage (no DB call)
      localStorage.setItem('worldcup_username', cleanUsername);
      localStorage.setItem('worldcup_user_id', userId);

      // Redirect
      navigate('/game');
    } catch (err: any) {
      console.error('Error joining game:', err);
      setErrorMsg(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 relative overflow-hidden bg-slate-950">
      {/* Decorative gradient glowing backgrounds */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] md:w-[500px] md:h-[500px] bg-cupGold-900/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[200px] h-[200px] bg-cupEmerald-950/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md glass-panel p-8 md:p-10 rounded-3xl border border-slate-800 shadow-2xl relative">
        
        {/* Logo and Headings */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-cupGold-500/10 rounded-2xl border border-cupGold-500/30 flex items-center justify-center mb-4 shadow-lg shadow-cupGold-500/5 animate-bounce-slow">
            <Trophy className="h-9 w-9 text-cupGold-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
            World Cup Predictor
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Enter your username to start predicting scores!
          </p>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/30 border border-red-900/40 text-red-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Action Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              required
              disabled={isLoading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. Messi10"
              className="w-full px-4 py-3.5 bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus:border-cupGold-500 focus:outline-none rounded-xl text-white text-base transition-all placeholder-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-cupGold-500 hover:bg-cupGold-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-base rounded-xl transition-all duration-300 flex items-center justify-center gap-2 group shadow-lg shadow-cupGold-500/10 hover:shadow-cupGold-500/20"
          >
            <span>{isLoading ? 'Joining game...' : 'Join Game'}</span>
            {!isLoading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      </div>

      <footer className="mt-8 text-center text-xs text-slate-600">
        World Cup Predictor Game &bull; Server-less Session
      </footer>
    </div>
  );
}
