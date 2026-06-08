import groupStageData from '../app/game/world_cup_2026_group_stage.json';
import groupsData from '../app/game/world_cup_2026_groups.json';

export interface GroupTeam {
  name: string;
  flag_url: string;
}

export interface GroupInfo {
  group: string;
  teams: GroupTeam[];
}

export interface GroupMatch {
  stage: string;
  group: string;
  match_number: number;
  date: string;
  home_team: string;
  away_team: string;
  stadium: string;
  city: string;
}

export interface ScoredMatch extends GroupMatch {
  home_score: number | null;
  away_score: number | null;
  status: 'scheduled' | 'finished';
}

const groups: GroupInfo[] = groupsData as GroupInfo[];
const allMatches: GroupMatch[] = groupStageData as GroupMatch[];

// Build a map of team name -> flag_url for quick lookup
const flagMap: Record<string, string> = {};
groups.forEach((group) => {
  group.teams.forEach((team: any) => {
    if (typeof team === 'object' && team.flag_url) {
      flagMap[team.name] = team.flag_url;
    }
  });
});

/**
 * Returns all groups.
 */
export function getGroups(): GroupInfo[] {
  return groups;
}

/**
 * Returns all group stage matches.
 */
export function getAllGroupMatches(): GroupMatch[] {
  return allMatches;
}

/**
 * Returns matches for a specific group.
 */
export function getMatchesByGroup(groupName: string): GroupMatch[] {
  return allMatches.filter((m) => m.group === groupName);
}

/**
 * Returns a map of group name -> matches for quick lookup.
 */
export function getGroupedMatches(): Record<string, GroupMatch[]> {
  const grouped: Record<string, GroupMatch[]> = {};
  allMatches.forEach((m) => {
    if (!grouped[m.group]) grouped[m.group] = [];
    grouped[m.group].push(m);
  });
  return grouped;
}

/**
 * Returns the flag URL for a team name, or undefined if not found.
 */
export function getFlagUrl(teamName: string): string | undefined {
  return flagMap[teamName];
}

/**
 * Converts a GroupMatch into a ScoredMatch by fetching the real score from results map.
 * Results map is: `home_team_vs_away_team` -> { home_score, away_score }
 */
export function applyResults(
  match: GroupMatch,
  resultsMap: Record<string, { home_score: number; away_score: number } | null>
): ScoredMatch {
  const key = `${match.home_team}_vs_${match.away_team}`;
  const result = resultsMap[key];

  return {
    ...match,
    home_score: result?.home_score ?? null,
    away_score: result?.away_score ?? null,
    status: result ? 'finished' : 'scheduled',
  };
}

/**
 * Calculates group standings based on match results.
 * Returns sorted array: points DESC, goal_diff DESC, goals_for DESC.
 */
export function calculateGroupStandings(
  groupName: string,
  resultsMap: Record<string, { home_score: number; away_score: number } | null>
): { team: string; flag_url: string; played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number; goal_diff: number; points: number }[] {
  const groupMatches = getMatchesByGroup(groupName);
  const standings: Record<string, { played: number; won: number; drawn: number; lost: number; goals_for: number; goals_against: number }> = {};

  // Initialize all teams
  const group = groups.find((g) => g.group === groupName);
  if (group) {
    group.teams.forEach((team: any) => {
      const name = typeof team === 'string' ? team : team.name;
      standings[name] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 };
    });
  }

  // Process each match result
  groupMatches.forEach((match) => {
    const key = `${match.home_team}_vs_${match.away_team}`;
    const result = resultsMap[key];
    if (!result) return;

    const { home_score, away_score } = result;

    if (!standings[match.home_team]) {
      standings[match.home_team] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 };
    }
    if (!standings[match.away_team]) {
      standings[match.away_team] = { played: 0, won: 0, drawn: 0, lost: 0, goals_for: 0, goals_against: 0 };
    }

    standings[match.home_team].played += 1;
    standings[match.away_team].played += 1;
    standings[match.home_team].goals_for += home_score;
    standings[match.home_team].goals_against += away_score;
    standings[match.away_team].goals_for += away_score;
    standings[match.away_team].goals_against += home_score;

    if (home_score > away_score) {
      standings[match.home_team].won += 1;
      standings[match.away_team].lost += 1;
    } else if (home_score < away_score) {
      standings[match.away_team].won += 1;
      standings[match.home_team].lost += 1;
    } else {
      standings[match.home_team].drawn += 1;
      standings[match.away_team].drawn += 1;
    }
  });

  // Convert to array and sort
  return Object.entries(standings)
    .map(([team, stats]) => ({
      team,
      flag_url: flagMap[team] || '',
      ...stats,
      goal_diff: stats.goals_for - stats.goals_against,
      points: stats.won * 3 + stats.drawn,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goal_diff !== a.goal_diff) return b.goal_diff - a.goal_diff;
      if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
      return a.team.localeCompare(b.team);
    });
}

/**
 * Evaluates a user's predictions against actual results and returns points.
 * Exact score = 3 pts, correct outcome = 1 pt, wrong = 0 pts.
 */
export function evaluatePredictions(
  predictions: Record<string, { home_score: number; away_score: number }>,
  resultsMap: Record<string, { home_score: number; away_score: number } | null>
): { totalPoints: number; exactScores: number; correctOutcomes: number; details: { matchKey: string; points: number }[] } {
  let totalPoints = 0;
  let exactScores = 0;
  let correctOutcomes = 0;
  const details: { matchKey: string; points: number }[] = [];

  Object.entries(predictions).forEach(([matchKey, pred]) => {
    const result = resultsMap[matchKey];
    if (!result) {
      details.push({ matchKey, points: 0 });
      return;
    }

    const { home_score, away_score } = result;
    let points = 0;

    if (pred.home_score === home_score && pred.away_score === away_score) {
      points = 3;
      exactScores += 1;
    } else {
      const predDiff = pred.home_score - pred.away_score;
      const actualDiff = home_score - away_score;
      const predResult = predDiff > 0 ? 'HOME' : predDiff < 0 ? 'AWAY' : 'DRAW';
      const actualResult = actualDiff > 0 ? 'HOME' : actualDiff < 0 ? 'AWAY' : 'DRAW';

      if (predResult === actualResult) {
        points = 1;
        correctOutcomes += 1;
      }
    }

    totalPoints += points;
    details.push({ matchKey, points });
  });

  return { totalPoints, exactScores, correctOutcomes, details };
}