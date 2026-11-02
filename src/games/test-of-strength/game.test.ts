import { describe, expect, it } from 'vitest';
import {
  BELL_BONUS,
  FLIGHT_DURATION,
  MOMENT_DURATION,
  PERFECT_AT,
  PERFECT_ZONE,
  POWER_POINTS,
  SWINGS_PER_ROUND,
  createState,
  labelFor,
  press,
  pressAt,
  puckHeight,
  scoreSwing,
  step,
  type TestOfStrengthState,
} from './game';

const perfect = PERFECT_AT * MOMENT_DURATION;

/** Plays one swing, pressing `topAt` and `strikeAt` seconds into each moment. */
function swing(state: TestOfStrengthState, topAt = perfect, strikeAt = perfect) {
  step(state, topAt);
  press(state);
  step(state, strikeAt);
  press(state);
  step(state, FLIGHT_DURATION);
}

describe('test of strength', () => {
  it('starts waiting for the top of the first swing, with no score', () => {
    const state = createState();
    expect(state.phase).toBe('rising');
    expect(state.score).toBe(0);
    expect(state.swings).toHaveLength(0);
  });

  it('moves from the top press to the strike, then sends the puck up', () => {
    const state = createState();
    step(state, perfect);
    press(state);
    expect(state.phase).toBe('falling');
    step(state, perfect);
    press(state);
    expect(state.phase).toBe('flying');
    step(state, FLIGHT_DURATION / 2);
    expect(puckHeight(state)).toBeGreaterThan(0);
  });

  it('rings the bell and scores the most with two perfect presses', () => {
    const best = scoreSwing(pressAt(PERFECT_AT), pressAt(PERFECT_AT));
    expect(best.bell).toBe(true);
    expect(best.power).toBe(1);
    expect(best.score).toBe(POWER_POINTS + BELL_BONUS);

    for (const top of [0, 0.3, 0.6, 0.7, 0.8, 1]) {
      for (const strike of [0, 0.3, 0.6, 0.7, 0.8, 1]) {
        if (top === PERFECT_AT && strike === PERFECT_AT) continue;
        expect(scoreSwing(pressAt(top), pressAt(strike)).score).toBeLessThan(best.score);
      }
    }
  });

  it('does not ring the bell unless both presses are perfect', () => {
    expect(scoreSwing(pressAt(PERFECT_AT), pressAt(PERFECT_AT + 0.1)).bell).toBe(false);
    expect(scoreSwing(pressAt(PERFECT_AT - 0.1), pressAt(PERFECT_AT)).bell).toBe(false);
  });

  it('scores less for a press further from its perfect moment, on either press', () => {
    const offsets = [PERFECT_ZONE + 0.01, 0.1, 0.2, 0.3, 0.4];
    for (const direction of [-1, 1]) {
      const tops = offsets.map(
        (d) => scoreSwing(pressAt(PERFECT_AT + direction * d), pressAt(PERFECT_AT)).score,
      );
      const strikes = offsets.map(
        (d) => scoreSwing(pressAt(PERFECT_AT), pressAt(PERFECT_AT + direction * d)).score,
      );
      for (const scores of [tops, strikes]) {
        for (let i = 1; i < scores.length; i++) {
          expect(scores[i]).toBeLessThan(scores[i - 1]);
        }
      }
    }
  });

  it('says how each press landed', () => {
    expect(labelFor(PERFECT_AT)).toBe('Perfect!');
    expect(labelFor(PERFECT_AT + 0.08)).toBe('Good');
    expect(labelFor(0.2)).toBe('Early');
    expect(labelFor(0.95)).toBe('Late');
  });

  it('counts a missed press as late, with no power', () => {
    const state = createState();
    step(state, MOMENT_DURATION);
    expect(state.phase).toBe('falling');
    expect(state.top?.label).toBe('Late');
  });

  it('ends the round after three swings, with the total of the swings', () => {
    const state = createState();
    swing(state);
    swing(state, perfect * 0.5);
    expect(state.phase).toBe('rising');
    swing(state, perfect, perfect * 1.2);
    expect(state.swings).toHaveLength(SWINGS_PER_ROUND);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(state.swings.reduce((total, s) => total + s.score, 0));
  });

  it('ignores presses once the round is over, or while the puck is flying', () => {
    const state = createState();
    step(state, perfect);
    press(state);
    step(state, perfect);
    press(state);
    expect(press(state)).toBe(false);
    for (let i = 0; i < SWINGS_PER_ROUND; i++) swing(state);
    expect(state.phase).toBe('over');
    expect(press(state)).toBe(false);
  });
});
