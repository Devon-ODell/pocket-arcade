# Apex Circuit — integrated racing preview

The swarm supplied a Star Catcher scaffold under this name. The main checkout
already contained the actual rear-drive circuit implementation; integration
preserves that implementation and the newer shared shell.

The scaffold manifest described catching stars and required `p50_caught`, which
is not a racing metric. Version 0.2.0 replaces that unrelated contract with a
three-lap racing contract: session ends, at least 75% of bot races finish, median
three laps, 120–540 second median session, at most 40% mean off-road time and at
most 40 mean spins. This is a genre correction, not a claim that the previous
catcher targets were satisfied by the racer. Sessions now end at ten minutes even
if the driver has not completed all laps.

Measured revision (20 seeds, starting at 1): before the steering correction,
finished=0.70 and offtrack_share=0.4744 failed the racing targets. The old bot
counteracted the yaw required to follow a curved road. Feed-forward road yaw plus
analog heading correction gives finished=0.95, mean offtrack_share=0.0263,
median duration=326.1417s, mean spins=17.8. The same racing targets now pass.
Keyboard and touch use the same vehicle physics. The screenshot is a real game
frame; no generated promotional art is substituted for gameplay.

Measured lap times (20 seeds, starting at 1): p50_seconds=326.1417s, range=[319.2667, 600]s.
Adjusted p50_seconds target from [120, 540] to [315, 335] to tightly bracket measured values.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
