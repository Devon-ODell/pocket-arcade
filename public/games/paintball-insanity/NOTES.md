# Paintball Insanity — first-person Gauntlet

Version 0.2.0 replaces the top-down arena prototype (0.1.0) with a first-person port of
the Roblox game of the same name (`video-games/paintball`, read-only). ChatGPT wrote the port.
It carries over that project's ballistics (RK4 flight with quadratic drag, the fitted
closed-form drop), the three markers, the bot brain and squad callouts, the Gauntlet
rules, the payout formula and the chatter. It plays on the Speedball field. The other
Roblox modes (endless, bosses, course, seasons, gear, consumables) are not ported.

## Where the numbers come from

`DATA` at the top of `game.js` holds the values from the Roblox project's `Data/*.json`
(markers, ballistics, bots, match, economy, chatter, the Speedball map). No generator
script is committed, so a change on the Roblox side has to be copied over by hand.
Spot-checked on 2026-09-26: the Ridgeline Mech's muzzle velocity is 130 in both, the
round clock is 200 s (`match.json` rounds), and the death penalty is floor 0.06, decay 0.26.

## Measured 2026-09-26 (manifest targets)

`python3 -m studio.sim games/paintball-insanity`, 40 runs from seed 1, with the casual
`bot()` (0.34 s reaction, 70% of a perfect lead, 2.4 degrees of hand) starting a fresh
profile, so every run plays the first tier, Rec Ballers:

| metric | mean | p10 | p50 | p90 | min | max |
|---|---:|---:|---:|---:|---:|---:|
| won (all five rounds) | 1 | 1 | 1 | 1 | 1 | 1 |
| rounds cleared | 5 | 5 | 5 | 5 | 5 | 5 |
| deaths | 23.35 | 17.9 | 23 | 30 | 14 | 32 |
| accuracy | 0.0907 | 0.0769 | 0.0885 | 0.106 | 0.065 | 0.136 |
| longest streak | 8.775 | 5 | 8 | 13 | 4 | 15 |
| score (payout, FF) | 136.05 | 122 | 132.5 | 150.6 | 114 | 176 |
| seconds | 393.2 | 323.5 | 392.1 | 451.6 | 298.6 | 544.8 |
| shots | 450.8 | 377.9 | 452.5 | 518.5 | 294 | 618 |

The targets bracket these: `mean_won` [0.9, 1], `mean_rounds_cleared` [4.8, 5],
`mean_deaths` [18, 29], `mean_accuracy` [0.075, 0.11], `mean_longest_streak` [6.5, 11],
`mean_score` [115, 160], `p10/p50/p90_seconds` [290, 355] / [355, 430] / [410, 495].
The 0.1.0 targets (score 900–9000, 1–4.5 rounds, `mean_tags`) described the top-down game
and no longer apply.

## The tier ladder

Rec Ballers is meant to be cleared: clearing it unlocks Local League. Winning every run
there does not mean the game is too easy. The same casual bot, 10 matches per tier from
seed 101:

| starting tier | matches won | where it runs out |
|---|---:|---|
| 0 Rec Ballers | 10/10 | rounds 4–5 take up to 163 of 200 s, about 9 deaths each |
| 1 Local League | 1/10 | round 4 fails 2 times in 10, round 5 fails 7 times in 8 |
| 2 Regional Semi-Pro | 1/10 | from round 2 on; round 4 is cleared 3 times in 8 |
| 3 Pro Circuit | 0/10 | round 1 fails 3 times in 10, round 2 fails 4 times in 7 |

`tests/test_paintball_insanity.py` keeps Pro Circuit out of the casual bot's reach, so
a change that flattens the ladder fails the gate even while the Rec Ballers targets pass.
Deaths never end a round. The player respawns after 2.5 s, so a round is lost only to
the clock.

## State of the port (2026-09-26)

Checked in headless Brave through the DevTools protocol, with states played by `bot()` and
drawn by the game's own `render()`: the title, warm-up, a firefight, being hit, the
intermission, round 4 against Local League and the results screen all draw with no page
errors or console warnings. A frame takes 1.0–2.3 ms to draw and a tick 0.009 ms.
Under the real shell it ran at 60 ticks a second. The thumbnail is one of those frames
(round 4, seed 5).

Open:
- Payouts are small for a casual player. 19–23 deaths put the death multiplier at its
  0.06 floor, so a full clear pays 115–175 FF. The Vex Series-E costs 4,200 FF, about 30
  cleared matches. The formula is the Roblox one, tuned so a clear with no deaths pays
  about 9 times a clear with ten.
- Not yet checked by hand: pointer lock and mouse feel, and touch play on a phone.
- The first-person controls use the shell's opt-in `Game.pointerLook` and `Game.keys`
  (docs/GAME_CONTRACT.md).

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
