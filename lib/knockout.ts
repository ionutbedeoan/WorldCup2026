/**
 * Knockout stage bracket logic for World Cup 2026.
 * 12 groups (A-L), top 2 from each (24 teams) + best 8 third-placed teams = 32 teams in Round of 32
 */

import { getFlagUrl, calculateGroupStandings } from './matchesData';

export interface KnockoutMatch {
  id: number;
  round: 'round_of_32' | 'round_of_16' | 'quarter_final' | 'semi_final' | 'third_place' | 'final';
  home_label: string;
  away_label: string;
  home_team: string | null;
  away_team: string | null;
  home_flag: string | null;
  away_flag: string | null;
  winner: 'home' | 'away' | null;
  roundName: string;
}

const groupLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

const THIRD_PLACE_SLOTS = ['1E', '1I', '1A', '1L', '1D', '1G', '1B', '1K'] as const;

// Slot constraints for third-place teams based on official World Cup 2026 rules
const SLOT_CONSTRAINTS: Record<string, string[]> = {
  '1E': ['A', 'B', 'C', 'D'],
  '1I': ['E', 'F', 'G', 'H'],
  '1A': ['C', 'D', 'E', 'F'],
  '1L': ['G', 'H', 'I', 'J'],
  '1D': ['A', 'B', 'C', 'D'],
  '1G': ['E', 'F', 'G', 'H'],
  '1B': ['I', 'J', 'K', 'L'],
  '1K': ['A', 'B', 'C', 'D'],
};

// Priority for assigning third-place teams to slots
const THIRD_PLACE_PRIORITY = [
  '1E', '1I', '1A', '1L', '1D', '1G', '1B', '1K'
];

export function getBestThirdPlaced(
  allPredictions: Record<string, Record<string, { home_score: number; away_score: number }>>
): { group: string; points: number; gd: number; gf: number }[] {
  const thirdPlaceStandings: { group: string; points: number; gd: number; gf: number }[] = [];

  groupLabels.forEach((label) => {
    const groupName = `Group ${label}`;
    const groupPreds = allPredictions[groupName];
    if (!groupPreds) return;

    const resultsMap: Record<string, { home_score: number; away_score: number } | null> = {};
    Object.entries(groupPreds).forEach(([key, val]) => { resultsMap[key] = val; });

    const standings = calculateGroupStandings(groupName, resultsMap);
    if (standings.length >= 3) {
      const third = standings[2];
      thirdPlaceStandings.push({
        group: label,
        points: third.points,
        gd: third.goal_diff,
        gf: third.goals_for,
      });
    }
  });

  thirdPlaceStandings.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.group.localeCompare(b.group);
  });

  return thirdPlaceStandings.slice(0, 8);
}

export function getTeamLabel(position: string, group: string): string {
  return `${position}${group}`;
}

export function resolveTeam(
  label: string,
  groupPredictions: Record<string, Record<string, { home_score: number; away_score: number }>>
): { name: string | null; flag: string | null } {
  if (!label || label === '—') return { name: null, flag: null };

  if (label.startsWith('W') || label.startsWith('L')) {
    return { name: label, flag: null };
  }

  const match = label.match(/^(\d)([A-L])$/);
  if (!match) return { name: label, flag: getFlagUrl(label) || null };

  const position = parseInt(match[1]);
  const groupLetter = match[2];
  const groupName = `Group ${groupLetter}`;
  const preds = groupPredictions[groupName];

  if (!preds) {
    console.warn(`[resolveTeam] No predictions found for ${groupName}. Available groups:`, Object.keys(groupPredictions));
    return { name: null, flag: null };
  }

  const resultsMap: Record<string, { home_score: number; away_score: number } | null> = {};
  Object.entries(preds).forEach(([key, val]) => { resultsMap[key] = val; });

  const standings = calculateGroupStandings(groupName, resultsMap);
  if (standings.length < position) {
    console.warn(`[resolveTeam] Position ${position} not found in standings for ${groupName}. Standings:`, standings.map(s => s.team));
    return { name: null, flag: null };
  }

  const team = standings[position - 1];
  console.log(`[resolveTeam] ${label} -> ${team.team}`);
  return { name: team.team, flag: team.flag_url || null };
}

