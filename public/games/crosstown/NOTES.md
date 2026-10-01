# Crosstown — first playable night shift

An original canvas city-driving game, built from docs/briefs/crosstown.md. This
ships a playable driving slice with deliveries and introductory pursuit, not the
entire six-milestone roadmap.

Implemented: seeded street spacing and blocks, a drivable coupe with throttle,
braking/reverse, sliding handbrake, solid buildings, collision damage, lane
traffic that stops at lights, pedestrians that dodge, a camera leading the car,
four named neighborhood regions, pickup/drop delivery jobs, money, timers,
line-of-sight patrol tracking/searching, escape and a fee for getting stopped.
The HUD and minimap show destinations, patrols and their search areas. Keyboard
and two-thumb mobile controls use the same simulation. A title/control lesson
leads into a three-minute shift with a results screen and restart.

Still future milestones: walking/vehicle entry, six vehicle archetypes, passenger,
tow and time-trial jobs, the full five-level heat response, roadblocks/spike
strips/air support, district unlock progression and garages, saved upgrades,
ramps/elevation, and a day/night/weather cycle. Neighborhoods currently share a
street-grid structure. This is a night-time slice, not a claim that G1–G6 are done.

Design question: can a casual driver understand the next delivery, navigate
traffic and finish useful jobs without memorizing the city? A gold pickup and
mint drop are marked both in the world and on the minimap; approaching a stop
requires slowing down. This applies the decisions-and-feedback guidance in the
brief's MIT CMS.608 Session 2, part 1, transcript pp. 3–5. Timing and handling
values here are our prototype choices, not course prescriptions. Human testing
is still needed to judge the driving feel and pursuit difficulty.

Measured revision, 20 seeded three-minute shifts (seeds 1–20): the first bot
averaged 0.5 jobs and 117.35 crashes because traffic contact repeatedly shoved it
back into the same stopped vehicle. Proper separation along the collision normal
and street-aligned steering reduced mean crashes to 1.8 and raised jobs to 9.8.
All shifts terminate deterministically; mean distance 17,362.2 map units,
mean money $2,713.85, mean busts 0.05, mean pedestrians clipped 0. The introductory
pursuit is light; these figures do not satisfy the full G4 brief's heat curve.

Checks cover seeded map variation, movement, wall collision, real pickup/payment,
red lights, being caught, losing heat behind cover, and distinct full-run outcomes
for three seeds. The studio harness checks JSON resume and render immutability.
Browser testing exercised the actual keyboard runtime and captured a real frame
for site/thumbs/crosstown.png. All visuals and code are original canvas work;
no third-party game code or art was copied.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
