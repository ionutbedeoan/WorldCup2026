import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, ArrowRight, ShieldAlert, Lock } from 'lucide-react';
import { checkUsernameExists, getUserPassword, createUserWithPassword } from '../lib/supabaseClient';

export default function Home() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmingReconnect, setConfirmingReconnect] = useState('');
  const [reconnectPassword, setReconnectPassword] = useState('');
  const [reconnectError, setReconnectError] = useState('');

  // If already logged in, redirect to game
  useEffect(() => {
    const savedUser = localStorage.getItem('worldcup_username');
    const savedPass = localStorage.getItem('worldcup_password');
    if (savedUser && savedPass) {
      navigate('/game');
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setErrorMsg('Please enter a username.');
      return;
    }

    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters.');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('Please enter a password (at least 1 character).');
      return;
    }

    setIsLoading(true);

    try {
      // Check if this username already exists in the database
      const exists = await checkUsernameExists(cleanUsername);
      if (exists) {
        setConfirmingReconnect(cleanUsername);
        setReconnectPassword(cleanPassword);
        setIsLoading(false);
        return;
      }

      // Generate a consistent user ID based on username
      const userId = `${cleanUsername.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;

      // Save to localStorage
      localStorage.setItem('worldcup_username', cleanUsername);
      localStorage.setItem('worldcup_password', cleanPassword);
      localStorage.setItem('worldcup_user_id', userId);

      // Save user to database with password
      try {
        await createUserWithPassword(userId, cleanUsername, cleanPassword);
      } catch (dbErr: any) {
        console.warn('Could not save user to database:', dbErr);
        // Continue anyway - user can still play with localStorage
      }

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

        {/* Reconnect Confirmation */}
        {confirmingReconnect && (
          <div className="mb-6 p-5 rounded-2xl bg-cupGold-500/10 border border-cupGold-500/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-cupGold-500/20 flex items-center justify-center flex-shrink-0">
                <Lock className="h-5 w-5 text-cupGold-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Verify Password</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  <strong className="text-cupGold-300">"{confirmingReconnect}"</strong> already exists.
                  Enter your password to reconnect.
                </p>
              </div>
            </div>

            {reconnectError && (
              <div className="mb-3 p-3 rounded-xl bg-red-950/30 border border-red-900/40 text-red-300 text-xs flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                <span>{reconnectError}</span>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="reconnect-password" className="block text-xs font-semibold text-slate-400 mb-1.5">
                Password
              </label>
              <input
                id="reconnect-password"
                type="password"
                value={reconnectPassword}
                onChange={(e) => { setReconnectPassword(e.target.value); setReconnectError(''); }}
                placeholder="Enter your password"
                className="w-full px-4 py-2.5 bg-slate-900/80 border border-slate-700 focus:border-cupGold-500 focus:outline-none rounded-xl text-white text-sm transition-all placeholder-slate-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={async () => {
                  const pass = reconnectPassword.trim();
                  if (!pass) {
                    setReconnectError('Please enter your password.');
                    return;
                  }
                  try {
                    const storedPassword = await getUserPassword(confirmingReconnect);
                    if (storedPassword === null) {
                      setReconnectError('User not found. Please try again.');
                      return;
                    }
                    if (pass !== storedPassword) {
                      setReconnectError('Incorrect password. Try again or use a different username.');
                      return;
                    }
                    const uId = `${confirmingReconnect.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                    localStorage.setItem('worldcup_username', confirmingReconnect);
                    localStorage.setItem('worldcup_password', pass);
                    localStorage.setItem('worldcup_user_id', uId);
                    setConfirmingReconnect('');
                    navigate('/game');
                  } catch (err: any) {
                    setReconnectError(err.message || 'Error verifying password.');
                  }
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-cupGold-500 hover:bg-cupGold-400 text-slate-950 font-bold rounded-xl transition-all text-sm"
              >
                <Lock className="h-4 w-4" />
                <span>Verify &amp; Reconnect</span>
              </button>
              <button
                onClick={() => {
                  setConfirmingReconnect('');
                  setUsername('');
                  setPassword('');
                  setReconnectPassword('');
                  setReconnectError('');
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-all text-sm border border-slate-700"
              >
                Use Another Name
              </button>
            </div>
          </div>
        )}

        {/* Action Form */}
        {!confirmingReconnect && (
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

            <div>
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="password"
                  type="password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                  placeholder="Any password (min. 1 character)"
                  className="w-full pl-10 pr-4 py-3.5 bg-slate-900/80 border border-slate-800 hover:border-slate-700 focus:border-cupGold-500 focus:outline-none rounded-xl text-white text-base transition-all placeholder-slate-500"
                />
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5">
                Enter any password you like — even a single character is fine.
              </p>
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
        )}
      </div>

      <footer className="mt-8 text-center text-xs text-slate-600">
        World Cup Predictor Game &bull; Server-less Session
      </footer>
    </div>
  );
}
