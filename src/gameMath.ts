export type OutcomeOdds = {
  win: number;
  tie: number;
  loss: number;
};

export type Decision = 'roll' | 'stand' | 'win' | 'bust';

export type PolicyState = {
  total: number;
  stand: OutcomeOdds;
  roll: OutcomeOdds;
  optimal: OutcomeOdds;
  decision: Decision;
};

export type NextRollOutcome = {
  roll: number;
  probability: number;
  probabilityPercent: number;
  resultingTotal: number;
  label: string;
  outcome: 'Bust' | '21' | 'Continue';
  optimalWinPercent: number;
  rollValuePercent: number;
  standValuePercent: number;
};

export type GameResult = 'win' | 'tie' | 'loss';

export type SimulationSummary = {
  games: number;
  threshold: number;
  wins: number;
  ties: number;
  losses: number;
  simulated: OutcomeOdds;
  exact: OutcomeOdds;
  p1Totals: DistributionPoint[];
  p2Totals: DistributionPoint[];
};

export type DistributionPoint = {
  value: number;
  count: number;
  probability: number;
  probabilityPercent: number;
};

export type LandingPoint = {
  total: number;
  probability: number;
  probabilityPercent: number;
  result: GameResult;
};

export const DICE_DISTRIBUTION = [
  { roll: 2, ways: 1 },
  { roll: 3, ways: 2 },
  { roll: 4, ways: 3 },
  { roll: 5, ways: 4 },
  { roll: 6, ways: 5 },
  { roll: 7, ways: 6 },
  { roll: 8, ways: 5 },
  { roll: 9, ways: 4 },
  { roll: 10, ways: 3 },
  { roll: 11, ways: 2 },
  { roll: 12, ways: 1 },
].map((entry) => ({
  ...entry,
  probability: entry.ways / 36,
}));

const emptyOdds = (): OutcomeOdds => ({ win: 0, tie: 0, loss: 0 });

const addWeighted = (target: OutcomeOdds, source: OutcomeOdds, weight: number) => {
  target.win += source.win * weight;
  target.tie += source.tie * weight;
  target.loss += source.loss * weight;
};

export const oddsSum = (odds: OutcomeOdds) => odds.win + odds.tie + odds.loss;

export const formatPercent = (value: number, digits = 1) =>
  `${(value * 100).toFixed(digits)}%`;

export function rollTwoDice() {
  const dieOne = Math.floor(Math.random() * 6) + 1;
  const dieTwo = Math.floor(Math.random() * 6) + 1;

  return {
    dieOne,
    dieTwo,
    total: dieOne + dieTwo,
  };
}

export function computeStandOdds(playerTotal: number): OutcomeOdds {
  if (playerTotal <= 0) {
    return { win: 0, tie: 0, loss: 1 };
  }

  if (playerTotal === 21) {
    return { win: 1, tie: 0, loss: 0 };
  }

  if (playerTotal > 21) {
    return { win: 0, tie: 0, loss: 1 };
  }

  const chances = emptyOdds();
  let active: Record<number, number> = { 0: 1 };

  while (Object.keys(active).length > 0) {
    const nextActive: Record<number, number> = {};

    Object.entries(active).forEach(([scoreText, scoreProbability]) => {
      const score = Number(scoreText);

      DICE_DISTRIBUTION.forEach(({ roll, probability }) => {
        const nextScore = score + roll;
        const weightedProbability = Number(scoreProbability) * probability;

        if (nextScore > 21) {
          chances.win += weightedProbability;
        } else if (nextScore === playerTotal) {
          chances.tie += weightedProbability;
        } else if (nextScore > playerTotal) {
          chances.loss += weightedProbability;
        } else {
          nextActive[nextScore] = (nextActive[nextScore] ?? 0) + weightedProbability;
        }
      });
    });

    active = nextActive;
  }

  return chances;
}

