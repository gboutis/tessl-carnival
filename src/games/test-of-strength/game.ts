import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const SWINGS_PER_ROUND = 3;
/** Seconds the marker takes to sweep each timing indicator. */
export const MOMENT_DURATION = 1.4;
/** Where on the indicator (0 to 1) the perfect moment sits. */
export const PERFECT_AT = 0.7;
/** Half the width of the perfect zone, on the same 0 to 1 scale. */
export const PERFECT_ZONE = 0.04;
/** Half the width of the good zone. */
export const GOOD_ZONE = 0.12;
/** How far from the perfect zone a press can land before it has no power. */
export const MISS_DISTANCE = 0.6;
/** Seconds the puck spends flying up the tower and back down. */
export const FLIGHT_DURATION = 1.6;
/** The most a swing can score without ringing the bell. */
export const POWER_POINTS = 90;
/** Extra points for ringing the bell. */
export const BELL_BONUS = 10;

export type PressLabel = 'Perfect!' | 'Good' | 'Early' | 'Late';

export interface Press {
  /** Where the marker was on the indicator, 0 to 1. */
  progress: number;
  /** 1 for a perfect press, down to 0 for a press with no power. */
  accuracy: number;
  label: PressLabel;
}

export interface Swing {
  top: Press;
  strike: Press;
  /** How high the puck goes, 0 (the pad) to 1 (the bell). */
  power: number;
  bell: boolean;
  score: number;
}

export interface TestOfStrengthState {
  /** `rising` waits for the top press, `falling` for the strike, `flying` shows the puck. */
  phase: 'rising' | 'falling' | 'flying' | 'over';
  /** Seconds since the current phase began. */
  elapsed: number;
  top: Press | null;
  swings: Swing[];
  score: number;
}

export function createState(): TestOfStrengthState {
  return { phase: 'rising', elapsed: 0, top: null, swings: [], score: 0 };
}

/** Where the marker is on the current timing indicator, 0 to 1. */
export function timingProgress(state: TestOfStrengthState): number {
  return Math.min(state.elapsed / MOMENT_DURATION, 1);
}

/** How well a press at `progress` was timed: 1 inside the perfect zone, falling to 0. */
export function accuracyFor(progress: number): number {
  const distance = Math.abs(progress - PERFECT_AT);
  if (distance <= PERFECT_ZONE) return 1;
  return Math.max(0, 1 - (distance - PERFECT_ZONE) / MISS_DISTANCE);
}

export function labelFor(progress: number): PressLabel {
  const distance = Math.abs(progress - PERFECT_AT);
  if (distance <= PERFECT_ZONE) return 'Perfect!';
  if (distance <= GOOD_ZONE) return 'Good';
  return progress < PERFECT_AT ? 'Early' : 'Late';
}

export function pressAt(progress: number): Press {
  return { progress, accuracy: accuracyFor(progress), label: labelFor(progress) };
}

/** Scores a swing from its two presses. Two perfect presses ring the bell. */
export function scoreSwing(top: Press, strike: Press): Swing {
  const bell = top.accuracy === 1 && strike.accuracy === 1;
  const power = (top.accuracy + strike.accuracy) / 2;
  const score = bell ? POWER_POINTS + BELL_BONUS : Math.round(power * POWER_POINTS);
  return { top, strike, power, bell, score };
}

function finishMoment(state: TestOfStrengthState, press: Press) {
  if (state.phase === 'rising') {
    state.top = press;
    state.phase = 'falling';
  } else if (state.top) {
    const swing = scoreSwing(state.top, press);
    state.swings.push(swing);
    state.score += swing.score;
    state.top = null;
    state.phase = 'flying';
  }
  state.elapsed = 0;
}

/** The player's press. Returns false if the press did nothing. */
export function press(state: TestOfStrengthState): boolean {
  if (state.phase !== 'rising' && state.phase !== 'falling') return false;
  finishMoment(state, pressAt(timingProgress(state)));
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: TestOfStrengthState, dt: number): void {
  if (state.phase === 'over') return;
  state.elapsed += dt;
  if (state.phase === 'flying') {
    if (state.elapsed >= FLIGHT_DURATION) {
      state.elapsed = 0;
      state.phase = state.swings.length >= SWINGS_PER_ROUND ? 'over' : 'rising';
    }
  } else if (state.elapsed >= MOMENT_DURATION) {
    // No press before the marker reached the end: as late as a press can be.
    finishMoment(state, pressAt(1));
  }
}

/** How high the puck is, 0 (the pad) to 1 (the bell). */
export function puckHeight(state: TestOfStrengthState): number {
  const swing = state.swings[state.swings.length - 1];
  if (state.phase !== 'flying' || !swing) return 0;
  const t = state.elapsed / FLIGHT_DURATION;
  // Up for the first half, a short rest at the top, then back down.
  const rise = t < 0.45 ? Math.sin((t / 0.45) * (Math.PI / 2)) : t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
  return swing.power * Math.max(0, rise);
}

/** How raised the hammer is, 0 (on the pad) to 1 (the top of the swing). */
function hammerLift(state: TestOfStrengthState): number {
  const progress = timingProgress(state);
  if (state.phase === 'rising') {
    if (progress <= PERFECT_AT) return progress / PERFECT_AT;
    // Past the top, the hammer starts to sag.
    return 1 - ((progress - PERFECT_AT) / (1 - PERFECT_AT)) * 0.3;
  }
  if (state.phase === 'falling') return 1 - Math.min(progress / PERFECT_AT, 1);
  return 0;
}

