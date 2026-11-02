# Ring Toss

Throw 10 rings at the field of bottles. The nearer the middle a bottle stands,
the more it scores.

## How to play

- Move the mouse to aim. The circle around the crosshair shows where the ring can
  come down: a ring wobbles up to 20 px from where you aim.
- Click to throw a ring. A ring that comes down within 11 px of a bottle's neck
  lands on it.
- A round is 10 rings. It ends when the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

The bottles stand in a 7 by 7 grid. The ring of spaces around the middle is
empty, so the middle bottle stands on its own. Each bottle shows its points and
is coloured by them:

| Bottles             | Colour | Points |
| ------------------- | ------ | ------ |
| The lone middle one | Gold   | 100    |
| The ring around it  | Blue   | 25     |
| The outer edge      | Lilac  | 10     |

A ring that misses every neck scores nothing. Your score is the total of all 10
rings, and it is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createBottles`, `createState`, `throwRing`, `step`,
  `bottleUnder`, `scoreForLanding`) and the `ringToss` entry, the default export
  the midway finds.
- `game.test.ts`: tests for the game logic.
