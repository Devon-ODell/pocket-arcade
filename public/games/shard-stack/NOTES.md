# Shard Stack development notes

## 2026-09-26 — Standard pieces (version 0.2.3)

The requested piece set is now exactly I, O, T, S, Z, J and L, with four
cells each and one of each per seeded seven-piece bag. This supersedes the
custom-shape requirements in the original M1 brief and historical notes below.
The 8x15 well, crystal art, scoring, preview and stash are retained. Rotation
kicks cover the four-cell I at the right wall and floor. Geometry, bags, kicks,
clears, stash and randomized collision checks are covered by the rule tests.

## 2026-09-25 — M1a core rescue (version 0.2.0)

**Question:** can the brief's six-piece, 8x15 core obey its collision, bag and
lock rules, replay identically after a JSON save, and finish all 20 seeded runs?
Result: yes. `python3 -m studio.pipeline games/shard-stack` passes; the harness
reports deterministic and resumable runs and exercises render without mutation.
`python3 -m unittest discover -s tests -t . -q`: 97 tests pass.

This follows CMS.608 session 3 part 1, transcript pp. 10–11: state a falsifiable
question and success criteria, playtest, then revise. Local source:
`/Users/devonodell/Desktop/college/MIT OCW Courses/agent-skills/mit-cms-608-game-design/references/documents/ym5m-equnmu-transcript.md`.
The numerical timings and board rules come from our brief, not the course.

Changes: 8 columns, 15 rows, 36px cells; I3/L3/P5/U5/T5/S5; one of each per
seeded shuffled bag; one row/second gravity, 4x soft drop; 30-tick lock delay,
eight grounded movement/rotation resets; horizontal kicks then one-row-up kick;
100/300/600/1000 base clear scores with a consecutive-clear bonus. One endless
depth, ending at spawn obstruction. Removed the placeholder's forced win at 15
rows and its three-depth claim. Landing hints are floor strokes, not ghost pieces.
The existing preview and stash remain playable; the deterministic greedy bot is
an explicit baseline for M1b, not the finished casual-player proxy.

Measured with manifest seed 1, 20 runs, max_ticks 40000:

| metric | old placeholder | new M1a core |
|---|---:|---:|
| completion_rate | 1 | 1 |
| mean_score | 2869.6 | 1662.5 |
| mean_rows | 14.9 | 13.3 |
| p50_seconds | 12.6667 | 8.0417 |
| mean_pieces | 42.7 | 41.35 |

These are different rules and scoring systems, not a like-for-like difficulty
comparison. Existing manifest targets are retained, including completion [1,1].
They prove the core works; they do **not** certify all M1 requirements.

### Exact handoff to M1b and M1c

- Core is implemented. Read this file, `game.js`, the brief's bot paragraph and
  `tests/test_shard_stack.py`; start from the current core rather than rebuilding.
- M1b: extend `plan` to enumerate current and stashed pieces, deduplicate equal
  geometric placements, then implement the specified 60/30/10 choice, 4% misdrop,
  6–14-tick reaction, and input pacing. Keep planning state and RNG in JSON state.
  Add a keyboard stash gesture supported by the existing shell input contract.
  Touch stash and preview already exist. Improve planning and measure it; do not
  insert artificial waits or forced losses just to hit a duration target.
- M1c: add p50_seconds [60,600] and mean_rows [15,200] only after M1b meets them.
  Keep the stronger existing completion_rate [1,1] and mean_score target.
  Current median 8.04s / mean 13.3 rows do not meet full M1. Do not claim otherwise
  or reapply obsolete placeholder targets p50 [8,19] / p90 [9,22].
- Rule tests already cover bags, kicks, scoring, simultaneous/separated clears,
  lock delay/reset cap, spawn obstruction, stash/preview and mid-lock resume.
  Extend them for new behavior; the old 180-cell regression fixture was updated
  to 120 cells while retaining both its clear-count and shifted-cell assertions.
- M1b must depend on M1a landing; M1c must depend on M1b. A retry delay is not
  permission to run a later task against the old game.

### Source study

Studied Jake Gordon's `eachblock`, `occupied`, `drop`, and `removeLines` in
[index.html](https://github.com/jakesgordon/javascript-tetris/blob/master/index.html).
Useful principle: collision and drawing share the same cell geometry; locking
and clearing adjacent rows are one transaction. Our code independently uses
cell-coordinate arrays and a flat board, not the upstream bitmask implementation.
No upstream code or assets were copied. Its four-of-each piece pool is not our
one-of-each seeded bag. The earlier local clear-row algorithm was retained with
the corrected board dimensions.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