export function getThirdPlaceSlots(
  bestThird: { group: string; points: number; gd: number; gf: number }[]
): Record<string, string> {
  if (bestThird.length === 0) return {};

  const availableGroups = new Set(bestThird.map((t) => t.group));
  const sortedThird = [...bestThird].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return a.group.localeCompare(b.group);
  });

  const result: Record<string, string> = {};
  const usedGroups = new Set<string>();

  for (const slot of THIRD_PLACE_PRIORITY) {
    const constraints = SLOT_CONSTRAINTS[slot];
    const available = constraints.filter((g) => availableGroups.has(g) && !usedGroups.has(g));

    let chosenGroup: string | null = null;

    if (available.length > 0) {
      // Pick the best available team that satisfies the slot constraints
      chosenGroup = available.sort((a, b) => {
        const teamA = sortedThird.find((t) => t.group === a);
        const teamB = sortedThird.find((t) => t.group === b);
        if (!teamA || !teamB) return 0;
        if (teamA.points !== teamB.points) return teamB.points - teamA.points;
        if (teamA.gd !== teamB.gd) return teamB.gd - teamA.gd;
        return teamB.gf - teamA.gf;
      })[0];
    } else {
      // No constraint-matched team available — fall back to the best remaining
      const remaining = sortedThird.filter((t) => !usedGroups.has(t.group));
      if (remaining.length > 0) {
        chosenGroup = remaining[0].group;
      }
    }

    if (chosenGroup) {
      result[slot] = `3${chosenGroup}`;
      usedGroups.add(chosenGroup);
    }
  }

  return result;
}