export function computeOptimalPolicy() {
  const terminal: Record<number, OutcomeOdds> = {};

  for (let total = 22; total <= 33; total += 1) {
    terminal[total] = { win: 0, tie: 0, loss: 1 };
  }

  terminal[21] = { win: 1, tie: 0, loss: 0 };

  const states: Record<number, PolicyState> = {};
  const standOdds: Record<number, OutcomeOdds> = {};
  const bestOdds: Record<number, OutcomeOdds> = { ...terminal };

  for (let total = 0; total <= 21; total += 1) {
    standOdds[total] = computeStandOdds(total);
  }

  for (let total = 20; total >= 0; total -= 1) {
    const rollOdds = emptyOdds();

    DICE_DISTRIBUTION.forEach(({ roll, probability }) => {
      addWeighted(rollOdds, bestOdds[total + roll], probability);
    });

    const stand = standOdds[total];
    const shouldStand = stand.win > rollOdds.win;
    const optimal = shouldStand ? stand : rollOdds;

    bestOdds[total] = optimal;
    states[total] = {
      total,
      stand,
      roll: rollOdds,
      optimal,
      decision: shouldStand ? 'stand' : 'roll',
    };
  }

  states[21] = {
    total: 21,
    stand: standOdds[21],
    roll: { win: 0, tie: 0, loss: 1 },
    optimal: bestOdds[21],
    decision: 'win',
  };

  return states;
}

export const POLICY = computeOptimalPolicy();

export function stateForTotal(total: number) {
  if (total > 21) {
    return {
      total,
      stand: { win: 0, tie: 0, loss: 1 },
      roll: { win: 0, tie: 0, loss: 1 },
      optimal: { win: 0, tie: 0, loss: 1 },
      decision: 'bust' as Decision,
    };
  }

  return POLICY[Math.max(0, total)];
}

export function nextRollOutcomes(total: number): NextRollOutcome[] {
  return DICE_DISTRIBUTION.map(({ roll, probability }) => {
    const resultingTotal = total + roll;
    const state = stateForTotal(resultingTotal);
    const outcome =
      resultingTotal > 21 ? 'Bust' : resultingTotal === 21 ? '21' : 'Continue';

    return {
      roll,
      probability,
      probabilityPercent: probability * 100,
      resultingTotal,
      label: `${roll}`,
      outcome,
      optimalWinPercent: state.optimal.win * 100,
      rollValuePercent: state.roll.win * 100,
      standValuePercent: state.stand.win * 100,
    };
  });
}

export function resolvePlayerTwo(playerTotal: number) {
  const rolls: number[] = [];
  let total = 0;

  while (true) {
    const roll = rollTwoDice().total;
    rolls.push(roll);
    total += roll;

    if (total > 21) {
      return {
        total,
        rolls,
        result: 'win' as const,
        message: `Player 2 busted at ${total}. Player 1 wins.`,
      };
    }

    if (total === playerTotal) {
      return {
        total,
        rolls,
        result: 'tie' as const,
        message: `Player 2 matched ${playerTotal}. It is a tie.`,
      };
    }

    if (total > playerTotal) {
      return {
        total,
        rolls,
        result: 'loss' as const,
        message: `Player 2 reached ${total}. Player 1 loses.`,
      };
    }
  }
}

export function computePlayerTwoChaseOdds(
  playerTotal: number,
  playerTwoTotal = 0,
): OutcomeOdds {
  const memo: Record<number, OutcomeOdds> = {};

  function compute(total: number): OutcomeOdds {
    if (total > 21) return { win: 1, tie: 0, loss: 0 };
    if (total === playerTotal) return { win: 0, tie: 1, loss: 0 };
    if (total > playerTotal) return { win: 0, tie: 0, loss: 1 };
    if (memo[total]) return memo[total];

    const odds = emptyOdds();

    DICE_DISTRIBUTION.forEach(({ roll, probability }) => {
      addWeighted(odds, compute(total + roll), probability);
    });

    memo[total] = odds;
    return odds;
  }

  return compute(playerTwoTotal);
}

export function computePlayerTwoLandingDistribution(
  playerTotal: number,
  playerTwoTotal = 0,
): LandingPoint[] {
  const memo: Record<number, Record<number, number>> = {};

  function compute(total: number): Record<number, number> {
    if (total > 21 || total === playerTotal || total > playerTotal) {
      return { [total]: 1 };
    }

    if (memo[total]) return memo[total];

    const distribution: Record<number, number> = {};

    DICE_DISTRIBUTION.forEach(({ roll, probability }) => {
      const child = compute(total + roll);

      Object.entries(child).forEach(([landingTotal, landingProbability]) => {
        distribution[Number(landingTotal)] =
          (distribution[Number(landingTotal)] ?? 0) + landingProbability * probability;
      });
    });

    memo[total] = distribution;
    return distribution;
  }

  return Object.entries(compute(playerTwoTotal))
    .map(([totalText, probability]) => {
      const total = Number(totalText);
      const result: GameResult =
        total > 21 ? 'win' : total === playerTotal ? 'tie' : 'loss';

      return {
        total,
        probability,
        probabilityPercent: probability * 100,
        result,
      };
    })
    .sort((a, b) => a.total - b.total);
}

