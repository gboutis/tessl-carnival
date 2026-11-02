import { describe, expect, it } from 'vitest';
import {
  BALLS_PER_ROUND,
  BOTTLE_COUNT,
  BOTTLE_HEIGHT,
  CLEAR_BONUS,
  FLIGHT_TIME,
  ONE_THROW_BONUS,
  createState,
  knockedBy,
  scoreFor,
  step,
  supportsOf,
  throwBall,
  type BottleKnockdownState,
} from './game';

function bottom(state: BottleKnockdownState, col: number) {
  return state.bottles.find((b) => b.row === 0 && b.col === col)!;
}

/** Throws at (x, y) and lets the ball land. */
function throwAndLand(state: BottleKnockdownState, x: number, y: number) {
  throwBall(state, x, y);
  step(state, FLIGHT_TIME);
}

describe('bottle knockdown', () => {
  it('starts with six bottles standing in a 3, 2, 1 pyramid', () => {
    const state = createState();
    expect(state.bottles).toHaveLength(BOTTLE_COUNT);
    expect(state.bottles.every((b) => b.up)).toBe(true);
    expect([0, 1, 2].map((row) => state.bottles.filter((b) => b.row === row).length)).toEqual([
      3, 2, 1,
    ]);
    expect(state.balls).toBe(BALLS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('clears all six with a perfect throw, low and in the middle of the bottom row', () => {
    const state = createState();
    const middle = bottom(state, 1);
    expect(knockedBy(state.bottles, middle.x, middle.y + BOTTLE_HEIGHT)).toHaveLength(6);
  });

  it('clears fewer with a weak throw high on the middle bottle', () => {
    const state = createState();
    const middle = bottom(state, 1);
    const knocked = knockedBy(state.bottles, middle.x, middle.y + 5);
    expect(knocked.length).toBeGreaterThan(0);
    expect(knocked.length).toBeLessThan(6);
  });

  it('clears fewer with a wide throw on a side bottle', () => {
    const state = createState();
    const left = bottom(state, 0);
    const knocked = knockedBy(state.bottles, left.x, left.y + BOTTLE_HEIGHT);
    expect(knocked.length).toBeLessThan(6);
    expect(knocked).not.toContain(bottom(state, 2));
  });

  it('knocks only the top bottle when the throw hits it', () => {
    const state = createState();
    const top = state.bottles.find((b) => b.row === 2)!;
    expect(knockedBy(state.bottles, top.x, top.y + BOTTLE_HEIGHT)).toEqual([top]);
  });

  it('knocks nothing on a miss', () => {
    expect(knockedBy(createState().bottles, 10, 10)).toEqual([]);
  });

  it('never leaves a bottle standing on a bottle that fell', () => {
    for (let x = 300; x <= 500; x += 4) {
      for (let y = 100; y <= 340; y += 4) {
        const state = createState();
        throwAndLand(state, x, y);
        for (const b of state.bottles.filter((b) => b.up)) {
          expect(
            supportsOf(state.bottles, b).every((s) => s.up),
            `${x},${y}`,
          ).toBe(true);
        }
      }
    }
  });

  it('keeps fallen bottles down for the rest of the round', () => {
    const state = createState();
    const top = state.bottles.find((b) => b.row === 2)!;
    throwAndLand(state, top.x, top.y + 40);
    throwAndLand(state, 10, 10);
    expect(top.up).toBe(false);
    expect(state.knocks).toEqual([1, 0]);
  });

  it('throws one ball at a time', () => {
    const state = createState();
    expect(throwBall(state, 400, 300)).toBe(true);
    expect(throwBall(state, 400, 300)).toBe(false);
    expect(state.balls).toBe(BALLS_PER_ROUND - 1);
  });

  it('ends the round when all six are down', () => {
    const state = createState();
    const middle = bottom(state, 1);
    throwAndLand(state, middle.x, middle.y + BOTTLE_HEIGHT);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(6 + ONE_THROW_BONUS);
    expect(throwBall(state, 400, 300)).toBe(false);
  });

  it('ends the round when the balls run out', () => {
    const state = createState();
    for (let i = 0; i < BALLS_PER_ROUND; i++) {
      expect(state.phase).toBe('playing');
      throwAndLand(state, 10, 10);
    }
    expect(state.phase).toBe('over');
    expect(state.score).toBe(0);
  });

  it('keeps playing while the ball is in the air', () => {
    const state = createState();
    state.balls = 1;
    throwBall(state, 10, 10);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
  });

  it('scores a point a bottle, and a smaller bonus for clearing in more than one throw', () => {
    expect(scoreFor([])).toBe(0);
    expect(scoreFor([4, 1])).toBe(5);
    expect(scoreFor([5, 1])).toBe(6 + CLEAR_BONUS);
    expect(scoreFor([6])).toBe(6 + ONE_THROW_BONUS);
  });

  it('scores all six in one throw higher than any other round', () => {
    const best = scoreFor([6]);
    const others = [[5, 1], [1, 5], [2, 2, 2], [4, 1, 1], [5], [5, 0, 0], [0, 0, 0]];
    for (const knocks of others) expect(scoreFor(knocks)).toBeLessThan(best);
  });
});
