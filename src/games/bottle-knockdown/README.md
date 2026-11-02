# Bottle Knockdown

Six milk bottles stand in a pyramid on the stand: three on the bottom row, two
in the middle and one on top. Knock them all down with one throw.

## How to play

- Move the mouse to aim, and click to throw a ball at the crosshair.
- The crosshair sways gently from side to side, so time your throw.
- You have 3 balls, thrown one at a time. The round ends when all six bottles
  are down or your last ball has landed.
- Click again on the round over screen to play another round.

## Which bottles fall

- The bottle the ball hits falls.
- The lower you hit it, the further the hit reaches along its row and knocks
  over its neighbours. A hit low in the middle of the bottom row can bring the
  whole pyramid down. A hit high, or on a bottle at the side, knocks down fewer.
- A bottle falls when a bottle under it falls.
- Bottles that fall stay down for the rest of the round. A ball that misses
  every standing bottle knocks nothing down.

## Scoring

| What                                  | Points |
| ------------------------------------- | ------ |
| Each bottle knocked down              | 1      |
| All six down with one throw           | +20    |
| All six down with more than one throw | +6     |

So all six with one throw scores 26, the best possible round, and clearing them
over two or three throws scores 12. Your final score is saved to the carnival's
score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwBall`, `step`, `knockedBy`,
  `supportsOf`, `scoreFor`) and the `bottleKnockdown` entry, the default export
  the midway finds.
- `game.test.ts`: tests for the game logic.
