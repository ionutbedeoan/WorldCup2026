/**
 * Returns the result of a match based on home and away scores.
 */
export function getMatchResult(home: number, away: number): "HOME" | "AWAY" | "DRAW" {
  if (home > away) return "HOME";
  if (away > home) return "AWAY";
  return "DRAW";
}

/**
 * Calculates points awarded to a prediction compared to the actual match result.
 * - Exact score match → 3 points
 * - Same result (win/draw/lose) → 1 point
 * - Otherwise → 0 points
 */
export function calculatePoints(
  predHome: number | null | undefined,
  predAway: number | null | undefined,
  actualHome: number | null | undefined,
  actualAway: number | null | undefined
): number {
  if (
    predHome === null ||
    predHome === undefined ||
    predAway === null ||
    predAway === undefined ||
    actualHome === null ||
    actualHome === undefined ||
    actualAway === null ||
    actualAway === undefined
  ) {
    return 0;
  }

  // Exact score match
  if (predHome === actualHome && predAway === actualAway) {
    return 3;
  }

  // Same result (win/draw/lose)
  if (getMatchResult(predHome, predAway) === getMatchResult(actualHome, actualAway)) {
    return 1;
  }

  return 0;
}