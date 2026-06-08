import { Trophy } from 'lucide-react';

interface BracketMatch {
  id: number;
  home_team: string | null;
  away_team: string | null;
  home_flag: string | null;
  away_flag: string | null;
  winner: 'home' | 'away' | null;
  roundName: string;
}

interface Props {
  bracketRounds: BracketMatch[][];
  selectedWinners: Record<number, 'home' | 'away'>;
  onPickWinner: (matchId: number, side: 'home' | 'away') => void;
}

export default function BracketVisualization({
  bracketRounds,
  selectedWinners,
  onPickWinner,
}: Props) {
  // Extract rounds from bracketRounds
  const roundOf32 = bracketRounds[0] || [];
  const roundOf16 = bracketRounds[1] || [];
  const quarterFinals = bracketRounds[2] || [];
  const semiFinals = bracketRounds[3] || [];
  const thirdPlaceMatch = bracketRounds[4] || [];
  const final = bracketRounds[5] || [];

  const BracketColumn = ({
    matches,
    roundName,
    spacing = 'gap-0',
  }: {
    matches: BracketMatch[];
    roundName: string;
    spacing?: string;
  }) => (
    <div className="flex flex-col items-center">
      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 whitespace-nowrap">
        {roundName}
      </h3>
      <div className={`flex flex-col ${spacing}`}>
        {matches.map((match) => {
          const isHomeWinner = match.winner === 'home';
          const isAwayWinner = match.winner === 'away';
          const isFinalized = match.home_team && match.away_team;

          return (
            <div key={match.id} className="flex flex-col w-48">
              {/* Home Team */}
              <button
                onClick={() => isFinalized && onPickWinner(match.id, 'home')}
                disabled={!isFinalized}
                className={`px-3 py-2 text-xs font-semibold border transition-all flex items-center gap-2 ${
                  !isFinalized
                    ? 'bg-slate-900/30 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                    : isHomeWinner
                    ? 'bg-cupGold-500/30 border-cupGold-500 text-cupGold-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
                }`}
              >
                {match.home_flag && (
                  <img src={match.home_flag} alt="" className="w-4 h-3 rounded object-cover flex-shrink-0" />
                )}
                <span className="truncate flex-1">{match.home_team || 'TBD'}</span>
                {isHomeWinner && <Trophy className="h-3 w-3 flex-shrink-0" />}
              </button>

              {/* VS Divider */}
              <div className="px-3 py-1 bg-slate-900 border-l border-r border-slate-700 text-[10px] text-slate-500 font-bold text-center">
                VS
              </div>

              {/* Away Team */}
              <button
                onClick={() => isFinalized && onPickWinner(match.id, 'away')}
                disabled={!isFinalized}
                className={`px-3 py-2 text-xs font-semibold border transition-all flex items-center gap-2 ${
                  !isFinalized
                    ? 'bg-slate-900/30 border-slate-700 text-slate-500 cursor-not-allowed opacity-50'
                    : isAwayWinner
                    ? 'bg-cupGold-500/30 border-cupGold-500 text-cupGold-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
                }`}
              >
                {isAwayWinner && <Trophy className="h-3 w-3 flex-shrink-0" />}
                <span className="truncate flex-1">{match.away_team || 'TBD'}</span>
                {match.away_flag && (
                  <img src={match.away_flag} alt="" className="w-4 h-3 rounded object-cover flex-shrink-0" />
                )}
              </button>

              {/* Match ID display */}
              <div className="text-[8px] text-slate-600 text-center mt-1">Match {match.id}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 px-4 min-w-max items-start py-6">
        {/* Round of 32 */}
        <BracketColumn
          matches={roundOf32}
          roundName="⚽ Round of 32"
          spacing="gap-2"
        />

        {/* Round of 16 (Optimile) */}
        <BracketColumn
          matches={roundOf16}
          roundName="🔴 Round of 16 (Optimile)"
          spacing="gap-4"
        />

        {/* Quarter-Finals (Sferturile) */}
        <BracketColumn
          matches={quarterFinals}
          roundName="🟡 Quarter-Finals (Sferturile)"
          spacing="gap-8"
        />

        {/* Semi-Finals (Semifinalele) */}
        <BracketColumn
          matches={semiFinals}
          roundName="🟠 Semi-Finals (Semifinalele)"
          spacing="gap-16"
        />

        {/* Third Place / Final */}
        <BracketColumn
          matches={[...thirdPlaceMatch, ...final]}
          roundName={final.length ? "🏆 FINAL" : "🏆 FINAL"}
          spacing="gap-24"
        />

        {/* Champion Display */}
        {final[0]?.winner && (
          <div className="flex flex-col items-center justify-center min-w-max">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4 whitespace-nowrap">
              Champion
            </div>
            <div className="w-48 bg-gradient-to-br from-cupGold-500/30 to-cupGold-950/50 border-2 border-cupGold-500 rounded-lg p-4 text-center flex flex-col items-center justify-center min-h-[120px]">
              <Trophy className="h-8 w-8 text-cupGold-400 mb-2 animate-pulse" />
              <p className="text-sm font-bold text-cupGold-300">
                {final[0].winner === 'home' ? final[0].home_team : final[0].away_team}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">World Cup 2026</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