export function buildKnockoutBracket(
  groupPredictions: Record<string, Record<string, { home_score: number; away_score: number }>>
): KnockoutMatch[][] {
  const bestThird = getBestThirdPlaced(groupPredictions);
  const thirdPlaceSlots = getThirdPlaceSlots(bestThird);

  const roundOf32: KnockoutMatch[] = [
    { id: 73, round: 'round_of_32', home_label: '2A', away_label: '2B', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 74, round: 'round_of_32', home_label: '1E', away_label: thirdPlaceSlots['1E'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 75, round: 'round_of_32', home_label: '1F', away_label: '2C', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 76, round: 'round_of_32', home_label: '1C', away_label: '2F', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 77, round: 'round_of_32', home_label: '1I', away_label: thirdPlaceSlots['1I'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 78, round: 'round_of_32', home_label: '2E', away_label: '2I', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 79, round: 'round_of_32', home_label: '1A', away_label: thirdPlaceSlots['1A'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 80, round: 'round_of_32', home_label: '1L', away_label: thirdPlaceSlots['1L'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 81, round: 'round_of_32', home_label: '1D', away_label: thirdPlaceSlots['1D'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 82, round: 'round_of_32', home_label: '1G', away_label: thirdPlaceSlots['1G'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 83, round: 'round_of_32', home_label: '2K', away_label: '2L', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 84, round: 'round_of_32', home_label: '1H', away_label: '2J', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 85, round: 'round_of_32', home_label: '1B', away_label: thirdPlaceSlots['1B'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 86, round: 'round_of_32', home_label: '1J', away_label: '2H', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 87, round: 'round_of_32', home_label: '1K', away_label: thirdPlaceSlots['1K'] || '3?', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
    { id: 88, round: 'round_of_32', home_label: '2D', away_label: '2G', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 32' },
  ];

  const roundOf16: KnockoutMatch[] = [
    { id: 89, round: 'round_of_16', home_label: 'W74', away_label: 'W77', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 90, round: 'round_of_16', home_label: 'W73', away_label: 'W75', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 91, round: 'round_of_16', home_label: 'W76', away_label: 'W78', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 92, round: 'round_of_16', home_label: 'W79', away_label: 'W80', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 93, round: 'round_of_16', home_label: 'W83', away_label: 'W84', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 94, round: 'round_of_16', home_label: 'W81', away_label: 'W82', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 95, round: 'round_of_16', home_label: 'W86', away_label: 'W88', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
    { id: 96, round: 'round_of_16', home_label: 'W85', away_label: 'W87', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Round of 16' },
  ];

  const quarterFinals: KnockoutMatch[] = [
    { id: 97, round: 'quarter_final', home_label: 'W89', away_label: 'W90', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Quarter-Final' },
    { id: 98, round: 'quarter_final', home_label: 'W93', away_label: 'W94', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Quarter-Final' },
    { id: 99, round: 'quarter_final', home_label: 'W91', away_label: 'W92', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Quarter-Final' },
    { id: 100, round: 'quarter_final', home_label: 'W95', away_label: 'W96', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Quarter-Final' },
  ];

  const semiFinals: KnockoutMatch[] = [
    { id: 101, round: 'semi_final', home_label: 'W97', away_label: 'W98', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Semi-Final' },
    { id: 102, round: 'semi_final', home_label: 'W99', away_label: 'W100', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Semi-Final' },
  ];

  const thirdPlace: KnockoutMatch[] = [
    { id: 103, round: 'third_place', home_label: 'L101', away_label: 'L102', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'Third Place Match' },
  ];

  const final: KnockoutMatch[] = [
    { id: 104, round: 'final', home_label: 'W101', away_label: 'W102', home_team: null, away_team: null, home_flag: null, away_flag: null, winner: null, roundName: 'FINAL' },
  ];

  return [roundOf32, roundOf16, quarterFinals, semiFinals, thirdPlace, final];
}

export function resolveBracketTeams(
  bracketRounds: KnockoutMatch[][],
  groupPredictions: Record<string, Record<string, { home_score: number; away_score: number }>>,
  selectedWinners: Record<number, 'home' | 'away'>
): KnockoutMatch[][] {
  const roundsCopy = bracketRounds.map(round => round.map(match => ({ ...match })));
  const allMatches = roundsCopy.flat();

  // Apply selectedWinners FIRST so the resolution loop uses actual winners
  allMatches.forEach((match) => {
    if (selectedWinners[match.id]) {
      match.winner = selectedWinners[match.id];
    }
  });

  const resolvedTeams: Record<string, { name: string | null; flag: string | null }> = {};

  groupLabels.forEach((label) => {
    for (let pos = 1; pos <= 3; pos++) {
      const key = `${pos}${label}`;
      resolvedTeams[key] = resolveTeam(key, groupPredictions);
    }
  });

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    allMatches.forEach((match) => {
      if (!match.home_team && match.home_label) {
        if (resolvedTeams[match.home_label]) {
          match.home_team = resolvedTeams[match.home_label].name;
          match.home_flag = resolvedTeams[match.home_label].flag;
          if (match.home_team) changed = true;
        } else if (match.home_label.startsWith('W')) {
          const sourceId = parseInt(match.home_label.substring(1));
          const sourceMatch = allMatches.find((m) => m.id === sourceId);
          if (sourceMatch && sourceMatch.home_team && sourceMatch.away_team) {
            const winnerSide = sourceMatch.winner || 'home';
            const winnerName = winnerSide === 'home' ? sourceMatch.home_team : sourceMatch.away_team;
            const winnerFlag = winnerSide === 'home' ? sourceMatch.home_flag : sourceMatch.away_flag;
            resolvedTeams[match.home_label] = { name: winnerName, flag: winnerFlag };
            match.home_team = winnerName;
            match.home_flag = winnerFlag;
            changed = true;
          }
        } else if (match.home_label.startsWith('L')) {
          const sourceId = parseInt(match.home_label.substring(1));
          const sourceMatch = allMatches.find((m) => m.id === sourceId);
          if (sourceMatch && sourceMatch.home_team && sourceMatch.away_team) {
            const winnerSide = sourceMatch.winner || 'home';
            const loserName = winnerSide === 'home' ? sourceMatch.away_team : sourceMatch.home_team;
            const loserFlag = winnerSide === 'home' ? sourceMatch.away_flag : sourceMatch.home_flag;
            resolvedTeams[match.home_label] = { name: loserName, flag: loserFlag };
            match.home_team = loserName;
            match.home_flag = loserFlag;
            changed = true;
          }
        }
      }

      if (!match.away_team && match.away_label) {
        if (resolvedTeams[match.away_label]) {
          match.away_team = resolvedTeams[match.away_label].name;
          match.away_flag = resolvedTeams[match.away_label].flag;
          if (match.away_team) changed = true;
        } else if (match.away_label.startsWith('W')) {
          const sourceId = parseInt(match.away_label.substring(1));
          const sourceMatch = allMatches.find((m) => m.id === sourceId);
          if (sourceMatch && sourceMatch.home_team && sourceMatch.away_team) {
            const winnerSide = sourceMatch.winner || 'home';
            const winnerName = winnerSide === 'home' ? sourceMatch.home_team : sourceMatch.away_team;
            const winnerFlag = winnerSide === 'home' ? sourceMatch.home_flag : sourceMatch.away_flag;
            resolvedTeams[match.away_label] = { name: winnerName, flag: winnerFlag };
            match.away_team = winnerName;
            match.away_flag = winnerFlag;
            changed = true;
          }
        } else if (match.away_label.startsWith('L')) {
          const sourceId = parseInt(match.away_label.substring(1));
          const sourceMatch = allMatches.find((m) => m.id === sourceId);
          if (sourceMatch && sourceMatch.home_team && sourceMatch.away_team) {
            const winnerSide = sourceMatch.winner || 'home';
            const loserName = winnerSide === 'home' ? sourceMatch.away_team : sourceMatch.home_team;
            const loserFlag = winnerSide === 'home' ? sourceMatch.away_flag : sourceMatch.home_flag;
            resolvedTeams[match.away_label] = { name: loserName, flag: loserFlag };
            match.away_team = loserName;
            match.away_flag = loserFlag;
            changed = true;
          }
        }
      }
    });
  }

  return roundsCopy;
}