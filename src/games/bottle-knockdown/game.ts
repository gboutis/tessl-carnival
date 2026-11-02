import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BALLS_PER_ROUND = 3;
export const BOTTLE_COUNT = 6;
export const BOTTLE_WIDTH = 46;
export const BOTTLE_HEIGHT = 80;
/** Bonus for knocking all six down with a single throw. */
export const ONE_THROW_BONUS = 20;
/** Bonus for knocking all six down with more than one throw. */
export const CLEAR_BONUS = 6;
/** How far along its row a hit at the very bottom of a bottle reaches. */
export const MAX_REACH = 70;
export const FLIGHT_TIME = 0.35;
/** How far the aim sways from side to side, in pixels. */
export const SWAY = 20;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 20 } as const;
const STAND_Y = 340;
const SPACING = 54;
const ROWS = [3, 2, 1];

export interface Bottle {
  /** 0 is the bottom row, 2 the top. */
  row: number;
  /** Position in its row, from the left. */
  col: number;
  /** Centre of the bottle. */
  x: number;
  /** Top of the bottle. */
  y: number;
  up: boolean;
  /** Seconds since it fell, for drawing. */
  fallAge: number;
}

export interface Ball {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds in the air. */
  age: number;
}

export interface BottleKnockdownState {
  bottles: Bottle[];
  ball: Ball | null;
  balls: number;
  throws: number;
  /** Bottles each finished throw knocked down. */
  knocks: number[];
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): BottleKnockdownState {
  const bottles: Bottle[] = ROWS.flatMap((count, row) =>
    Array.from({ length: count }, (_, col) => ({
      row,
      col,
      x: WIDTH / 2 + (col - (count - 1) / 2) * SPACING,
      y: STAND_Y - (row + 1) * BOTTLE_HEIGHT,
      up: true,
      fallAge: 0,
    })),
  );
  return {
    bottles,
    ball: null,
    balls: BALLS_PER_ROUND,
    throws: 0,
    knocks: [],
    score: 0,
    phase: 'playing',
  };
}

/** The standing bottle at a point, if there is one. */
export function bottleAt(bottles: readonly Bottle[], x: number, y: number): Bottle | undefined {
  return bottles.find(
    (b) => b.up && Math.abs(x - b.x) <= BOTTLE_WIDTH / 2 && y >= b.y && y <= b.y + BOTTLE_HEIGHT,
  );
}

/** The bottles a bottle stands on: the two below it, or none on the bottom row. */
export function supportsOf(bottles: readonly Bottle[], bottle: Bottle): Bottle[] {
  return bottles.filter(
    (b) => b.row === bottle.row - 1 && (b.col === bottle.col || b.col === bottle.col + 1),
  );
}

/**
 * Which standing bottles a ball hitting at (x, y) knocks down. The bottle it
 * hits falls, and so does every standing bottle in the same row whose centre is
 * within reach of the hit: the lower the hit on the bottle, the further it
 * reaches. Then every bottle that stands on a fallen bottle falls too.
 */
export function knockedBy(bottles: readonly Bottle[], x: number, y: number): Bottle[] {
  const hit = bottleAt(bottles, x, y);
  if (!hit) return [];
  const lowness = (y - hit.y) / BOTTLE_HEIGHT;
  const reach = MAX_REACH * lowness;
  const falling = new Set<Bottle>(
    bottles.filter((b) => b.up && b.row === hit.row && Math.abs(b.x - x) <= reach),
  );
  falling.add(hit);
  for (let row = hit.row + 1; row < ROWS.length; row++) {
    for (const b of bottles) {
      if (b.row === row && b.up && supportsOf(bottles, b).some((s) => falling.has(s) || !s.up)) {
        falling.add(b);
      }
    }
  }
  return bottles.filter((b) => falling.has(b));
}

/** 1 point a bottle, plus a bonus for clearing all six: a bigger one in a single throw. */
export function scoreFor(knocks: readonly number[]): number {
  const down = knocks.reduce((sum, n) => sum + n, 0);
  if (down < BOTTLE_COUNT) return down;
  return down + (knocks.some((n) => n === BOTTLE_COUNT) ? ONE_THROW_BONUS : CLEAR_BONUS);
}

/** How far the aim has swayed at `time` seconds. */
export function swayOffset(time: number): number {
  return SWAY * Math.sin(time * 2.4);
}

