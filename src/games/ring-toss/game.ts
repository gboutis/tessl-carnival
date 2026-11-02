import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 10;
/** The field is a square grid of this many columns and rows. */
export const GRID_SIZE = 7;
export const CELL = { width: 56, height: 40 } as const;
export const FIELD_CENTER = { x: WIDTH / 2, y: 200 } as const;
/** A ring lands on a neck when it comes down within this many pixels of it. */
export const NECK_CATCH = 11;
/** How far from the aim point a ring can wobble when it lands. */
export const WOBBLE = 20;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 30 } as const;
const FLIGHT_TIME = 0.5;

/** Points by ring of the field: 0 is the lone middle bottle, 3 the outer edge. */
export const POINTS_BY_RING: Record<number, number> = { 0: 100, 2: 25, 3: 10 };

export interface Bottle {
  x: number;
  y: number;
  /** How many rings of the field out from the middle: 0 is the middle bottle. */
  ring: number;
  points: number;
}

export interface Ring {
  /** Where the ring will come down. */
  x: number;
  y: number;
  /** Seconds since it was thrown. */
  age: number;
}

export interface Landed {
  x: number;
  y: number;
  points: number;
}

export interface RingTossState {
  bottles: Bottle[];
  flying: Ring[];
  landed: Landed[];
  ringsLeft: number;
  score: number;
  phase: 'playing' | 'over';
}

/** How many rings of the grid a cell is from the middle (Chebyshev distance). */
export function ringOf(column: number, row: number): number {
  const middle = (GRID_SIZE - 1) / 2;
  return Math.max(Math.abs(column - middle), Math.abs(row - middle));
}

export function pointsForRing(ring: number): number {
  return POINTS_BY_RING[ring] ?? 0;
}

/**
 * The bottles: a 7 by 7 grid with the ring round the middle left empty, so the
 * middle bottle stands on its own with clear space around it.
 */
export function createBottles(): Bottle[] {
  const middle = (GRID_SIZE - 1) / 2;
  const bottles: Bottle[] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let column = 0; column < GRID_SIZE; column++) {
      const ring = ringOf(column, row);
      if (ring === 1) continue;
      bottles.push({
        x: FIELD_CENTER.x + (column - middle) * CELL.width,
        y: FIELD_CENTER.y + (row - middle) * CELL.height,
        ring,
        points: pointsForRing(ring),
      });
    }
  }
  return bottles;
}

export function createState(): RingTossState {
  return {
    bottles: createBottles(),
    flying: [],
    landed: [],
    ringsLeft: RINGS_PER_ROUND,
    score: 0,
    phase: 'playing',
  };
}

/** The bottle whose neck the ring lands on, or undefined for a miss. */
export function bottleUnder(bottles: readonly Bottle[], x: number, y: number): Bottle | undefined {
  return bottles.find((bottle) => Math.hypot(x - bottle.x, y - bottle.y) <= NECK_CATCH);
}

/** Points a ring landing at (x, y) scores: the bottle's points, or 0 for a miss. */
export function scoreForLanding(bottles: readonly Bottle[], x: number, y: number): number {
  return bottleUnder(bottles, x, y)?.points ?? 0;
}

/**
 * Throws one ring at the aim point. It comes down up to `WOBBLE` pixels away,
 * picked by `random`. Returns false if no ring was thrown.
 */
export function throwRing(
  state: RingTossState,
  aimX: number,
  aimY: number,
  random: () => number = Math.random,
): boolean {
  if (state.phase !== 'playing' || state.ringsLeft === 0) return false;
  const angle = random() * Math.PI * 2;
  const distance = random() * WOBBLE;
  state.flying.push({
    x: aimX + Math.cos(angle) * distance,
    y: aimY + Math.sin(angle) * distance,
    age: 0,
  });
  state.ringsLeft -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  const flying: Ring[] = [];
  for (const ring of state.flying) {
    ring.age += dt;
    if (ring.age >= FLIGHT_TIME) {
      const points = scoreForLanding(state.bottles, ring.x, ring.y);
      state.score += points;
      state.landed.push({ x: ring.x, y: ring.y, points });
    } else {
      flying.push(ring);
    }
  }
  state.flying = flying;

  if (state.ringsLeft === 0 && state.flying.length === 0) state.phase = 'over';
}

function ringColor(ring: number): string {
  if (ring === 0) return theme.colors.accent;
  if (ring === 2) return theme.colors.water;
  return theme.colors.muted;
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.strokeStyle = theme.colors.stripeA;
  ctx.lineWidth = 4 * scale;
  ctx.beginPath();
  ctx.ellipse(x, y, 14 * scale, 8 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The table the bottles stand on.
  const half = GRID_SIZE / 2;
  ctx.fillStyle = colors.wood;
  ctx.fillRect(
    FIELD_CENTER.x - half * CELL.width,
    FIELD_CENTER.y - half * CELL.height,
    GRID_SIZE * CELL.width,
    GRID_SIZE * CELL.height,
  );

  // Each bottle seen from above, coloured and numbered by its points.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = canvasFont('small', 'bold');
  for (const bottle of state.bottles) {
    ctx.fillStyle = ringColor(bottle.ring);
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.surface;
    ctx.fillText(String(bottle.points), bottle.x, bottle.y);
  }
  ctx.textBaseline = 'alphabetic';

  for (const ring of state.landed) drawRing(ctx, ring.x, ring.y, 1);

  // Rings in the air shrink from the thrower's hand towards where they land.
  for (const ring of state.flying) {
    const t = Math.min(ring.age / FLIGHT_TIME, 1);
    const x = THROWER.x + (ring.x - THROWER.x) * t;
    const y = THROWER.y + (ring.y - THROWER.y) * t - Math.sin(t * Math.PI) * 80;
    drawRing(ctx, x, y, 1.6 - 0.6 * t);
  }

  if (state.phase === 'playing') {
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, WOBBLE, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aim.x - 6, aim.y);
    ctx.lineTo(aim.x + 6, aim.y);
    ctx.moveTo(aim.x, aim.y - 6);
    ctx.lineTo(aim.x, aim.y + 6);
    ctx.stroke();
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.ringsLeft}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Land 10 rings on the bottle necks. The nearer the middle, the more they score.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: FIELD_CENTER.x, y: FIELD_CENTER.y };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        throwRing(state, aim.x, aim.y);
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
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
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

export default ringToss;
