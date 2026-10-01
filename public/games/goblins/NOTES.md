# Goblins!

Version 0.2.0 is a rewrite of "Go Gin, Goblins!" (0.1.0), renamed at the owner's request.

## Why it was rewritten

0.1.0 advertised a gin rummy / Go Fish hybrid, but two of its four actions decided nothing.
The same casual bot, with one decision changed, over 300 seeded runs:

| 0.1.0 change | runs won |
|---|---:|
| as written | 82% |
| asks for a random rank | 86% |
| never knocks | 82% |
| discards at random | 55% |

The goblin never played. Its hand was only a pool you could ask from: it never asked, melded
or knocked, and it dealt a fixed 2 + room damage a turn. The hand refilled to nine every
turn. Meld detection was greedy. Every enemy was a fish pun under a goblin title. The same
three relics were offered in every room. The targets (1–5 rooms, 3–40 melds) could not fail.

## Rules

Standard gin, as in docs/briefs/classics.md: hands of ten; draw from the stock or take the
top of the pile, then discard (not the card you just took from the pile). Knock with 10 or
less deadwood; gin at 0, worth deadwood + 25; the defender lays loose cards onto the
knocker's melds unless it is gin; an undercut (the defender's deadwood not higher) pays
the difference + 25 to the defender. If the stock falls to two cards, the hand is a wash.
Points are damage. Your health (170) carries through five goblins, with 30 healed after
each.

The Go Fish ask replaces a draw: name a rank you hold. If the goblin holds one it must give
you the one it will miss least, and it draws a replacement, so both hands stay at ten.
If it holds none you go fish from the stock and it bites you for 2. Asking tells it you
hold that rank. Goblins ask you the same way, under the same rules. A bite never takes
anyone to 0; hands decide rooms.

What each side learns is on the table: cards seen entering the goblin's hand show face up
with a gold rim, and ranks it asked for are listed. Neither the goblins nor the
player-facing bot read the other hand. `tests/test_table_games.py` swaps each side's unseen
cards for stock cards and checks that no decision changes. It fails if either side reads
the hidden hand.

## The goblins

| | health | knocks at | asks | remembers what you take | hits harder |
|---|---:|---:|---|---|---:|
| Snib the Runt | 45 | 10 | never | no | – |
| Grabby Mott | 60 | 10 | always, with a pair or a known rank | no | – |
| Wart the Watcher | 75 | 8 | 60% | yes, and will not feed you | – |
| Big Nog the Patient | 90 | 4 | 50% | no | +10 |
| Grizzelda the Goblin Queen | 110 | 7 | always | yes | +5 |

Trinkets (choose one of three between goblins): Knucklebone (+5 on hands you win), Thick
Skull (−5 on hands you lose), Pickled Toad (heal 40), Loud Whistle (knock at 13), Rat on a
String (see the top of the stock), Gin Jug (gin +20), Sticky Fingers (goblins cannot ask away
cards in your melds), Bandage Roll (heal 8 per hand won).

## Every decision matters now

The casual `bot()` takes the upcard when it makes a meld, asks when it knows the goblin
holds a rank it wants (and half the time on a hunch with a loose pair), discards to the
least deadwood, and knocks as soon as it can. 200 runs from seed 1, one decision changed:

| change | runs won | goblins beaten |
|---|---:|---:|
| as written | 27% | 3.25 |
| never asks | 7% | 2.27 |
| asks at random | 9% | 2.48 |
| asks every turn | 22% | 2.98 |
| only draws from the stock | 0% | 0.88 |
| discards at random | 0% | 0.06 |
| knocks only on gin | 27% | 3.29 |
| knocks at 4 or less | 18% | 3.05 |

Asking on evidence beats both never asking and asking blind. The bite is what keeps
"ask every turn" from dominating: before the bite existed, it won 23% against 13% for the
bot as written. Holding for gin ties knocking early, and waiting for 4 or less is worse, so
the knock is a real judgement call.

## Measured 2026-09-26 (manifest targets)

`python3 -m studio.sim games/goblins`, 80 runs from seed 1:

| metric | mean | p10 | p50 | p90 |
|---|---:|---:|---:|---:|
| won | 0.2625 | 0 | 0 | 1 |
| goblins beaten | 3.125 | 1 | 3 | 5 |
| hands | 21.05 | 12 | 22 | 28.1 |
| seconds | 213.1 | 114.6 | 213.3 | 309.1 |
| knock deadwood | 6.71 | 5 | 6.8 | 8.31 |
| ask hit rate | 0.568 | 0.339 | 0.61 | 0.732 |
| gins | 0.4375 | 0 | 0 | 1.1 |
| undercut against | 0.6875 | 0 | 0 | 2 |
| bites taken | 19.19 | 9 | 17.5 | 30.2 |

Targets: `mean_won` [0.15, 0.4], `mean_rooms` [2.6, 3.6], `mean_hands` [17, 25],
`p50_seconds` [170, 260], `mean_knock_deadwood` [5.5, 8], `mean_ask_hit_rate` [0.45, 0.7],
`mean_gins` [0.2, 0.8], `mean_undercut_against` [0.3, 1.2]. A run is five goblins of
several hands each, which is why the median run is about three and a half minutes.

Checked in headless Brave (DevTools protocol, bot-played states drawn by `render()`):
the table, a goblin's ask, the discard buttons, knock, gin and undercut results with
lay-offs, the trinket choice, the Queen, and both endings draw with no page errors. A frame
takes 0.2–0.6 ms. The thumbnail is one of those frames (the Queen, seed 3).

The meld search is checked against an independent brute force on 3,000 random hands with no
mismatches. It chooses the 5-8 spade run over three sevens, and lends one of four fives to a
run.

## 2026-09-26 — Rules popup

Added an in-game guide with the current goal, loss conditions, keyboard/touch
controls and first actions. Shared help pauses play without changing game rules.
