# Test of Strength

Swing the hammer down onto the pad at the foot of the tower and send the puck up
towards the bell. Timing counts, not button mashing.

## How to play

Each swing has two timed presses. Press with a click, Space or Enter. Each press
has its own timing indicator on the left, with a marker that sweeps across it. The
gold band is the perfect zone and the lighter band around it is good.

1. **The top of the swing.** The hammer rises. Press as it reaches the very top,
   when the marker is in the gold zone, to start the downswing. If you wait too
   long, the hammer sags and the press counts as late.
2. **The strike.** The hammer falls towards the pad. Press as it meets the pad,
   when the marker is in the gold zone.

After each press, the indicator says how it landed: "Perfect!", "Good", "Early" or
"Late". If you don't press before the marker reaches the end, the press is late
and has no power.

A round is three swings. Click or press Space on the round over screen to play
again.

## Scoring

Each press has an accuracy: 1 inside the perfect zone, falling evenly to 0 the
further the marker is from it. The swing's power is the average of its two
accuracies, and sends the puck that far up the tower.

- A swing scores its power times 90, rounded, so up to 90 points.
- Two perfect presses ring the bell, for 90 points plus a 10 point bonus: 100,
  the most a swing can score.
- Your score is the total of the three swings, and is saved to the carnival's
  score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `press`, `step`, `pressAt`,
  `scoreSwing`) and the `testOfStrength` entry, the default export the midway
  finds.
- `game.test.ts`: tests for the game logic.
