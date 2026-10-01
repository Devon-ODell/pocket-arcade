// game.js — Goblins! Gin rummy against five goblins in a row, with a Go Fish ask.
//
// The gin is standard (docs/briefs/classics.md, Rummy): hands of ten, draw from the stock or
// take the top of the pile, discard one. Knock with 10 or less deadwood; gin at 0; the
// defender lays loose cards onto the knocker's melds unless it is gin; an undercut when the
// defender's deadwood is not higher. The points of a hand are damage, and your health
// carries through all five goblins.
//
// The twist: instead of drawing, ask the goblin for a rank you hold. If it has one it must
// hand it over and draws a replacement; if not, go fish from the stock. Either way it now
// knows you hold that rank, and goblins ask back. Everything either side learns this way is
// shown on the table, and neither side ever reads the other's hand.
//
// Contract (docs/GAME_CONTRACT.md): classic script, no DOM, no Math.random, state is JSON.
(function () {
  'use strict';

  const CONFIG = /*CONFIG*/{"title": "Goblins!", "playerHp": 170, "knockLimit": 10, "ginBonus": 25, "undercutBonus": 25, "roomHeal": 30, "bite": 2, "handCap": 80}/*END*/;
  const W = 480, H = 720;
  const SUITS = ['♠', '♥', '♣', '♦'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const NAMES = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings'];
  const rank = (c) => c % 13, suit = (c) => Math.floor(c / 13), value = (c) => Math.min(rank(c) + 1, 10);
  const label = (c) => RANKS[rank(c)] + SUITS[suit(c)];
  const sum = (cards) => cards.reduce((n, c) => n + value(c), 0);

  // Each goblin plays the same gin you do; they differ in when they knock, how often they
  // ask, whether they remember what you picked up, and how hard their wins hit.
  const GOBLINS = [
    { name: 'Snib', title: 'the Runt', hp: 45, skin: '#93bf62', knockAt: 10, asks: 0, watch: false, hits: 0,
      trait: 'Knocks the moment it can. Never asks.' },
    { name: 'Grabby Mott', title: 'the Pickpocket', hp: 60, skin: '#b5b35a', knockAt: 10, asks: 1, watch: false, hits: 0,
      trait: 'Asks for your cards whenever it holds a pair.' },
    { name: 'Wart', title: 'the Watcher', hp: 75, skin: '#6ea582', knockAt: 8, asks: 0.6, watch: true, hits: 0,
      trait: 'Remembers what you take, and never feeds you.' },
    { name: 'Big Nog', title: 'the Patient', hp: 90, skin: '#b88a58', knockAt: 4, asks: 0.5, watch: false, hits: 10,
      trait: 'Waits for a strong hand. Its wins hit 10 harder.' },
    { name: 'Grizzelda', title: 'the Goblin Queen', hp: 110, skin: '#a585c8', knockAt: 7, asks: 1, watch: true, hits: 5, crown: true,
      trait: 'Asks, remembers, and hits 5 harder.' },
  ];
  const TRINKETS = [
    { key: 'knuckle', name: 'Knucklebone', text: 'Hands you win hit 5 harder.' },
    { key: 'skull', name: 'Thick Skull', text: 'Hands you lose hurt 5 less.' },
    { key: 'toad', name: 'Pickled Toad', text: 'Heal 40 health now.' },
    { key: 'whistle', name: 'Loud Whistle', text: 'Knock with up to 13 deadwood.' },
    { key: 'rat', name: 'Rat on a String', text: 'See the top card of the stock.' },
    { key: 'jug', name: 'Gin Jug', text: 'Gin pays 20 more.' },
    { key: 'fingers', name: 'Sticky Fingers', text: 'Goblins cannot ask away cards in your melds.' },
    { key: 'bandage', name: 'Bandage Roll', text: 'Heal 8 after every hand you win.' },
  ];

  // --- randomness: one seeded stream in the state --------------------------------------
  function rand(s) { s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0; return s.rng / 4294967296; }
  function shuffle(s, a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // --- melds -----------------------------------------------------------------------------
  const isSet = (m) => m.every((c) => rank(c) === rank(m[0]));
  function isMeld(cards) {
    if (cards.length < 3) return false;
    if (isSet(cards)) return cards.length <= 4;
    const a = cards.slice().sort((x, y) => x - y);          // within a suit, ids run in rank order
    return a.every((c, i) => suit(c) === suit(a[0]) && (!i || c === a[i - 1] + 1));
  }
  // Every meld a hand could lay down: each three-card subset and the whole of a four-card
  // rank, and every run of three or more in one suit (ace low, no wrap).
  function candidates(hand) {
    const out = [], byRank = [], bySuit = [[], [], [], []];
    for (const c of hand) { (byRank[rank(c)] = byRank[rank(c)] || []).push(c); bySuit[suit(c)].push(c); }
    for (const g of byRank) {
      if (!g || g.length < 3) continue;
      out.push(g.slice());
      if (g.length === 4) for (let i = 0; i < 4; i++) out.push(g.filter((_, j) => j !== i));
    }
    for (const g of bySuit) {
      g.sort((a, b) => a - b);
      for (let i = 0; i < g.length; i++) {
        for (let j = i + 1; j < g.length && g[j] === g[j - 1] + 1; j++) if (j - i >= 2) out.push(g.slice(i, j + 1));
      }
    }
    return out;
  }
  // The arrangement with the least deadwood. A card that could serve a set or a run is where
  // a greedy pass goes wrong, so this searches: the lowest card is either loose or in one of
  // the candidate melds that contain it.
  function bestMelds(hand) {
    const cards = hand.slice().sort((a, b) => a - b), cands = candidates(cards);
    let best = null;
    (function search(rest, melds, dw) {
      if (best && dw >= best.deadwood) return;
      if (!rest.length) { best = { melds: melds.slice(), deadwood: dw }; return; }
      const c = rest[0];
      for (const m of cands) {
        if (!m.includes(c) || !m.every((x) => rest.includes(x))) continue;
        melds.push(m);
        search(rest.filter((x) => !m.includes(x)), melds, dw);
        melds.pop();
      }
      search(rest.slice(1), melds, dw + value(c));
    })(cards, [], 0);
    best.loose = cards.filter((c) => !best.melds.some((m) => m.includes(c)));
    return best;
  }
  const deadwood = (hand) => bestMelds(hand).deadwood;
  // Before a knock is scored the defender lays loose cards onto the knocker's melds: a fourth
  // card on a set, or a card that extends a run at either end. Repeats until nothing fits.
  function layOff(melds, loose) {
    const ms = melds.map((m) => m.slice()), left = loose.slice(), laid = [];
    for (let moved = true; moved;) {
      moved = false;
      for (const c of left.slice()) {
        const fit = ms.find((m) => isSet(m) ? m.length < 4 && rank(m[0]) === rank(c)
          : suit(m[0]) === suit(c) && (c === Math.min(...m) - 1 || c === Math.max(...m) + 1));
        if (fit) { fit.push(c); left.splice(left.indexOf(c), 1); laid.push(c); moved = true; }
      }
    }
    return { laid, loose: left };
  }
  // The lowest deadwood a hand of eleven reaches by discarding one card other than `keep`.
  function bestDiscard(hand, keep) {
    let best = null;
    for (const c of hand) {
      if (c === keep) continue;
      const dw = deadwood(hand.filter((x) => x !== c));
      if (!best || dw < best.dw || (dw === best.dw && value(c) > value(best.card))) best = { card: c, dw };
    }
    return best;
  }

  // --- the table ---------------------------------------------------------------------------
  const has = (s, key) => s.trinkets.includes(key);
  const goblin = (s) => GOBLINS[s.room];
  const knockLimit = (s) => has(s, 'whistle') ? 13 : CONFIG.knockLimit;
  function say(s, line) { s.message = line; s.log.unshift(line); if (s.log.length > 3) s.log.length = 3; }
  function sound(s, name) { s.fx.push({ k: 'sound', s: name }); }

  // What each side has learned about the other: cards seen entering a hand, and ranks a hand
  // is known to hold because it asked for them. A card that leaves a hand leaves its entry.
  function forget(k, who, c) {
    k[who + 'Cards'] = k[who + 'Cards'].filter((x) => x !== c);
    k[who + 'Ranks'] = k[who + 'Ranks'].filter((r) => r !== rank(c));
  }
  function learn(k, who, card, r) {
    if (card >= 0 && !k[who + 'Cards'].includes(card)) k[who + 'Cards'].push(card);
    if (r >= 0 && !k[who + 'Ranks'].includes(r)) k[who + 'Ranks'].push(r);
  }

  function deal(s) {
    s.deck = shuffle(s, Array.from({ length: 52 }, (_, i) => i));
    s.hand = s.deck.splice(-10).sort((a, b) => a - b);
    s.gob = s.deck.splice(-10).sort((a, b) => a - b);
    s.pile = [s.deck.pop()];
    s.know = { gobCards: [], gobRanks: [], youCards: [], youRanks: [] };
    s.fromPile = -1; s.sel = -1; s.fresh = -1; s.result = null;
    s.turn = s.roomHands % 2 ? 'gob' : 'you';
    s.roomHands++; s.hands++;
    if (s.turn === 'you') { s.phase = 'draw'; say(s, 'Your deal. Draw, take the pile, or ask.'); }
    else { s.phase = 'gob'; s.gobStep = 'draw'; s.wait = 50; say(s, `${goblin(s).name} plays first.`); }
  }
  function startRoom(s) {
    const g = goblin(s);
    s.foeHp = s.foeMax = g.hp; s.roomHands = 0;
    deal(s);
    say(s, `${g.name} ${g.title} sits down. ${g.trait}`);
  }
  function init(seed) {
    const s = {
      rng: seed >>> 0 || 1, tick: 0, over: false, won: false, score: 0,
      hp: CONFIG.playerHp, maxHp: CONFIG.playerHp, room: 0, cleared: 0, trinkets: [], offer: [],
      foeHp: 0, foeMax: 0, hands: 0, roomHands: 0,
      deck: [], pile: [], hand: [], gob: [], know: null,
      phase: 'draw', turn: 'you', gobStep: 'draw', wait: 0, fromPile: -1, sel: -1, fresh: -1, freshT: 0,
      cursor: 0, result: null, message: '', log: [], prev: {},
      stats: { gins: 0, knocks: 0, knockDeadwood: 0, undercuts: 0, undercutAgainst: 0, asks: 0, askHits: 0,
               washes: 0, bites: 0, dealt: 0, taken: 0, handsWon: 0, handsLost: 0 },
      fx: [],
    };
    startRoom(s);
    return s;
  }

  // Draw one card from the stock into a hand. The stock is never empty here: a turn that
  // would start with two or fewer cards left ends the hand as a wash instead.
  function drawStock(s, hand) { const c = s.deck.pop(); hand.push(c); hand.sort((a, b) => a - b); return c; }

  // `who` asks the other side for rank r. On a hit the other side gives up one card of that
  // rank (the one whose loss costs it least) and draws a replacement; on a miss the asker
  // goes fish. Either way the asker is now known to hold rank r.
  function ask(s, who, r) {
    const other = who === 'you' ? 'gob' : 'you', mine = who === 'you' ? s.hand : s.gob, theirs = who === 'you' ? s.gob : s.hand;
    const k = s.know;
    let give = theirs.filter((c) => rank(c) === r);
    if (who === 'gob' && has(s, 'fingers')) {
      const melded = bestMelds(s.hand).melds.flat();
      give = give.filter((c) => !melded.includes(c));
    }
    learn(k, who, -1, r);
    if (who === 'you') s.stats.asks++;
    if (give.length) {
      const c = give.slice().sort((a, b) => deadwood(theirs.filter((x) => x !== a)) - deadwood(theirs.filter((x) => x !== b)) || a - b)[0];
      theirs.splice(theirs.indexOf(c), 1);
      mine.push(c); mine.sort((a, b) => a - b);
      forget(k, other, c);
      learn(k, who, c, -1);
      const back = drawStock(s, theirs);
      if (who === 'you') { s.stats.askHits++; s.fresh = c; s.freshT = 90; }
      else { s.fresh = back; s.freshT = 90; }
      sound(s, 'pick');
      return c;
    }
    // A miss: go fish, and get bitten. The bite never finishes anyone; hands do that.
    const c = drawStock(s, mine);
    if (who === 'you') { s.fresh = c; s.freshT = 90; s.hp = Math.max(1, s.hp - CONFIG.bite); s.stats.bites++; s.fx.push({ k: 'shake', m: 3 }); }
    else s.foeHp = Math.max(1, s.foeHp - CONFIG.bite);
    sound(s, 'thud');
    return -1;
  }

  // --- a hand ends ------------------------------------------------------------------------
  function resolve(s, knocker) {
    const defender = knocker === 'you' ? 'gob' : 'you', g = goblin(s);
    const k = bestMelds(knocker === 'you' ? s.hand : s.gob), d = bestMelds(knocker === 'you' ? s.gob : s.hand);
    const gin = k.deadwood === 0;
    const off = gin ? { laid: [], loose: d.loose } : layOff(k.melds, d.loose);
    const kd = k.deadwood, dd = sum(off.loose);
    // `math` spells the damage out on the result screen, one term per rule or trinket.
    let winner, points, kind, math;
    if (gin) { winner = knocker; kind = 'gin'; points = dd + CONFIG.ginBonus; math = [`${dd} deadwood`, `+ ${CONFIG.ginBonus} gin`]; }
    else if (dd <= kd) { winner = defender; kind = 'undercut'; points = kd - dd + CONFIG.undercutBonus; math = [`${kd} − ${dd}`, `+ ${CONFIG.undercutBonus} undercut`]; }
    else { winner = knocker; kind = 'knock'; points = dd - kd; math = [`${dd} − ${kd}`]; }
    const add = (n, why) => { if (!n) return; points += n; math.push(`${n < 0 ? '−' : '+'} ${Math.abs(n)} ${why}`); };
    if (winner === 'you') {
      if (gin && has(s, 'jug')) add(20, 'Gin Jug');
      if (has(s, 'knuckle')) add(5, 'Knucklebone');
      s.foeHp = Math.max(0, s.foeHp - points);
      s.stats.dealt += points; s.score += points; s.stats.handsWon++;
      if (has(s, 'bandage')) s.hp = Math.min(s.maxHp, s.hp + 8);
      sound(s, gin ? 'win' : 'clear');
    } else {
      add(g.hits, g.name);
      if (has(s, 'skull')) add(-Math.min(5, points), 'Thick Skull');
      s.hp = Math.max(0, s.hp - points);
      s.stats.taken += points; s.stats.handsLost++;
      sound(s, 'hit'); s.fx.push({ k: 'shake', m: Math.min(14, 4 + points / 4) });
    }
    if (knocker === 'you') {
      s.stats.knocks++; s.stats.knockDeadwood += kd;
      if (gin) s.stats.gins++;
    } else if (kind === 'undercut') s.stats.undercuts++;
    if (knocker === 'you' && kind === 'undercut') s.stats.undercutAgainst++;
    const view = (who) => who === knocker ? { melds: k.melds, loose: k.loose, deadwood: kd, laid: [] }
      : { melds: d.melds, loose: off.loose, deadwood: dd, laid: off.laid };
    s.result = { kind, knocker, winner, points, math: math.join(' '), you: view('you'), gob: view('gob') };
    s.phase = 'result'; s.sel = -1;
    const who = knocker === 'you' ? 'You' : g.name, taker = winner === 'you' ? 'You deal' : `${g.name} deals`;
    say(s, kind === 'gin' ? `${who} went gin! ${points} damage.`
      : kind === 'undercut' ? `Undercut! ${taker} ${points}.`
      : `${who} knocked: ${points} damage.`);
  }
  function wash(s) {
    s.stats.washes++;
    const view = (hand) => Object.assign(bestMelds(hand), { laid: [] });
    s.result = { kind: 'wash', knocker: '', winner: '', points: 0, math: '', you: view(s.hand), gob: view(s.gob) };
    s.phase = 'result'; s.sel = -1;
    say(s, 'The stock ran dry. Nobody scores this hand.');
  }
  function afterResult(s) {
    if (s.hp <= 0) { s.over = true; say(s, `${goblin(s).name} wins. The warren keeps your boots.`); sound(s, 'die'); return; }
    if (s.foeHp <= 0) {
      s.cleared++; s.score += 150;
      if (s.room === GOBLINS.length - 1) {
        s.over = true; s.won = true; s.score += s.hp * 2;
        say(s, 'The Queen folds. The warren is yours.');
        sound(s, 'win'); s.fx.push({ k: 'confetti' });
        return;
      }
      s.hp = Math.min(s.maxHp, s.hp + CONFIG.roomHeal);
      const pool = TRINKETS.map((_, i) => i).filter((i) => TRINKETS[i].key === 'toad' || !has(s, TRINKETS[i].key));
      s.offer = shuffle(s, pool).slice(0, 3);
      s.phase = 'loot'; s.cursor = 0;
      say(s, `${goblin(s).name} is out of the game. Take one trinket from the pot.`);
      sound(s, 'level');
      return;
    }
    if (s.hands >= CONFIG.handCap) { s.over = true; say(s, 'Dawn comes up. The goblins throw you out.'); return; }
    deal(s);
  }
  function takeTrinket(s, i) {
    const t = TRINKETS[s.offer[i]];
    if (t.key === 'toad') s.hp = Math.min(s.maxHp, s.hp + 40);
    else s.trinkets.push(t.key);
    s.room++;
    startRoom(s);
  }

  // After a discard: the other side plays, unless the stock is down to two cards.
  function endTurn(s, who) {
    s.fromPile = -1; s.sel = -1;
    if (s.deck.length <= 2) { wash(s); return; }
    if (who === 'you') { s.turn = 'gob'; s.phase = 'gob'; s.gobStep = 'draw'; s.wait = 40; }
    else { s.turn = 'you'; s.phase = 'draw'; }
  }

  // --- the goblin's turn: it sees its own hand, the pile and what it has learned ----------
  function goblinDraw(s) {
    const g = goblin(s), k = s.know, top = s.pile[s.pile.length - 1];
    if (s.deck.length <= 2) { wash(s); return; }
    // Take the upcard only when it lands in a meld.
    if (top !== undefined && bestMelds([...s.gob, top]).melds.some((m) => m.includes(top))) {
      s.pile.pop(); s.gob.push(top); s.gob.sort((a, b) => a - b); s.fromPile = top;
      learn(k, 'gob', top, -1);
      say(s, `${g.name} takes the ${label(top)}.`);
    } else {
      const held = (r) => s.gob.filter((c) => rank(c) === r).length;
      const known = [...new Set([...k.youRanks, ...k.youCards.map(rank)])].filter((r) => held(r) > 0);
      const loose = bestMelds(s.gob).loose;
      const pairs = [...new Set(loose.map(rank))].filter((r) => held(r) >= 2);
      let r = -1;
      if (g.asks > 0 && rand(s) < g.asks) {
        if (known.length && (g.watch || rand(s) < 0.5)) r = known.sort((a, b) => held(b) - held(a) || b - a)[0];
        else if (pairs.length) r = pairs.sort((a, b) => b - a)[0];
      }
      if (r >= 0) {
        const got = ask(s, 'gob', r);
        say(s, got >= 0 ? `${g.name}: "Got any ${NAMES[r]}?" You hand over the ${label(got)}.`
          : `${g.name}: "Got any ${NAMES[r]}?" You don't. It goes fishing, and you bite it for ${CONFIG.bite}.`);
        if (got >= 0) s.fx.push({ k: 'shake', m: 3 });
      } else {
        drawStock(s, s.gob);
        say(s, `${g.name} draws from the stock.`);
      }
    }
    s.gobStep = 'discard'; s.wait = 45;
  }
  function goblinDiscard(s) {
    const g = goblin(s), k = s.know;
    const options = s.gob.filter((c) => c !== s.fromPile).map((c) => ({ card: c, dw: deadwood(s.gob.filter((x) => x !== c)) }));
    const low = Math.min(...options.map((o) => o.dw));
    // A watcher will pay up to two points of deadwood not to hand you a card it knows you want.
    const feeds = (c) => k.youRanks.includes(rank(c)) || k.youCards.some((y) => rank(y) === rank(c) || (suit(y) === suit(c) && Math.abs(y - c) <= 2));
    const pool = options.filter((o) => o.dw <= low + (g.watch ? 2 : 0));
    const safe = g.watch ? pool.filter((o) => !feeds(o.card)) : [];
    const pick = (safe.length ? safe : pool.filter((o) => o.dw === low)).sort((a, b) => a.dw - b.dw || value(b.card) - value(a.card) || b.card - a.card)[0];
    s.gob.splice(s.gob.indexOf(pick.card), 1);
    s.pile.push(pick.card);
    forget(k, 'gob', pick.card);
    if (pick.dw <= Math.min(g.knockAt, CONFIG.knockLimit)) {
      say(s, `${g.name} discards the ${label(pick.card)} and knocks!`);
      resolve(s, 'gob');
      return;
    }
    say(s, `${g.name} discards the ${label(pick.card)}. Your turn.`);
    endTurn(s, 'gob');
  }

  // --- your actions: the pointer, the keys and the bot all come through here -------------
  function act(s, cmd, card) {
    if (s.over) return false;
    if (s.phase === 'result') { if (cmd !== 'next') return false; afterResult(s); return true; }
    if (s.phase === 'loot') {
      if (cmd !== 'loot' || !Number.isInteger(card) || card < 0 || card >= s.offer.length) return false;
      takeTrinket(s, card); return true;
    }
    if (cmd === 'select') { if (!s.hand.includes(card)) return false; s.sel = card; return true; }
    const k = s.know, g = goblin(s);
    if (s.phase === 'draw') {
      if (s.deck.length <= 2) { wash(s); return true; }
      if (cmd === 'stock') {
        const c = drawStock(s, s.hand); s.fresh = c; s.freshT = 90;
        say(s, `You draw the ${label(c)}. Now discard one, or knock.`);
      } else if (cmd === 'pile') {
        if (!s.pile.length) return false;
        const c = s.pile.pop(); s.hand.push(c); s.hand.sort((a, b) => a - b);
        s.fromPile = c; s.fresh = c; s.freshT = 90;
        learn(k, 'you', c, -1);
        say(s, `You take the ${label(c)}. ${g.name} saw that.`);
      } else if (cmd === 'ask') {
        if (!s.hand.includes(card)) return false;
        const r = rank(card), got = ask(s, 'you', r);
        say(s, got >= 0 ? `"Got any ${NAMES[r]}?" ${g.name} grumbles and hands over the ${label(got)}.`
          : `"Got any ${NAMES[r]}?" No. Go fish: you draw the ${label(s.fresh)}, and ${g.name} bites you for ${CONFIG.bite}.`);
      } else return false;
      s.phase = 'discard'; s.sel = -1;
      return true;
    }
    if (s.phase === 'discard' && (cmd === 'discard' || cmd === 'knock')) {
      if (!s.hand.includes(card) || card === s.fromPile) {
        say(s, card === s.fromPile ? 'You cannot throw back the card you just took.' : 'Pick a card to discard.');
        return false;
      }
      const rest = s.hand.filter((c) => c !== card);
      if (cmd === 'knock' && deadwood(rest) > knockLimit(s)) { say(s, `Knocking needs ${knockLimit(s)} or less deadwood.`); return false; }
      s.hand = rest; s.pile.push(card);
      forget(k, 'you', card);
      sound(s, 'pick');
      if (cmd === 'knock') { resolve(s, 'you'); return true; }
      say(s, `You discard the ${label(card)}.`);
      endTurn(s, 'you');
      return true;
    }
    return false;
  }

  // --- layout, shared by the pointer and the drawing ------------------------------------------
  const CARD_W = 66, CARD_H = 92, HAND_Y = 396;
  // Your hand, melds first (each tagged with its meld), then the loose cards by rank.
  function handLayout(s) {
    const b = bestMelds(s.hand), order = [];
    b.melds.forEach((m, i) => m.slice().sort((a, c) => rank(a) - rank(c) || a - c).forEach((c) => order.push({ c, meld: i })));
    b.loose.slice().sort((a, c) => rank(a) - rank(c) || a - c).forEach((c) => order.push({ c, meld: -1 }));
    const perRow = order.length > 6 ? Math.ceil(order.length / 2) : order.length;
    return order.map((o, i) => {
      const row = Math.floor(i / perRow), inRow = Math.min(perRow, order.length - row * perRow);
      const x0 = Math.round((W - (inRow * (CARD_W + 5) - 5)) / 2);
      return { ...o, x: x0 + (i % perRow) * (CARD_W + 5), y: HAND_Y + row * (CARD_H + 8) };
    });
  }
  function buttons(s) {
    const y = 600, h = 46;
    if (s.phase === 'draw') {
      const top = s.pile[s.pile.length - 1];
      return [
        { cmd: 'stock', x: 18, y, w: 140, h, t: 'DRAW', sub: `${s.deck.length} in stock`, on: true },
        { cmd: 'pile', x: 170, y, w: 140, h, t: top === undefined ? 'TAKE' : 'TAKE ' + label(top), sub: 'top of the pile', on: top !== undefined },
        { cmd: 'ask', x: 322, y, w: 140, h, t: s.sel >= 0 ? `ASK ${RANKS[rank(s.sel)]}s` : 'ASK', sub: s.sel >= 0 ? 'go fish if not' : 'pick a card first', on: s.sel >= 0 },
      ];
    }
    if (s.phase === 'discard') {
      const ok = s.sel >= 0 && s.sel !== s.fromPile, dw = ok ? deadwood(s.hand.filter((c) => c !== s.sel)) : -1;
      return [
        { cmd: 'discard', x: 18, y, w: 216, h, t: 'DISCARD', sub: ok ? `leaves ${dw} deadwood` : 'pick a card', on: ok },
        { cmd: 'knock', x: 246, y, w: 216, h, t: 'KNOCK', sub: ok ? (dw <= knockLimit(s) ? (dw ? `with ${dw} deadwood` : 'GIN!') : `needs ${knockLimit(s)} or less`) : `at ${knockLimit(s)} or less`, on: ok && dw <= knockLimit(s) },
      ];
    }
    return [];
  }
  const inBox = (p, b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
  const LOOT_Y = 300, LOOT_H = 84;

  function step(s, input) {
    s.fx = [];
    if (s.over) return s;
    s.tick++;
    input = input || {};
    if (s.freshT > 0) s.freshT--;
    const pressed = !!(input.actionPressed || (input.action && !s.prev.action));
    const prev = s.prev, edge = (key) => !!input[key] && !prev[key];
    s.prev = { action: !!input.action, left: !!input.left, right: !!input.right, up: !!input.up, down: !!input.down };
    if (s.phase === 'gob' && --s.wait <= 0) {
      if (s.gobStep === 'draw') goblinDraw(s); else goblinDiscard(s);
      return s;
    }
    if (input.command) { act(s, input.command, input.card); return s; }
    const p = input.pointer;
    if (pressed && p) {
      if (s.phase === 'result') act(s, 'next');
      else if (s.phase === 'loot') { for (let i = 0; i < s.offer.length; i++) if (inBox(p, { x: 30, y: LOOT_Y + i * (LOOT_H + 10), w: 420, h: LOOT_H })) act(s, 'loot', i); }
      else if (s.phase === 'draw' || s.phase === 'discard') {
        const hit = handLayout(s).find((o) => inBox(p, { x: o.x, y: o.y, w: CARD_W, h: CARD_H }));
        if (hit) act(s, 'select', hit.c);
        const b = buttons(s).find((b) => inBox(p, b));
        if (b && b.on) act(s, b.cmd, s.sel);
      }
    } else if (s.phase === 'result') { if (pressed) act(s, 'next'); }
    else if (s.phase === 'loot') {
      if (edge('left')) s.cursor = (s.cursor + s.offer.length - 1) % s.offer.length;
      if (edge('right') || edge('down')) s.cursor = (s.cursor + 1) % s.offer.length;
      if (edge('up')) s.cursor = (s.cursor + s.offer.length - 1) % s.offer.length;
      if (pressed) act(s, 'loot', s.cursor);
    } else if (s.phase === 'draw' || s.phase === 'discard') {
      // Keys: left and right walk the hand. Drawing: up draws, down takes the pile, space asks.
      // Discarding: space discards the card, up knocks with it.
      const lay = handLayout(s);
      let at = lay.findIndex((o) => o.c === s.sel);
      if (edge('left')) { at = at < 0 ? lay.length - 1 : Math.max(0, at - 1); s.sel = lay[at].c; }
      if (edge('right')) { at = at < 0 ? 0 : Math.min(lay.length - 1, at + 1); s.sel = lay[at].c; }
      if (s.phase === 'draw') {
        if (edge('up')) act(s, 'stock');
        else if (edge('down')) act(s, 'pile');
        else if (pressed && s.sel >= 0) act(s, 'ask', s.sel);
      } else {
        if (pressed && s.sel >= 0) act(s, 'discard', s.sel);
        else if (edge('up') && s.sel >= 0) act(s, 'knock', s.sel);
      }
    }
    return s;
  }

  // --- a casual player for the headless playtest: sees only what you see --------------------
  // It takes the upcard when it makes a meld, asks when it knows the goblin holds a rank it
  // wants (and sometimes on a hunch with a pair), otherwise draws. It discards whatever leaves
  // the least deadwood and knocks the moment it can.
  function bot(s) {
    if (s.over || s.tick % 18) return {};
    if (s.phase === 'result') return { command: 'next' };
    if (s.phase === 'loot') {
      const want = s.hp < s.maxHp * 0.45 ? 'toad' : null;
      const i = s.offer.findIndex((t) => TRINKETS[t].key === want);
      return { command: 'loot', card: i >= 0 ? i : 0 };
    }
    if (s.phase === 'draw') {
      const top = s.pile[s.pile.length - 1], k = s.know;
      if (top !== undefined && bestMelds([...s.hand, top]).melds.some((m) => m.includes(top))) return { command: 'pile' };
      const loose = bestMelds(s.hand).loose;
      const known = loose.find((c) => k.gobRanks.includes(rank(c)) || k.gobCards.some((g) => rank(g) === rank(c)));
      if (known !== undefined) return { command: 'ask', card: known };
      const pair = loose.find((c) => loose.some((d) => d !== c && rank(d) === rank(c)));
      const hunch = ((s.tick * 2654435761) >>> 0) / 4294967296;
      if (pair !== undefined && hunch < 0.5) return { command: 'ask', card: pair };
      return { command: 'stock' };
    }
    if (s.phase === 'discard') {
      const b = bestDiscard(s.hand, s.fromPile);
      return { command: b.dw <= knockLimit(s) ? 'knock' : 'discard', card: b.card };
    }
    return {};
  }

  function metrics(s) {
    const st = s.stats;
    return {
      score: s.score, rooms: s.cleared, won: s.won ? 1 : 0, hands: s.hands, gins: st.gins, knocks: st.knocks,
      knock_deadwood: st.knocks ? Math.round((st.knockDeadwood / st.knocks) * 10) / 10 : 0,
      undercuts: st.undercuts, undercut_against: st.undercutAgainst, asks: st.asks,
      ask_hit_rate: st.asks ? Math.round((st.askHits / st.asks) * 100) / 100 : 0,
      washes: st.washes, bites: st.bites, damage_dealt: st.dealt, damage_taken: st.taken, hp: s.hp,
    };
  }

  // ==========================================================================================
  // Drawing. Nothing below changes state.
  // ==========================================================================================
  const INK = '#284438', RED = '#aa544e', FACE = '#e9e4cc', TABLE = '#142c2b', MUTED = '#a3ba8b', BRASS = '#c6aa70', CREAM = '#efe9ce';
  const MELD_COLS = ['#d9a54f', '#7fc6bd', '#c98bd6', '#e27d6a'];
  function box(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
  function text(c, t, x, y, size, col, align, weight) {
    c.fillStyle = col || CREAM; c.font = `${weight || 700} ${size}px system-ui, sans-serif`; c.textAlign = align || 'left'; c.fillText(t, x, y);
  }
  function round(c, x, y, w, h, r, col) {
    c.fillStyle = col; c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h); c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r); c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.fill();
  }
  function face(c, card, x, y, w, h, o) {
    o = o || {};
    round(c, x + 1, y + 3, w, h, 6, '#0b211e');
    round(c, x, y, w, h, 6, o.ring || '#33564a');
    round(c, x + 2, y + 2, w - 4, h - 4, 5, o.lift ? '#fff4d2' : FACE);
    const col = suit(card) % 2 ? RED : INK, big = w > 50;
    text(c, RANKS[rank(card)], x + 7, y + (big ? 24 : 17), big ? 20 : 14, col);
    text(c, SUITS[suit(card)], x + w / 2, y + h * (big ? 0.68 : 0.78), big ? 28 : 16, col, 'center');
    if (o.dim) round(c, x + 2, y + 2, w - 4, h - 4, 5, 'rgba(20,44,43,0.35)');
  }
  function back(c, x, y, w, h) {
    round(c, x + 1, y + 3, w, h, 5, '#0b211e');
    round(c, x, y, w, h, 5, '#5f7f63');
    round(c, x + 3, y + 3, w - 6, h - 6, 4, '#2c4e46');
    c.strokeStyle = '#86a08a'; c.lineWidth = 1; c.beginPath();
    c.moveTo(x + w / 2, y + 8); c.lineTo(x + w - 7, y + h / 2); c.lineTo(x + w / 2, y + h - 8); c.lineTo(x + 7, y + h / 2); c.closePath(); c.stroke();
  }
  // A goblin face: ears, a lumpy head, yellow eyes, a grin with two teeth.
  function goblinFace(c, g, x, y, sc, mood) {
    const skin = g.skin, dark = '#1d302a';
    c.save(); c.translate(x, y); c.scale(sc, sc);
    c.fillStyle = dark;
    c.beginPath(); c.moveTo(-22, -4); c.lineTo(-46, -20); c.lineTo(-20, 8); c.fill();
    c.beginPath(); c.moveTo(22, -4); c.lineTo(46, -20); c.lineTo(20, 8); c.fill();
    c.fillStyle = skin;
    c.beginPath(); c.moveTo(-21, -3); c.lineTo(-42, -17); c.lineTo(-20, 5); c.fill();
    c.beginPath(); c.moveTo(21, -3); c.lineTo(42, -17); c.lineTo(20, 5); c.fill();
    c.fillStyle = dark; c.beginPath(); c.ellipse(0, 2, 25, 24, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = skin; c.beginPath(); c.ellipse(0, 2, 23, 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(6, 10, 16, 12, 0, 0, Math.PI * 2); c.fill();
    const squint = mood === 'glad' ? 2.5 : mood === 'sore' ? 5 : 4;
    for (const ex of [-9, 9]) {
      c.fillStyle = '#f3d36b'; c.beginPath(); c.ellipse(ex, -3, 6, squint, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = dark; c.beginPath(); c.arc(ex + 1, -3, 2, 0, Math.PI * 2); c.fill();
    }
    if (mood === 'sore') { c.strokeStyle = dark; c.lineWidth = 2; c.beginPath(); c.moveTo(-15, -11); c.lineTo(-4, -8); c.moveTo(15, -11); c.lineTo(4, -8); c.stroke(); }
    c.fillStyle = dark; c.beginPath(); c.moveTo(-11, 10); c.quadraticCurveTo(0, mood === 'sore' ? 13 : 21, 11, 10); c.fill();
    c.fillStyle = '#f4efd8'; c.fillRect(-7, 10, 4, 4); c.fillRect(4, 10, 4, 4);
    c.fillStyle = dark; c.beginPath(); c.ellipse(0, 4, 3, 2, 0, 0, Math.PI * 2); c.fill();
    if (g.crown) {
      c.fillStyle = '#e8c35c'; c.beginPath(); c.moveTo(-16, -17); c.lineTo(-16, -30); c.lineTo(-8, -22); c.lineTo(0, -34);
      c.lineTo(8, -22); c.lineTo(16, -30); c.lineTo(16, -17); c.closePath(); c.fill();
      c.fillStyle = '#b04a6a'; c.beginPath(); c.arc(0, -22, 2.5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  function bar(c, x, y, w, h, v, max, col, t) {
    round(c, x, y, w, h, 4, '#0c231f');
    if (v > 0) round(c, x + 2, y + 2, Math.max(4, (w - 4) * v / max), h - 4, 3, col);
    text(c, t, x + w / 2, y + h - 5, 12, '#fff6dc', 'center');
  }
  function wrap(c, t, x, y, width, size, col, lineH) {
    c.font = `600 ${size}px system-ui, sans-serif`;
    let line = '';
    for (const word of t.split(' ')) {
      const next = line ? line + ' ' + word : word;
      if (c.measureText(next).width > width && line) { text(c, line, x, y, size, col, 'left', 600); y += lineH; line = word; }
      else line = next;
    }
    if (line) text(c, line, x, y, size, col, 'left', 600);
  }

  function render(s, c, ui) {
    const g = goblin(s), k = s.know;
    box(c, 0, 0, W, H, TABLE);
    for (let y = 0; y < H; y += 24) for (let x = (y % 48 ? 12 : 0); x < W; x += 24) box(c, x, y, 2, 2, '#1b3634');
    // Header.
    box(c, 20, 18, 3, 40, BRASS);
    text(c, 'GOBLINS!', 32, 44, 28, CREAM);
    text(c, `GOBLIN ${s.room + 1} OF ${GOBLINS.length}`, W - 20, 36, 12, MUTED, 'right');
    const r = ui && ui.rank;
    if (r) text(c, (r.fresh && s.tick % 20 < 10 ? 'LEVEL UP · ' : '') + 'LV ' + r.level, W - 20, 54, 11, r.fresh ? BRASS : MUTED, 'right');

    // The goblin.
    round(c, 14, 70, 452, 96, 10, '#1d3a36');
    const res = s.result, mood = s.over ? (s.won ? 'sore' : 'glad') : res && res.winner ? (res.winner === 'gob' ? 'glad' : 'sore') : '';
    goblinFace(c, g, 64, 118, 0.95, mood);
    text(c, g.name, 116, 97, 19, CREAM);
    text(c, g.title.toUpperCase(), 116 + c.measureText(g.name).width + 8, 97, 11, BRASS);
    text(c, g.trait, 116, 116, 12, MUTED, 'left', 600);
    bar(c, 116, 128, 334, 22, s.foeHp, s.foeMax, '#d7a774', `${s.foeHp} / ${s.foeMax}`);

    // The last things that happened, newest first.
    round(c, 14, 656, 452, 56, 8, '#10262a');
    wrap(c, s.log[0] || '', 24, 675, 432, 13, CREAM, 16);
    if (s.log[1]) wrap(c, s.log[1], 24, 704, 432, 11, '#7e968a', 14);

    // Between hands a panel takes the table's place.
    if (s.over) { drawOver(c, s, g, ui); return; }
    if (s.phase === 'result' && res) { drawResult(c, s, g); return; }
    if (s.phase === 'loot') { drawLoot(c, s); return; }

    // Its hand: backs, except the cards you have seen go into it.
    const gw = 34, gh = 48, gx = Math.round((W - (s.gob.length * (gw + 4) - 4)) / 2);
    s.gob.forEach((card, i) => {
      const x = gx + i * (gw + 4);
      if (k.gobCards.includes(card)) face(c, card, x, 176, gw, gh, { ring: BRASS });
      else back(c, x, 176, gw, gh);
    });
    const hints = k.gobRanks.filter((rk) => !k.gobCards.some((x) => rank(x) === rk)).map((rk) => RANKS[rk]);
    const hint = [k.gobCards.length ? 'GOLD: CARDS YOU SAW IT TAKE' : '', hints.length ? `IT ASKED FOR ${hints.join(' · ')}` : ''].filter(Boolean).join('   ');
    text(c, hint, W / 2, 240, 11, BRASS, 'center');

    // The table: stock and pile.
    back(c, 150, 252, 56, 78);
    text(c, `${s.deck.length}`, 178, 346, 12, MUTED, 'center');
    if (has(s, 'rat') && s.deck.length) { face(c, s.deck[s.deck.length - 1], 108, 262, 34, 48, {}); text(c, 'RAT', 125, 322, 9, BRASS, 'center'); }
    if (s.pile.length > 1) face(c, s.pile[s.pile.length - 2], 262, 250, 56, 78, { dim: true });
    if (s.pile.length) face(c, s.pile[s.pile.length - 1], 270, 254, 56, 78);
    text(c, 'STOCK', 178, 362, 10, MUTED, 'center');
    text(c, 'PILE', 298, 362, 10, MUTED, 'center');

    // You.
    bar(c, 18, 368, 150, 20, s.hp, s.maxHp, '#7ea860', `YOU ${s.hp}`);
    s.trinkets.forEach((key, i) => text(c, TRINKETS.find((t) => t.key === key).name, W - 18, 266 + i * 16, 11, MUTED, 'right', 600));
    const dw = deadwood(s.hand);
    text(c, `DEADWOOD ${dw}`, W - 18, 383, 13, dw <= knockLimit(s) ? '#bde38f' : CREAM, 'right');
    for (const o of handLayout(s)) {
      const sel = o.c === s.sel, fresh = o.c === s.fresh && s.freshT > 0, y = o.y - (sel ? 8 : 0);
      face(c, o.c, o.x, y, CARD_W, CARD_H, { ring: sel ? BRASS : fresh ? '#bde38f' : '#33564a', lift: sel });
      if (o.meld >= 0) box(c, o.x + 6, y + CARD_H - 9, CARD_W - 12, 4, MELD_COLS[o.meld % MELD_COLS.length]);
      else text(c, String(value(o.c)), o.x + CARD_W - 7, y + CARD_H - 8, 10, '#9a8f73', 'right');
      if (o.c === s.fromPile) text(c, 'TAKEN', o.x + CARD_W / 2, y - 3, 9, BRASS, 'center');
    }

    // Buttons, or whose turn it is.
    for (const b of buttons(s)) {
      round(c, b.x, b.y + 4, b.w, b.h, 8, '#0c231f');
      round(c, b.x, b.y, b.w, b.h, 8, b.on ? (b.cmd === 'knock' ? '#bc935c' : '#456752') : '#2a4540');
      text(c, b.t, b.x + b.w / 2, b.y + 22, 16, b.on ? '#fff2cf' : '#7d9486', 'center');
      text(c, b.sub, b.x + b.w / 2, b.y + 38, 10, b.on ? '#d9e4c4' : '#6f8579', 'center', 600);
    }
    if (s.phase === 'gob') text(c, `${g.name} is thinking…`, W / 2, 628, 15, BRASS, 'center');
  }
  // One side's hand after a knock: melds, then loose cards (dimmed, red rim), then any cards
  // it laid onto the knocker's melds (gold rim).
  function meldRow(c, view, x, y) {
    let at = x;
    for (const m of view.melds) { for (const card of m) { face(c, card, at, y, 30, 42, {}); at += 26; } at += 10; }
    for (const card of view.loose) { face(c, card, at, y, 30, 42, { dim: true, ring: '#8a4a42' }); at += 26; }
    if (view.laid.length) {
      at += 10;
      for (const card of view.laid) { face(c, card, at, y, 30, 42, { ring: BRASS }); at += 26; }
      text(c, 'LAID OFF', at - 13 * view.laid.length - 2, y + 54, 9, BRASS, 'center');
    }
  }
  function drawResult(c, s, g) {
    const r = s.result;
    round(c, 14, 176, 452, 470, 12, '#0f2624');
    const head = r.kind === 'wash' ? 'A WASH' : r.kind === 'gin' ? 'GIN!' : r.kind === 'undercut' ? 'UNDERCUT!' : 'KNOCK';
    text(c, head, W / 2, 220, 32, r.kind === 'wash' ? MUTED : r.winner === 'you' ? '#bde38f' : '#e8876f', 'center');
    const kn = r.knocker === 'you' ? 'You' : g.name, df = r.knocker === 'you' ? g.name : 'you';
    const kdw = r.knocker === 'you' ? r.you.deadwood : r.gob.deadwood, ddw = r.knocker === 'you' ? r.gob.deadwood : r.you.deadwood;
    const line = r.kind === 'wash' ? 'The stock ran dry. Nobody scores.'
      : r.kind === 'gin' ? `${kn} went gin: no deadwood at all`
      : r.kind === 'undercut' ? `${kn} knocked with ${kdw}, but ${df} got down to ${ddw}`
      : `${kn} knocked with ${kdw}; ${df} ${df === 'you' ? 'were' : 'was'} left with ${ddw}`;
    text(c, line, W / 2, 248, 14, CREAM, 'center', 600);
    text(c, `YOU · ${r.you.deadwood} DEADWOOD`, 30, 290, 11, MUTED);
    meldRow(c, r.you, 30, 298);
    text(c, `${g.name.toUpperCase()} · ${r.gob.deadwood} DEADWOOD`, 30, 382, 11, MUTED);
    meldRow(c, r.gob, 30, 390);
    if (r.kind !== 'wash') {
      round(c, 30, 470, 420, 76, 10, '#1d3a36');
      text(c, r.math + ' =', W / 2, 498, 14, MUTED, 'center', 600);
      text(c, `${r.points} damage to ${r.winner === 'you' ? g.name : 'you'}`, W / 2, 530, 22, r.winner === 'you' ? '#bde38f' : '#e8876f', 'center');
    }
    const next = s.hp <= 0 ? 'Tap or Space to see how it ended' : s.foeHp <= 0 ? `${g.name} is out of the game! Tap or Space` : 'Tap or Space to deal the next hand';
    text(c, next, W / 2, 604, 14, BRASS, 'center');
  }
  function drawLoot(c, s) {
    round(c, 14, 176, 452, 470, 12, '#0f2624');
    text(c, 'TAKE A TRINKET', W / 2, 226, 26, BRASS, 'center');
    const next = GOBLINS[s.room + 1];
    text(c, `You healed ${CONFIG.roomHeal}. Next: ${next.name} ${next.title}.`, W / 2, 254, 13, MUTED, 'center', 600);
    text(c, next.trait, W / 2, 274, 12, '#7e968a', 'center', 600);
    s.offer.forEach((t, i) => {
      const y = LOOT_Y + i * (LOOT_H + 10), on = i === s.cursor;
      round(c, 30, y, 420, LOOT_H, 10, on ? '#4d6f55' : '#365640');
      if (on) box(c, 30, y + 12, 4, LOOT_H - 24, BRASS);
      text(c, TRINKETS[t].name, 50, y + 34, 19, CREAM);
      text(c, TRINKETS[t].text, 50, y + 58, 13, '#bcd19b', 'left', 600);
    });
  }
  function drawOver(c, s, g, ui) {
    round(c, 14, 176, 452, 470, 12, '#0f2624');
    goblinFace(c, s.won ? GOBLINS[GOBLINS.length - 1] : g, W / 2, 262, 1.2, s.won ? 'sore' : 'glad');
    text(c, s.won ? 'THE WARREN IS YOURS' : 'OUT-PLAYED', W / 2, 350, 28, s.won ? '#bde38f' : '#e8876f', 'center');
    text(c, s.won ? 'All five goblins folded.' : `${g.name} ${g.title} took your last health.`, W / 2, 378, 14, CREAM, 'center', 600);
    text(c, `${s.cleared} of ${GOBLINS.length} goblins beaten · ${s.score} points`, W / 2, 420, 16, CREAM, 'center');
    const st = s.stats;
    const n = (v, one) => `${v} ${one}${v === 1 ? '' : 's'}`;
    text(c, `${n(s.hands, 'hand')} · ${n(st.gins, 'gin')} · ${n(st.knocks, 'knock')} · ${n(st.undercuts, 'undercut')}`, W / 2, 448, 12, MUTED, 'center', 600);
    if (ui && ui.best) text(c, `BEST ${ui.best}`, W / 2, 480, 13, BRASS, 'center');
    text(c, 'Space or tap for a new run', W / 2, 604, 15, BRASS, 'center');
  }

  globalThis.Game = {id: "goblins",
    guide: {
  "version": 1,
  "summary": "Existing owner implementation: ten-card gin plus asking for a held rank; sets/runs reduce deadwood.",
  "goal": "Defeat all five goblins using points from completed hands as damage.",
  "lose": "Health reaches zero or the 80-hand cap is reached. Low stock washes a hand; it does not silently count as victory.",
  "rules": [
    "Existing owner implementation: ten-card gin plus asking for a held rank; sets/runs reduce deadwood. Aces low, face cards ten. Knock at <=10 after discard, gin at zero; layoff except against gin, undercut on tied/lower defender deadwood. Five goblins, carried health and inter-room trinkets. Existing trinkets can visibly override base rules.",
    "A failed ask draws a card and costs a bite; asking also reveals information.",
    "You cannot immediately discard the card just taken from the pile.",
    "Defenders may lay off except against gin; equal or lower deadwood undercuts the knocker.",
    "Read active trinket overrides before relying on the base knock limit."
  ],
  "controls": [
    {
      "action": "Select card",
      "keyboard": "Left / Right",
      "touch": "Tap card"
    },
    {
      "action": "Draw / take / ask",
      "keyboard": "Up / Down / Space in draw phase",
      "touch": "DRAW / TAKE / ASK"
    },
    {
      "action": "Discard / knock",
      "keyboard": "Space / Up in discard phase",
      "touch": "DISCARD / KNOCK"
    }
  ],
  "firstSteps": [
    "Read your melds and deadwood, then draw or take a discard.",
    "Discard a card; knock only when your remaining deadwood permits it."
  ],
  "tips": [
    "Knocking can be undercut if the defender lays off to equal or lower deadwood; gin prevents layoff."
  ],
  "modes": []
},

    title: 'Goblins!', width: W, height: H, init, step, bot, render, metrics, autoJuice: false,
    rules: { rank, suit, value, isMeld, candidates, bestMelds, deadwood, layOff, bestDiscard, act, ask, resolve, GOBLINS, TRINKETS, CONFIG },
  };
})();
