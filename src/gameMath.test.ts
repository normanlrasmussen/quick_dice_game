import { describe, expect, it } from 'vitest';
import {
  computePlayerTwoChaseOdds,
  computePlayerTwoLandingDistribution,
  computeThresholdOdds,
  computeStandOdds,
  oddsSum,
  POLICY,
  stateForTotal,
} from './gameMath';

const closeToOne = (value: number) => expect(value).toBeCloseTo(1, 10);

describe('dice dynamic programming policy', () => {
  it('matches the notebook win-max decision threshold', () => {
    for (let total = 0; total <= 15; total += 1) {
      expect(POLICY[total].decision).toBe('roll');
    }

    for (let total = 16; total <= 20; total += 1) {
      expect(POLICY[total].decision).toBe('stand');
    }

    expect(POLICY[21].decision).toBe('win');
  });

  it('treats bust states as losses', () => {
    expect(stateForTotal(22).optimal).toEqual({ win: 0, tie: 0, loss: 1 });
    expect(stateForTotal(33).decision).toBe('bust');
  });

  it('keeps stand odds normalized', () => {
    for (let total = 0; total <= 21; total += 1) {
      closeToOne(oddsSum(computeStandOdds(total)));
    }
  });

  it('keeps roll odds normalized for playable totals', () => {
    for (let total = 0; total <= 20; total += 1) {
      closeToOne(oddsSum(POLICY[total].roll));
    }
  });

  it('keeps threshold strategy odds normalized', () => {
    for (let threshold = 2; threshold <= 21; threshold += 1) {
      closeToOne(oddsSum(computeThresholdOdds(threshold)));
    }
  });

  it('computes deterministic player two chase odds from revealed totals', () => {
    expect(computePlayerTwoChaseOdds(16, 16)).toEqual({ win: 0, tie: 1, loss: 0 });
    expect(computePlayerTwoChaseOdds(16, 17)).toEqual({ win: 0, tie: 0, loss: 1 });
    expect(computePlayerTwoChaseOdds(16, 22)).toEqual({ win: 1, tie: 0, loss: 0 });
    closeToOne(oddsSum(computePlayerTwoChaseOdds(16, 8)));
  });

  it('keeps player two landing distributions normalized', () => {
    const distribution = computePlayerTwoLandingDistribution(16);
    const totalProbability = distribution.reduce((sum, row) => sum + row.probability, 0);

    closeToOne(totalProbability);
  });
});
