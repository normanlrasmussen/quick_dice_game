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
