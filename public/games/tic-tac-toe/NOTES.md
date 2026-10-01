# Tic Tac Toe — change log

## 2026-09-25 — juice pass and real targets (Claude)

Tic Tac Toe. Perfect play draws, so a near-zero win rate against medium and hard is correct, not a bug.
mean_won_hard is capped at 0.15: if the player starts beating hard, the depth-9 search has broken.

Measured over 21 seeded runs with `python3 -m studio.sim games/tic-tac-toe`; every range brackets the
measured value. Difficulty now varies by seed in headless runs (the browser still defaults to medium),
so `won_easy` / `won_medium` / `won_hard` are exercised by the gate instead of only the middle setting.

Changed in this pass:
- Connect 4 discs now fall to their row (9 ticks + 1.6/row, eased, capped at 22) and the board array is
  only written when the disc lands, so it stays the single source of truth.
- The winning line pulses. `winningLine()` is separate from `result()` so the minimax hot loop still
  allocates nothing; `render()` computes no game logic, it only draws `state.line`.
- The Connect 4 cursor is a disc hovering over its column, so what is shown is what happens.
- `flips()` uses CONFIG.size instead of a hard-coded 8.
- The file is reformatted to one statement per line so small models can edit it safely.

MIT CMS.608 L2: a decision is only meaningful if the player can see what it changed. The drop and the
winning-line pulse exist for that reason, not for decoration.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
