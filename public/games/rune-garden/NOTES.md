# Rune Garden — change log

## Measured 2026-09-25

Match-3 puzzle. Measured over 20 seeded runs with `python3 -m studio.sim games/rune-garden`:

- completion_rate 1
- mean_score 2642.5
- p50_seconds 19.5
- p90_seconds 22.36

The manifest targets now bracket these numbers: `completion_rate [0.95, 1]`,
`mean_score [1600, 3700]`, `p50_seconds [12, 28]`, `p90_seconds [13, 32]`. The
previous `mean_score` range `[1, 100000]` could never fail: it admitted every
plausible score, so it measured nothing.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