/** Throws a ball at (x, y). Returns false if nothing was thrown. */
export function throwBall(state: BottleKnockdownState, x: number, y: number): boolean {
  if (state.phase !== 'playing' || state.ball || state.balls === 0) return false;
  state.ball = { fromX: THROWER.x, fromY: THROWER.y, toX: x, toY: y, age: 0 };
  state.balls -= 1;
  return true;
}

/** The ball's position as it flies, ending at the point it was thrown at. */
export function ballPosition(ball: Ball): { x: number; y: number } {
  const t = Math.min(ball.age / FLIGHT_TIME, 1);
  return {
    x: ball.fromX + (ball.toX - ball.fromX) * t,
    y: ball.fromY + (ball.toY - ball.fromY) * t,
  };
}

/** Advances the game by `dt` seconds. */
export function step(state: BottleKnockdownState, dt: number): void {
  for (const b of state.bottles) if (!b.up) b.fallAge += dt;

  if (state.ball) {
    state.ball.age += dt;
    if (state.ball.age >= FLIGHT_TIME) {
      const knocked = knockedBy(state.bottles, state.ball.toX, state.ball.toY);
      for (const b of knocked) b.up = false;
      state.knocks.push(knocked.length);
      state.throws += 1;
      state.score = scoreFor(state.knocks);
      state.ball = null;
    }
  }

  const allDown = state.bottles.every((b) => !b.up);
  if (!state.ball && (allDown || state.balls === 0)) state.phase = 'over';
}

function drawBottle(ctx: CanvasRenderingContext2D, bottle: Bottle) {
  const { colors } = theme;
  const w = BOTTLE_WIDTH;
  const h = BOTTLE_HEIGHT;
  ctx.save();
  if (bottle.up) {
    ctx.translate(bottle.x, bottle.y);
  } else {
    // Topple over and drop behind the stand.
    const t = Math.min(bottle.fallAge / 0.4, 1);
    ctx.globalAlpha = 1 - t;
    ctx.translate(bottle.x, bottle.y + t * 60);
    ctx.rotate(((bottle.col % 2 === 0 ? -1 : 1) * Math.PI * t) / 2);
  }
  ctx.fillStyle = colors.stripeB;
  ctx.fillRect(-w / 2 + 4, h * 0.35, w - 8, h * 0.65);
  ctx.fillRect(-w / 6, h * 0.05, w / 3, h * 0.35);
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(-w / 2 + 4, h * 0.55, w - 8, h * 0.15);
  ctx.fillRect(-w / 6, 0, w / 3, h * 0.07);
  ctx.restore();
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: BottleKnockdownState,
  aim: { x: number; y: number },
) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The stand.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(WIDTH / 2 - 120, STAND_Y, 240, 14);
  ctx.fillRect(WIDTH / 2 - 10, STAND_Y + 14, 20, 90);

  for (const bottle of state.bottles) drawBottle(ctx, bottle);

  if (state.ball) {
    const { x, y } = ballPosition(state.ball);
    const t = Math.min(state.ball.age / FLIGHT_TIME, 1);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(x, y, 16 - 8 * t, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.phase === 'playing') {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 10, 0, Math.PI * 2);
    ctx.moveTo(aim.x - 16, aim.y);
    ctx.lineTo(aim.x + 16, aim.y);
    ctx.moveTo(aim.x, aim.y - 16);
    ctx.lineTo(aim.x, aim.y + 16);
    ctx.stroke();
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Balls ${state.balls}/${BALLS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    const down = state.bottles.filter((b) => !b.up).length;
    const oneThrow = state.knocks.includes(BOTTLE_COUNT);
    const headline = oneThrow
      ? `All six in one throw! You scored ${state.score}`
      : down === BOTTLE_COUNT
        ? `All six down! You scored ${state.score}`
        : `${down} of ${BOTTLE_COUNT} down. You scored ${state.score}`;
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(headline, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const bottleKnockdown: CarnivalGame = {
  id: 'bottle-knockdown',
  name: 'Bottle Knockdown',
  description: 'Knock the milk bottle pyramid down. All six with one throw wins big.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const pointer = { x: WIDTH / 2, y: STAND_Y - 20 };
    const aim = { ...pointer };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(pointer, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(pointer, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        throwBall(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      aim.x = pointer.x + swayOffset(time / 1000);
      aim.y = pointer.y;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(bottleKnockdown.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default bottleKnockdown;
