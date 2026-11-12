# Tilefall

An original tile-clearing game, written to be tested. Click a group of two or more touching
tiles of one colour; it clears, the tiles above fall, and empty columns close to the left. The
game publishes everything it believes on `window.dataLayer`, and
[Bombadil](https://github.com/antithesishq/bombadil) checks six laws over it while exploring the
page at random. Four faults can be planted from the URL, and each must be caught.

Licensed GPL-3.0-or-later (see `LICENSE`).

## Rules

- 8 x 10 board, 3 colours, seeded from `?seed=` (Park-Miller), so a board can be replayed.
- A group is tiles of one colour joined up, down, left or right. Clicking a tile in a group of
  2 or more clears the group; the board settles 120 ms later.
- Score rises by n(n-1) for n tiles cleared.
- The game is over exactly when no group of 2 or more remains; "New game" starts the next seed.

## The page's record

Every move pushes a `state` entry: `{seq, game, settled, board, score, last: {n, gain}, over}`.
`board` is the rows top to bottom, one string each, `.` for empty and `0`-`2` for a colour.
The clearing frame is pushed with `settled: false`, the result with `settled: true`.

## Laws (`spec/tilefall.spec.ts`)

| law | checked on | holds when |
|---|---|---|
| `gravity` | every settled board | in each column, empty cells only above tiles |
| `columnsClosed` | every settled board | no empty column left of a non-empty one |
| `overIffNoGroups` | every settled board | `over` exactly when no two adjacent tiles share a colour |
| `scoreIsNTimesNMinus1` | consecutive settled states of one game | the score rose by n(n-1) |
| `scoreNeverFalls` | same | the score did not fall |
| `onlyTheGroupRemoved` | same | exactly n tiles left, all of one colour |

The clearing frame is exempt from the board laws: a gap mid-animation is the design.

## Run it

```sh
gmake deps        # Bombadil 0.7.10
gmake serve       # in one shell: http://127.0.0.1:8726/
gmake test        # clean run, 60 s: must stay green
gmake faults      # each planted fault until its first violation: every one must be caught
```

## Planted faults (`?fault=`)

| fault | what breaks | caught by (2026-11-12, seed 26) |
|---|---|---|
| `gravity-skips-col` | column 3 does not fall | `gravity`, state 9 |
| `score-off-by-one` | gain is (n-1)(n-2) | `scoreIsNTimesNMinus1`, state 9 |
| `close-overshoot` | closing an empty column also drops its neighbour | `onlyTheGroupRemoved`, state 73 |
| `never-over` | game over is never declared | `overIffNoGroups`, state 51 |

The clean run on the same day: 610 states, 175 settled boards, 11 games (10 played to the end),
best score 718, no violations.

Two things the first runs taught:

- `close-overshoot` was predicted to break `columnsClosed`, but dropping a whole column keeps the
  columns closed. What breaks is conservation: tiles vanish that were not in the group.
- `never-over` survived a 45 s run while "New game" could be clicked at any time: the explorer
  restarted 64 games and only one reached "over", so the law had nothing to check. Offering
  "New game" only once a game is over let 10 of 11 games play out, and the fault was caught. A
  green law is only as good as what it was given to check.