export function computeThresholdOdds(threshold: number): OutcomeOdds {
  const memo: Record<number, OutcomeOdds> = {};
  const standAt = Math.min(21, Math.max(2, Math.round(threshold)));

  function compute(total: number): OutcomeOdds {
    if (total > 21) return { win: 0, tie: 0, loss: 1 };
    if (total === 21) return { win: 1, tie: 0, loss: 0 };
    if (total >= standAt) return computeStandOdds(total);
    if (memo[total]) return memo[total];

    const odds = emptyOdds();

    DICE_DISTRIBUTION.forEach(({ roll, probability }) => {
      addWeighted(odds, compute(total + roll), probability);
    });

    memo[total] = odds;
    return odds;
  }

  return compute(0);
}

export function playThresholdGame(threshold: number): GameResult {
  const standAt = Math.min(21, Math.max(2, Math.round(threshold)));
  let playerTotal = 0;

  while (playerTotal < standAt) {
    playerTotal += rollTwoDice().total;

    if (playerTotal > 21) return 'loss';
    if (playerTotal === 21) return 'win';
  }

  return resolvePlayerTwo(playerTotal).result;
}

function toDistributionPoints(counts: Record<number, number>, games: number) {
  return Object.entries(counts)
    .map(([value, count]) => ({
      value: Number(value),
      count,
      probability: count / games,
      probabilityPercent: (count / games) * 100,
    }))
    .sort((a, b) => a.value - b.value);
}

export function simulateThresholdGames(
  threshold: number,
  games: number,
): SimulationSummary {
  const winsAndTies = { wins: 0, ties: 0, losses: 0 };
  const totalGames = Math.min(100000, Math.max(1, Math.round(games)));
  const p1Counts: Record<number, number> = {};
  const p2Counts: Record<number, number> = {};
  const standAt = Math.min(21, Math.max(2, Math.round(threshold)));

  for (let game = 0; game < totalGames; game += 1) {
    let playerTotal = 0;
    let result: GameResult = 'loss';
    let playerTwoTotal = 0;

    while (playerTotal < standAt) {
      playerTotal += rollTwoDice().total;

      if (playerTotal > 21) {
        result = 'loss';
        p1Counts[playerTotal] = (p1Counts[playerTotal] ?? 0) + 1;
        p2Counts[0] = (p2Counts[0] ?? 0) + 1;
        break;
      }

      if (playerTotal === 21) {
        result = 'win';
        p1Counts[playerTotal] = (p1Counts[playerTotal] ?? 0) + 1;
        p2Counts[0] = (p2Counts[0] ?? 0) + 1;
        break;
      }
    }

    if (playerTotal >= standAt && playerTotal < 21) {
      const playerTwo = resolvePlayerTwo(playerTotal);
      result = playerTwo.result;
      playerTwoTotal = playerTwo.total;
      p1Counts[playerTotal] = (p1Counts[playerTotal] ?? 0) + 1;
      p2Counts[playerTwoTotal] = (p2Counts[playerTwoTotal] ?? 0) + 1;
    }

    if (result === 'win') winsAndTies.wins += 1;
    if (result === 'tie') winsAndTies.ties += 1;
    if (result === 'loss') winsAndTies.losses += 1;
  }

  return {
    games: totalGames,
    threshold: Math.min(21, Math.max(2, Math.round(threshold))),
    ...winsAndTies,
    simulated: {
      win: winsAndTies.wins / totalGames,
      tie: winsAndTies.ties / totalGames,
      loss: winsAndTies.losses / totalGames,
    },
    exact: computeThresholdOdds(threshold),
    p1Totals: toDistributionPoints(p1Counts, totalGames),
    p2Totals: toDistributionPoints(p2Counts, totalGames),
  };
}
