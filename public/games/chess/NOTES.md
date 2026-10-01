# Chess

Local deterministic opponent, three difficulty settings. Implements castling,
en passant, choice of four promotions, self-check filtering, checkmate/stalemate,
common insufficient-material positions, threefold/50-move claims and automatic
fivefold/75-move draws. No remote engine or model calls. This is casual chess;
no clock, online play, or exhaustive detection of every possible dead position.

Rules reference: [FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023).
Validation: starting-position perft depth 3 (8,902), castling through check,
pinned en passant, four promotions, Fool's Mate, repetition, illegal move
rejection, simulation and browser play.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
