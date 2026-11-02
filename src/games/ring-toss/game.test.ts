import { describe, expect, it } from 'vitest';
import {
  FIELD_CENTER,
  NECK_CATCH,
  RINGS_PER_ROUND,
  bottleUnder,
  createBottles,
  createState,
  scoreForLanding,
  step,
  throwRing,
} from './game';

/** Lands every ring exactly on the aim point. */
const noWobble = () => 0;

describe('ring toss', () => {
  it('starts with a full set of rings and no score', () => {
    const state = createState();
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND);
    expect(RINGS_PER_ROUND).toBe(10);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('puts one bottle in the middle, with clear space around it', () => {
    const bottles = createBottles();
    const middle = bottles.filter((b) => b.ring === 0);
    expect(middle).toHaveLength(1);
    expect(middle[0]).toMatchObject({ x: FIELD_CENTER.x, y: FIELD_CENTER.y });
    expect(bottles.some((b) => b.ring === 1)).toBe(false);
    const others = bottles.filter((b) => b !== middle[0]);
    const nearest = Math.min(
      ...others.map((b) => Math.hypot(b.x - middle[0].x, b.y - middle[0].y)),
    );
    const spacing = Math.hypot(others[0].x - others[1].x, others[0].y - others[1].y);
    expect(nearest).toBeGreaterThan(spacing);
  });

  it('gives the middle bottle the most points', () => {
    const bottles = createBottles();
    const middle = bottles.find((b) => b.ring === 0)!;
    for (const bottle of bottles) {
      if (bottle !== middle) expect(middle.points).toBeGreaterThan(bottle.points);
    }
  });

  it('scores bottles more the nearer they are to the middle', () => {
    const bottles = createBottles();
    for (const a of bottles) {
      for (const b of bottles) {
        if (a.ring < b.ring) expect(a.points).toBeGreaterThan(b.points);
      }
    }
  });

  it('scores a ring that lands on a neck with that bottle’s points', () => {
    const bottles = createBottles();
    const edge = bottles.find((b) => b.ring === 3)!;
    expect(scoreForLanding(bottles, edge.x + NECK_CATCH - 1, edge.y)).toBe(edge.points);
  });

  it('scores nothing for a ring that misses every neck', () => {
    const bottles = createBottles();
    // Halfway between the middle bottle and the ring of bottles around it.
    const x = FIELD_CENTER.x + 50;
    expect(bottleUnder(bottles, x, FIELD_CENTER.y)).toBeUndefined();
    expect(scoreForLanding(bottles, x, FIELD_CENTER.y)).toBe(0);
    expect(scoreForLanding(bottles, 5, 480)).toBe(0);
  });

  it('adds a landed ring to the score', () => {
    const state = createState();
    throwRing(state, FIELD_CENTER.x, FIELD_CENTER.y, noWobble);
    step(state, 1);
    expect(state.score).toBe(createBottles().find((b) => b.ring === 0)!.points);
  });

  it('ends the round after exactly 10 rings', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) {
      expect(throwRing(state, 0, 0, noWobble)).toBe(true);
      step(state, 1);
      expect(state.phase).toBe('playing');
    }
    expect(throwRing(state, 0, 0, noWobble)).toBe(true);
    step(state, 1);
    expect(state.phase).toBe('over');
    expect(throwRing(state, 0, 0, noWobble)).toBe(false);
    expect(state.landed).toHaveLength(RINGS_PER_ROUND);
  });

  it('keeps playing while the last ring is still in the air', () => {
    const state = createState();
    state.ringsLeft = 1;
    throwRing(state, 0, 0, noWobble);
    step(state, 0.1);
    expect(state.phase).toBe('playing');
  });
});
