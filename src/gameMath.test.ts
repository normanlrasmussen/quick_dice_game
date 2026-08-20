import { describe, expect, it } from 'vitest';
import {
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
});