const TOWER = { x: 560, top: 70, bottom: 420, width: 36 } as const;
const PAD = { x: TOWER.x - 90, y: 430, width: 70, height: 12 } as const;
const PIVOT = { x: 300, y: 380 } as const;
const HANDLE = Math.hypot(PAD.x + PAD.width / 2 - PIVOT.x, PAD.y - PIVOT.y);
const INDICATOR = { x: 40, width: 300, height: 18 } as const;

function drawIndicator(
  ctx: CanvasRenderingContext2D,
  y: number,
  title: string,
  progress: number | null,
  result: Press | null,
) {
  const { colors } = theme;
  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(title, INDICATOR.x, y - 8);

  ctx.fillStyle = colors.surface;
  ctx.fillRect(INDICATOR.x, y, INDICATOR.width, INDICATOR.height);
  ctx.fillStyle = colors.muted;
  ctx.fillRect(
    INDICATOR.x + (PERFECT_AT - GOOD_ZONE) * INDICATOR.width,
    y,
    GOOD_ZONE * 2 * INDICATOR.width,
    INDICATOR.height,
  );
  ctx.fillStyle = colors.accent;
  ctx.fillRect(
    INDICATOR.x + (PERFECT_AT - PERFECT_ZONE) * INDICATOR.width,
    y,
    PERFECT_ZONE * 2 * INDICATOR.width,
    INDICATOR.height,
  );

  const marker = result ? result.progress : progress;
  if (marker !== null) {
    ctx.fillStyle = colors.danger;
    ctx.fillRect(INDICATOR.x + marker * INDICATOR.width - 2, y - 4, 4, INDICATOR.height + 8);
  }
  if (result) {
    ctx.fillStyle = result.accuracy === 1 ? colors.accent : colors.text;
    ctx.font = canvasFont('body', 'bold');
    ctx.fillText(result.label, INDICATOR.x + INDICATOR.width + 14, y + INDICATOR.height - 2);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: TestOfStrengthState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Floor.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, PAD.y + PAD.height, WIDTH, HEIGHT - PAD.y - PAD.height);

  // The tower, with its scale.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(TOWER.x - TOWER.width / 2, TOWER.top, TOWER.width, TOWER.bottom - TOWER.top);
  ctx.fillStyle = colors.stripeB;
  for (let i = 1; i < 10; i++) {
    const y = TOWER.bottom - ((TOWER.bottom - TOWER.top) * i) / 10;
    ctx.fillRect(TOWER.x - TOWER.width / 2, y, i % 5 === 0 ? 14 : 8, 2);
  }

  // The bell, which glows when it rings.
  const swing = state.swings[state.swings.length - 1];
  const ringing = state.phase === 'flying' && swing?.bell && puckHeight(state) > 0.98;
  ctx.fillStyle = ringing ? colors.stripeB : colors.accent;
  ctx.beginPath();
  ctx.arc(TOWER.x, TOWER.top - 4, 24, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(TOWER.x - 28, TOWER.top - 6, 56, 8);
  if (ringing) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    for (const r of [34, 46]) {
      ctx.beginPath();
      ctx.arc(TOWER.x, TOWER.top - 10, r, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  }

  // The puck.
  const travel = TOWER.bottom - TOWER.top - 16;
  ctx.fillStyle = colors.danger;
  ctx.fillRect(TOWER.x - 14, TOWER.bottom - 16 - puckHeight(state) * travel, 28, 16);

  // The strike pad, joined to the tower.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(PAD.x + PAD.width, PAD.y + 4, TOWER.x - PAD.x - PAD.width, 4);
  ctx.fillStyle = colors.danger;
  ctx.fillRect(PAD.x, PAD.y, PAD.width, PAD.height);

  // The hammer: down on the pad at lift 0, straight up at lift 1.
  const restAngle = Math.atan2(PAD.y - PIVOT.y, PAD.x + PAD.width / 2 - PIVOT.x);
  const angle = restAngle + (-Math.PI / 2 - restAngle) * hammerLift(state);
  ctx.save();
  ctx.translate(PIVOT.x, PIVOT.y);
  ctx.rotate(angle);
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, -4, HANDLE - 10, 8);
  ctx.fillStyle = colors.muted;
  ctx.fillRect(HANDLE - 22, -20, 28, 40);
  ctx.restore();
  ctx.fillStyle = colors.text;
  ctx.beginPath();
  ctx.arc(PIVOT.x, PIVOT.y, 10, 0, Math.PI * 2);
  ctx.fill();

  // The timing indicators.
  const progress = timingProgress(state);
  const top = state.phase === 'rising' ? null : state.phase === 'falling' ? state.top : swing?.top;
  const strike = state.phase === 'flying' || state.phase === 'over' ? swing?.strike : null;
  drawIndicator(
    ctx,
    90,
    'Top of the swing',
    state.phase === 'rising' ? progress : null,
    top ?? null,
  );
  drawIndicator(ctx, 150, 'Strike', state.phase === 'falling' ? progress : null, strike ?? null);

  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.textAlign = 'left';
  ctx.fillText('Click, Space or Enter when the marker is in the gold zone', INDICATOR.x, 200);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  const swingNumber = Math.min(state.swings.length + (state.phase === 'flying' ? 0 : 1), 3);
  ctx.fillText(`Swing ${swingNumber}/${SWINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Round over! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const testOfStrength: CarnivalGame = {
  id: 'test-of-strength',
  name: 'Test of Strength',
  description: 'Time the top of your swing and the strike to send the puck up and ring the bell.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const act = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        press(state);
      }
    };
    const onDown = () => act();
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      if (!event.repeat) act();
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip a whole swing.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(testOfStrength.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  },
};

export default testOfStrength;
