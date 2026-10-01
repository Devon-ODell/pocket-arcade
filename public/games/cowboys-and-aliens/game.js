// game.js — Cowboys & Aliens. A retro first-person western horde shooter: hold a dusty
// frontier town against rounds of zombie-cowboys, a sheriff boss with six slow, bad shots
// in the revolver, and alien queens whose aura buffs everything near them. Zombies-style
// economy: points, wall buys, buyable doors, random drops on kill. Raycast renderer,
// chunky pixels, big HUD.
// Contract (docs/GAME_CONTRACT.md): classic script, no DOM, no Math.random, no Date;
// every piece of state is plain JSON inside the state object.
(function () {
  'use strict';

  const CONFIG = /*CONFIG*/{
    "title": "Cowboys & Aliens",
    "tagline": "Hold the town. Six shots at a time.",
    "maxRounds": 30
  }/*END*/;

  const W = 480, H = 720, DT = 1 / 60;
  const DEG = Math.PI / 180;
  const TWO_PI = Math.PI * 2;
  const RW = 240, RH = 360;          // internal raycast buffer, scaled 2x to the canvas
  const WH = 2.6;                    // wall height in metres
  const EYE = 1.62;                  // eye height in metres

  // ---- RNG (mulberry32; the seed lives in state so it survives JSON) ----------
  function rand(o, key) {
    let t = (o[key] = (o[key] + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---- Sound (browser only; the headless harness has no studioSound) ----------
  function sfx(name) {
    if (typeof globalThis.studioSound === 'undefined' || !globalThis.studioSound) return;
    try { globalThis.studioSound.play(name); } catch (e) { /* the game still plays */ }
  }

  // ---- Map --------------------------------------------------------------------
  // Passable = 0. Wall codes: 1 saloon, 2 storefront, 3 jail, 4 bowling, 5 laundry,
  // 6 crate, 7 door (openable), 8 alien crystal, C storefront awning, S saloon sign.
  const MAP_STR = [
    "####################",
    "#......#........#..#",
    "#......#..6...6.#..#",
    "#..##..D.6.6...#...#",
    "#..##..#........#..#",
    "#......#.......#...#",
    "#...4..#...L...#...#",
    "#...4..D...L...D...#",
    "#...4..#...L...#...#",
    "#......#...D...#...#",
    "#..6.............6.#",
    "#..6....S..S....6..#",
    "#......C......C.....",
    "#......C......C....#",
    "#......#..8...#....#",
    "#..###....8..###.#..",
    "#..#..............D.",
    "#..#..7........7.#.#",
    "D..#..#........#.#.#",
    "#..............#...#",
    "####################",
  ];
  const MAP_W = 20, MAP_H = 21;
  const MAP = [];
  for (let y = 0; y < MAP_H; y++) {
    const row = [];
    for (let x = 0; x < MAP_W; x++) {
      const c = MAP_STR[y][x];
      row.push(c === '#' ? 1 : c === '4' ? 4 : c === 'L' ? 5 : c === '6' ? 6 :
        c === '7' ? 7 : c === '8' ? 8 : c === 'C' ? 2 : c === 'S' ? 3 : 0);
    }
    MAP.push(row);
  }
  // Door tiles keyed "x,y" -> district: 1 laundromat (600), 2 bowling alley (900),
  // 3 stables (750). Every 7 tile in the map is here, so every door can open.
  const DOORS = { "7,3": 2, "7,7": 1, "16,7": 1, "12,9": 1, "18,16": 3, "6,17": 2, "15,17": 2, "0,18": 3 };
  const DOOR_COST = { 1: 600, 2: 900, 3: 750 };
  const DOOR_NAME = { 1: 'LAUNDROMAT', 2: 'BOWLING ALLEY', 3: 'STABLES' };

  function tileAt(x, y) {
    return (MAP[y] && MAP[y][x]) || 0;
  }

  function solidAt(state, x, y) {
    const t = tileAt(x, y);
    if (!t) return false;
    if (t !== 7) return true;
    return !state.doors[x + ',' + y];   // closed doors are solid
  }

  function losClear(state, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist * 3);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (solidAt(state, Math.floor(x0 + dx * t), Math.floor(y0 + dy * t))) return false;
    }
    return true;
  }

  // ---- Weapons ----------------------------------------------------------------
  const WEAPONS = {
    hunting_knife:  { name: 'HUNTING KNIFE',    kind: 'melee',   dmg: 55,  rate: 0.5,  range: 1.9, arc: 60 * DEG, cost: 250 },
    rusty_knuckles:{ name: 'RUSTY KNUCKLES',   kind: 'melee',   dmg: 110, rate: 1.1,  range: 1.6, arc: 45 * DEG, cost: 500 },
    six_shooter:    { name: 'SIX SHOOTER',      kind: 'pistol',  dmg: 45,  rate: 0.42, range: 26, mag: 6,  ammoMax: 66,  reload: 2.6, spread: 3.5, pellets: 1, auto: false, cost: 0,    kick: 0.05 },
    m1911:          { name: '1911 OFFICER',     kind: 'pistol',  dmg: 34,  rate: 0.16, range: 24, mag: 7,  ammoMax: 63,  reload: 1.9, spread: 2.6, pellets: 1, auto: false, cost: 750,  kick: 0.035 },
    double_barrel:  { name: 'COACH GUN',        kind: 'shotgun', dmg: 34,  rate: 0.9,  range: 13, mag: 2,  ammoMax: 30,  reload: 2.7, spread: 9,   pellets: 7, auto: false, cost: 1000, kick: 0.09 },
    trench_sweeper: { name: 'TRENCH SWEEPER',   kind: 'shotgun', dmg: 26,  rate: 0.75, range: 15, mag: 6,  ammoMax: 54,  reload: 3.2, spread: 8,   pellets: 6, auto: false, cost: 1250, kick: 0.07 },
    lever_action:   { name: 'FRONTIER SPECIAL', kind: 'rifle',   dmg: 95,  rate: 0.55, range: 34, mag: 9,  ammoMax: 72,  reload: 3.0, spread: 1.4, pellets: 1, auto: false, cost: 1500, kick: 0.07 },
    m16_carbine:    { name: 'M16 CARBINE',      kind: 'rifle',   dmg: 38,  rate: 0.09, range: 32, mag: 20, ammoMax: 120, reload: 2.8, spread: 2.2, pellets: 1, auto: true,  cost: 1800, kick: 0.03 },
    ray_blaster:    { name: 'RAY BLASTER',      kind: 'laser',   dmg: 60,  rate: 0.2,  range: 30, mag: 12, ammoMax: 96,  reload: 2.2, spread: 1.5, pellets: 1, auto: false, cost: 2200, kick: 0.04, color: '#66ffe6' },
    plasma_scatter: { name: 'PLASMA SCATTERGUN',kind: 'laser',   dmg: 30,  rate: 0.85, range: 16, mag: 8,  ammoMax: 64,  reload: 2.9, spread: 10,  pellets: 6, auto: false, cost: 2500, kick: 0.08, color: '#b48cff' },
  };
  const WALL_BUYS = [
    { id: 'hunting_knife',  cost: 250,  x: 2.5,  y: 17.5 },
    { id: 'rusty_knuckles',cost: 500,  x: 4.5,  y: 1.5 },
    { id: 'm1911',          cost: 750,  x: 15.5, y: 1.5 },
    { id: 'double_barrel',  cost: 1000, x: 18.5, y: 17.5 },
    { id: 'trench_sweeper', cost: 1250, x: 8.5,  y: 7.5 },
    { id: 'lever_action',   cost: 1500, x: 12.5, y: 7.5 },
    { id: 'm16_carbine',    cost: 1800, x: 15.5, y: 13.5 },
    { id: 'ray_blaster',    cost: 2200, x: 13.5, y: 14.5 },
    { id: 'plasma_scatter', cost: 2500, x: 2.5,  y: 9.5 },
  ];
  const DROPS = ['ammo', 'health', 'nuka', 'insta', 'nuke', 'max_ammo'];
  const DROP_WEIGHTS = { ammo: 22, health: 14, nuka: 14, insta: 14, nuke: 3, max_ammo: 3 };

  // ---- Aliens / undead ----------------------------------------------------------
  // walker: zombie-cowboy. screamer: ranged alien from round 3. sheriff: boss every
  // 5th round, six slow revolver shots with wide, bad aim. queen: from round 7, slow,
  // huge, hard melee, and her aura buffs speed + damage of every alien within 6 m.
  const KINDS = {
    walker:   { dmg: 7,  radius: 0.32, rate: 1.0, pts: 60,  h: 1.75, w: 0.55 },
    screamer: { dmg: 11, radius: 0.3,  rate: 2.4, pts: 90,  h: 1.7,  w: 0.5,  ranged: true },
    sheriff:  { dmg: 15, radius: 0.34, rate: 1.1, pts: 400, h: 1.85, w: 0.6,  ranged: true, boss: true },
    queen:    { dmg: 32, radius: 0.5,  rate: 1.8, pts: 600, h: 2.3,  w: 0.95, queen: true },
  };

  function kindStats(kind, round) {
    const k = KINDS[kind];
    const hp = kind === 'walker' ? 55 + 45 * (round - 1)
      : kind === 'screamer' ? 40 + 30 * (round - 1)
      : kind === 'sheriff' ? 900 + 700 * Math.max(0, round - 5) / 5
      : 1500 + 900 * Math.max(0, round - 7) / 7;
    const speed = kind === 'walker' ? Math.min(1.9, 1.05 + 0.05 * (round - 1))
      : kind === 'screamer' ? 0.9 : k === KINDS.sheriff ? 0.85 : 0.55;
    return { hp, speed, dmg: k.dmg, rate: k.rate, radius: k.radius };
  }

  function roundComposition(round) {
    const count = 4 + 2 * round;
    const screamers = round >= 4 ? Math.min(6, Math.floor(round / 3)) : 0;
    const sheriffs = round >= 5 && round % 5 === 0 ? (round >= 15 ? 2 : 1) : 0;
    const queens = round >= 7 ? 1 + Math.floor((round - 7) / 3) : 0;
    return { count, screamers, sheriffs, queens };
  }

  // ---- State ------------------------------------------------------------------
  function init(seed) {
    return {
      rng: (seed >>> 0) || 1, tick: 0, over: false, won: false, phase: 'title',
      score: 0, kills: 0, deaths: 0, shots: 0, hits: 0, headshots: 0,
      doors: {}, doorsOpen: 0, wallBuys: 0, dropsTaken: 0,
      bossKills: 0, queenKills: 0, round: 0, roundKillTarget: 0, roundKills: 0,
      roundEnded: false, between: 0, spawnQueue: [], spawnTimer: 0,
      drops: [], zombies: [], corpses: [], gibFx: [], aliFx: [],
      player: null, bot: null, msgs: [], flash: 0, shake: 0,
      dropBuffs: {}, maxRounds: CONFIG.maxRounds, runSeconds: 0,
    };
  }

  function startRun(state) {
    state.phase = 'play';
    state.round = 0;
    state.roundEnded = false;
    state.between = 0;
    state.player = {
      x: 10.5, y: 11.5, yaw: -Math.PI / 2, pitch: 0, hp: 100, maxHp: 100,
      regenDelay: 4, regenRate: 9, hurtCd: 0, bob: 0, lastHurt: -999,
      weapons: ['six_shooter'], slot: 0, ammo: {}, reserve: {},
      meleeCooldown: 0, fireTimer: 0, reloadTimer: 0, recoil: 0, sprinting: false,
      eHeld: false, sprintT: 0,
    };
    for (const id in WEAPONS) {
      const w = WEAPONS[id];
      if (w.kind === 'melee') continue;
      state.player.ammo[id] = w.mag;
      state.player.reserve[id] = id === 'six_shooter' ? 24 : 0;
    }
    state.bot = {
      rng: (state.rng ^ 0x9e3779b9) >>> 0, wx: 10.5, wy: 11.5, mode: 'wander',
      thinkT: 0, strafe: 1, strafeT: 0, stuckT: 0, lastX: 10.5, lastY: 11.5,
      tx: null, ty: null,
    };
    state.msgs = [];
  }

  // ---- Small helpers ------------------------------------------------------------
  function msg(state, text) {
    if (!text) return;
    state.msgs.push({ text, t: 2.6 });
    if (state.msgs.length > 4) state.msgs.shift();
  }

  function weaponId(state) { return state.player.weapons[state.player.slot]; }
  function weaponOf(state) { return WEAPONS[weaponId(state)] || WEAPONS.six_shooter; }

  function giveWeapon(state, id) {
    const p = state.player, w = WEAPONS[id];
    if (p.weapons.indexOf(id) < 0) p.weapons.push(id);
    if (w.kind !== 'melee') {
      p.ammo[id] = w.mag;
      p.reserve[id] = Math.max(p.reserve[id] || 0, Math.floor(w.ammoMax / 3));
    }
    p.slot = p.weapons.length - 1;
    p.switchFlash = 0.3;
  }

  // ---- Movement -----------------------------------------------------------------
  function moveWith(state, e, dx, dy) {
    const r = e.radius || 0.22;
    if (dx) {
      const nx = e.x + dx + Math.sign(dx) * r;
      if (!solidAt(state, Math.floor(nx), Math.floor(e.y))) e.x += dx;
    }
    if (dy) {
      const ny = e.y + dy + Math.sign(dy) * r;
      if (!solidAt(state, Math.floor(e.x), Math.floor(ny))) e.y += dy;
    }
  }

  // ---- Player input ---------------------------------------------------------------
  function handleInput(state, input) {
    const p = state.player;
    const k = input.keys || {};
    if (input.look) {
      p.yaw += (input.look.dx || 0) * 0.0032;
      p.pitch = Math.max(-0.55, Math.min(0.55, p.pitch - (input.look.dy || 0) * 0.0032));
    }
    if (k.ArrowLeft) p.yaw -= 2.4 * DT;
    if (k.ArrowRight) p.yaw += 2.4 * DT;
    let fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    let str = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (input.stick) { fwd += -input.stick.y; str += input.stick.x; }
    fwd = Math.max(-1, Math.min(1, fwd)); str = Math.max(-1, Math.min(1, str));
    p.sprinting = !!(k.ShiftLeft || k.ShiftRight) && fwd > 0;
    const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
    let dx = fwd * cs + str * -sn;
    let dy = fwd * sn + str * cs;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      dx /= len; dy /= len;
      const sp = p.sprinting ? 3.4 : 2.1;
      moveWith(state, p, dx * sp * DT, dy * sp * DT);
      p.bob += DT * (p.sprinting ? 11 : 7);
    } else p.bob += DT * 2;
    // Weapon switching 1..5
    for (let i = 0; i < 5; i++) if (k['Digit' + (i + 1)] && p.weapons[i]) p.slot = i;
    // Soft aim assist toward a target near the crosshair (also helps touch play)
    const w = weaponOf(state);
    const wantFire = w.auto ? !!input.action : !!input.actionPressed;
    if (wantFire) aimAssist(state, 10 * DEG);
    if (wantFire && p.fireTimer <= 0 && p.reloadTimer <= 0) fire(state);
    if (k.KeyF && p.meleeCooldown <= 0) melee(state);
    if (k.KeyR && p.reloadTimer <= 0) startReload(state);
    if (k.KeyE && !p.eHeld) tryInteract(state);
    p.eHeld = !!k.KeyE;
    p.fireTimer -= DT; p.meleeCooldown -= DT;
    if (p.switchFlash > 0) p.switchFlash -= DT;
    if (p.reloadTimer > 0) {
      p.reloadTimer -= DT;
      if (p.reloadTimer <= 0) finishReload(state);
    }
    if (state.tick - p.lastHurt > p.regenDelay * 60 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + p.regenRate * DT);
    }
    if (p.hurtCd > 0) p.hurtCd -= DT;
  }

  function aimAssist(state, cone) {
    const p = state.player;
    let best = null, bestErr = cone;
    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      const ang = Math.atan2(z.y - p.y, z.x - p.x);
      let da = ang - p.yaw;
      while (da > Math.PI) da -= TWO_PI;
      while (da < -Math.PI) da += TWO_PI;
      const err = Math.abs(da);
      if (err < bestErr && losClear(state, p.x, p.y, z.x, z.y)) { bestErr = err; best = da; }
    }
    if (best !== null) p.yaw += best * 0.4;
  }

  // ---- Firing --------------------------------------------------------------------
  function fire(state) {
    const p = state.player, w = weaponOf(state), id = weaponId(state);
    if (w.kind === 'melee') { melee(state); p.fireTimer = w.rate; return; }
    if ((p.ammo[id] || 0) <= 0) { startReload(state); return; }
    p.ammo[id]--;
    state.shots += w.pellets;
    p.fireTimer = w.rate;
    p.recoil = Math.min(0.22, (p.recoil || 0) + (w.kick || 0.03));
    state.shake = Math.min(1, state.shake + (w.kick || 0.03) * 2.4);
    sfx(w.kind === 'laser' ? 'splat' : 'shot');
    state.muzzle = 0.07;
    // shooting straight into a wall from point blank: those pellets cannot hit anything,
    // but they still count. That keeps the metric honest without gating the bot.
    const spreadRad = w.spread * DEG * (p.sprinting ? 2.2 : 1);
    for (let i = 0; i < w.pellets; i++) {
      let off = (w.pellets > 1 ? (i - (w.pellets - 1) / 2) * (spreadRad / Math.max(1, w.pellets - 1.6)) : 0);
      off += (rand(state, 'rng') - 0.5) * spreadRad;
      hitscan(state, p.x, p.y, p.yaw + off, w);
    }
  }

  function hitscan(state, x, y, ang, w) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const wall = ddaWall(state, x, y, dx, dy, w.range);
    // a shot through a doorway should not stop at the doorway's plane once open;
    // ddaWall already skips open doors, so its distance is the true wall stop.
    let best = null, bestD = wall.perp;
    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      const rx = z.x - x, ry = z.y - y;
      const t = rx * dx + ry * dy;
      if (t < 0.1 || t > bestD) continue;
      const px = x + dx * t, py = y + dy * t;
      if (Math.hypot(px - z.x, py - z.y) < z.radius * 1.35) { best = z; bestD = t; }
    }
    if (best) {
      damageZombie(state, best, w.dmg);
      best.hitFlash = 0.12;
    }
  }
  function damageZombie(state, z, dmg) {
    const head = z.kind !== 'queen' && rand(state, 'rng') < 0.28;
    let d = dmg * (head ? 2 : 1);
    if (state.dropBuffs.insta > 0) d = 99999;
    else if (z.kind === 'queen') d = Math.min(d, 120);   // queens tank everything
    state.hits++;                                        // the pellet landed
    z.hp -= d;
    state.score += state.dropBuffs.nuka > 0 ? 20 : 10;
    if (z.hp <= 0) {
      if (head) state.headshots++;
      killZombie(state, z, head);
    }
  }

  function killZombie(state, z, head) {
    state.kills++;
    state.roundKills++;
    const base = KINDS[z.kind].pts * (state.dropBuffs.nuka > 0 ? 2 : 1);
    state.score += base + (head ? 100 : 0);
    if (z.kind === 'sheriff') { state.bossKills++; state.score += 400; }
    if (z.kind === 'queen') { state.queenKills++; state.score += 600; }
    sfx('splat');
    state.corpses.push({ x: z.x, y: z.y, kind: z.kind, t: 0 });
    if (state.corpses.length > 28) state.corpses.shift();
    state.gibFx.push({ x: z.x, y: z.y, t: 0 });
    if (rand(state, 'rng') < 0.08 && state.drops.length < 3) spawnDrop(state, z.x, z.y);
    // every fourth cleared round hands back a last stand
    if (!state.roundEnded && state.roundKills >= state.roundKillTarget && state.spawnQueue.length === 0) {
      if (state.round >= LAST_STAND_ROUNDS && state.round % LAST_STAND_ROUNDS === 0) {
        state.deaths++;
        msg(state, 'THE TOWN FALLS — ' + state.round + ' ROUNDS HELD');
        state.over = true;
        state.won = true;
        sfx('win');
      } else endRound(state);
    }
  }

  function melee(state) {
    const p = state.player, w = weaponOf(state);
    if (w.kind === 'melee') {
      p.meleeCooldown = w.rate;
      swing(state, p, w.dmg, w.range, w.arc);
    } else {
      p.meleeCooldown = 0.45;
      swing(state, p, 55, 1.5, 45 * DEG);   // a haymaker with whatever is in hand
    }
    sfx('thud');
    p.punch = 0.2;
  }

  function swing(state, p, dmg, range, arc) {
    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      const dx = z.x - p.x, dy = z.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > range + z.radius) continue;
      let da = Math.atan2(dy, dx) - p.yaw;
      while (da > Math.PI) da -= TWO_PI;
      while (da < -Math.PI) da += TWO_PI;
      if (Math.abs(da) < arc / 2 && losClear(state, p.x, p.y, z.x, z.y)) {
        damageZombie(state, z, dmg);
        z.hitFlash = 0.15;
      }
    }
  }

  function startReload(state) {
    const p = state.player, w = weaponOf(state), id = weaponId(state);
    if (w.kind === 'melee') return;
    if ((p.ammo[id] || 0) >= w.mag || (p.reserve[id] || 0) <= 0) return;
    p.reloadTimer = w.reload;
    sfx('thud');
  }

  function finishReload(state) {
    const p = state.player, w = weaponOf(state), id = weaponId(state);
    const take = Math.min(w.mag - (p.ammo[id] || 0), p.reserve[id] || 0);
    p.ammo[id] = (p.ammo[id] || 0) + take;
    p.reserve[id] = (p.reserve[id] || 0) - take;
  }

  // ---- Interactions: doors and wall buys ------------------------------------------
  function tryInteract(state) {
    const p = state.player;
    for (const dk in DOORS) {
      const parts = dk.split(',');
      const dxc = Number(parts[0]) + 0.5, dyc = Number(parts[1]) + 0.5;
      if (Math.hypot(dxc - p.x, dyc - p.y) < 1.3 && !state.doors[dk]) {
        const group = DOORS[dk], cost = DOOR_COST[group];
        if (state.score >= cost) {
          for (const k2 in DOORS) if (DOORS[k2] === group) state.doors[k2] = true;
          state.score -= cost;
          state.doorsOpen++;
          msg(state, DOOR_NAME[group] + ' OPEN — ' + cost);
          sfx('thud');
        } else msg(state, 'NEED ' + cost + ' — ' + DOOR_NAME[group]);
        return;
      }
    }
    for (const wb of WALL_BUYS) {
      if (Math.hypot(wb.x - p.x, wb.y - p.y) < 1.15) {
        const w = WEAPONS[wb.id];
        if (p.weapons.indexOf(wb.id) >= 0) {   // ammo refill at the owned wall buy
          if (w.kind === 'melee') { msg(state, w.name + ' READY'); return; }
          p.ammo[wb.id] = w.mag;
          p.reserve[wb.id] = Math.min(w.ammoMax, (p.reserve[wb.id] || 0) + Math.ceil(w.mag / 2));
          msg(state, w.name + ' REFILLED');
          sfx('pick');
          return;
        }
        if (state.score >= wb.cost) {
          state.score -= wb.cost;
          giveWeapon(state, wb.id);
          state.wallBuys++;
          msg(state, w.name + ' — ' + wb.cost);
          sfx('pick');
        } else msg(state, 'NEED ' + wb.cost + ' — ' + w.name);
        return;
      }
    }
  }

  // ---- Drops ----------------------------------------------------------------------
  function spawnDrop(state, x, y) {
    let total = 0;
    for (const k in DROP_WEIGHTS) total += DROP_WEIGHTS[k];
    let roll = rand(state, 'rng') * total;
    let kind = 'ammo';
    for (const k in DROP_WEIGHTS) { roll -= DROP_WEIGHTS[k]; if (roll <= 0) { kind = k; break; } }
    state.drops.push({ x, y, kind, t: 0, ttl: 22 });
    sfx('pick');
  }

  function applyDrop(state, d) {
    const p = state.player;
    d.t = d.ttl + 1;               // take it off the field immediately
    state.dropsTaken++;
    if (d.kind === 'ammo') {
      const id = weaponId(state);
      p.reserve[id] = Math.min(WEAPONS[id].ammoMax || 99, (p.reserve[id] || 0) + (WEAPONS[id].mag || 4));
      msg(state, 'AMMO CACHE');
    } else if (d.kind === 'health') { p.hp = Math.min(p.maxHp, p.hp + 50); msg(state, 'WHISKEY +50'); }
    else if (d.kind === 'nuka') { state.dropBuffs.nuka = 10; msg(state, 'NUGA-COLA: DOUBLE POINTS'); }
    else if (d.kind === 'insta') { state.dropBuffs.insta = 10; msg(state, 'INSTA-KILL'); }
    else if (d.kind === 'nuke') {
      let n = 0;
      for (const z of state.zombies.slice()) if (z.hp > 0) { z.hp = 0; killZombie(state, z, false); n++; }
      state.score += 400;
      msg(state, 'ALIEN NUKE — ' + n + ' DOWN');
      sfx('win');
    } else if (d.kind === 'max_ammo') {
      for (const id in p.reserve) p.reserve[id] = WEAPONS[id].ammoMax || 99;
      msg(state, 'MAX AMMO');
    }
    sfx('pick');
  }

  // ---- Rounds ----------------------------------------------------------------------
  function spawnWave(state) {
    state.round++;
    const comp = roundComposition(state.round);
    state.spawnQueue = [];
    for (let i = 0; i < comp.count - comp.screamers - comp.sheriffs - comp.queens; i++) state.spawnQueue.push('walker');
    for (let i = 0; i < comp.screamers; i++) state.spawnQueue.push('screamer');
    for (let i = 0; i < comp.sheriffs; i++) state.spawnQueue.push('sheriff');
    for (let i = 0; i < comp.queens; i++) state.spawnQueue.push('queen');
    for (let i = state.spawnQueue.length - 1; i > 0; i--) {
      const j = Math.floor(rand(state, 'rng') * (i + 1));
      const t = state.spawnQueue[i]; state.spawnQueue[i] = state.spawnQueue[j]; state.spawnQueue[j] = t;
    }
    state.roundKillTarget = state.spawnQueue.length;
    state.roundKills = 0;
    state.spawnTimer = 0.5;
    msg(state, 'ROUND ' + state.round);
    sfx('clear');
  }

  function endRound(state) {
    state.roundEnded = true;
    state.between = 5;
    msg(state, 'ROUND ' + state.round + ' CLEARED');
    sfx('level');
    const p = state.player;                       // a breather: patch up, top off
    p.hp = Math.min(p.maxHp, p.hp + 45);
    for (const id in p.reserve) {
      const w = WEAPONS[id];
      if (w && w.mag) p.reserve[id] = Math.min(w.ammoMax || 99, (p.reserve[id] || 0) + Math.ceil(w.mag / 2));
    }
  }

  function spawnOne(state) {
    const kind = state.spawnQueue.shift() || 'walker';
    const spots = [];
    for (let i = 0; i < 10; i++) {
      const x = 1.5 + rand(state, 'rng') * (MAP_W - 3);
      const y = 1.5 + rand(state, 'rng') * (MAP_H - 3);
      if (!solidAt(state, Math.floor(x), Math.floor(y))) {
        spots.push({ x, y, d: Math.hypot(x - state.player.x, y - state.player.y) });
      }
    }
    if (!spots.length) { state.spawnQueue.unshift(kind); return; }
    spots.sort((a, b) => Math.abs(a.d - 9) - Math.abs(b.d - 9));
    const s = spots[0];
    const st = kindStats(kind, state.round);
    state.zombies.push({
      kind, x: s.x, y: s.y, hp: st.hp, maxHp: st.hp, speed: st.speed, dmg: st.dmg,
      radius: st.radius, atkTimer: st.rate, hitFlash: 0, wobble: rand(state, 'rng') * TWO_PI,
      telegraph: 0, pendingShot: false, cyl: 0, dead: false,
    });
    state.gibFx.push({ x: s.x, y: s.y, t: -0.25 });
  }

  // ---- Alien / undead AI -------------------------------------------------------------
  function stepZombies(state) {
    const p = state.player;
    // queen aura: one queen buffs every alien within 6 m
    let auraX = null, auraY = null;
    for (const z of state.zombies) if (z.kind === 'queen' && z.hp > 0) { auraX = z.x; auraY = z.y; }
    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      z.hitFlash = Math.max(0, (z.hitFlash || 0) - DT);
      const dx = p.x - z.x, dy = p.y - z.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.05) continue;
      let sp = z.speed, dmgMul = 1;
      if (auraX !== null && z.kind !== 'queen' && Math.hypot(z.x - auraX, z.y - auraY) < 6) { sp *= 1.6; dmgMul = 1.6; }
      const los = losClear(state, z.x, z.y, p.x, p.y);
      if (z.kind === 'walker' || z.kind === 'queen') {
        if (los || d < 8) {
          const beforeX = z.x, beforeY = z.y;
          moveWith(state, z, dx / d * sp * DT, dy / d * sp * DT);
          // walled off: slide along it, and if fully stuck, sidestep on the wobble
          if (Math.hypot(z.x - beforeX, z.y - beforeY) < sp * DT * 0.25) {
            const side = (state.tick + Math.floor(z.wobble * 60)) % 2 ? 1 : -1;
            moveWith(state, z, -dy / d * sp * DT * side, dx / d * sp * DT * side);
            if (Math.hypot(z.x - beforeX, z.y - beforeY) < sp * DT * 0.25) {
              moveWith(state, z, dx / d * sp * DT * 0.8, dy / d * sp * DT * 0.8);
            }
          }
        } else {
          const a = Math.atan2(dy, dx) + Math.sin(state.tick * 0.001 + z.wobble) * 0.7;
          moveWith(state, z, Math.cos(a) * sp * DT, Math.sin(a) * sp * DT);
        }
        z.atkTimer -= DT;
        if (d < z.radius + 0.8 && z.atkTimer <= 0) {
          hurtPlayer(state, z.dmg * dmgMul);
          z.atkTimer = KINDS[z.kind].rate;
        }
      } else {
        const want = z.kind === 'sheriff' ? 7 : 5;
        if (d > want + 1.5) moveWith(state, z, dx / d * sp * DT, dy / d * sp * DT);
        else if (d < want - 2) moveWith(state, z, -dx / d * sp * DT, -dy / d * sp * DT);
        z.atkTimer -= DT;
        if (los && d < (z.kind === 'sheriff' ? 10 : 7) && z.atkTimer <= 0) {
          z.atkTimer = KINDS[z.kind].rate;
          z.telegraph = 0.5; z.pendingShot = true;
          z.cyl = (z.cyl || 0) + 1;
          if (z.kind === 'sheriff' && z.cyl >= 6) { z.atkTimer = 3.2; z.cyl = 0; }  // reload the cylinder
        }
        if (z.pendingShot) {
          z.telegraph -= DT;
          if (z.telegraph <= 0) { z.pendingShot = false; alienShot(state, z, dmgMul); }
        }
      }
    }
    // separation so they do not stack into one pixel
    const zs = state.zombies;
    for (let i = 0; i < zs.length; i++) {
      const a = zs[i];
      if (a.hp <= 0) continue;
      for (let j = i + 1; j < zs.length; j++) {
        const b = zs[j];
        if (b.hp <= 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dd = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (dd > 0.001 && dd < min) {
          const push = (min - dd) / 2;
          moveWith(state, a, -dx / dd * push, -dy / dd * push);
          moveWith(state, b, dx / dd * push, dy / dd * push);
        }
      }
      const pdx = a.x - p.x, pdy = a.y - p.y;
      const pd = Math.hypot(pdx, pdy);
      const pmin = a.radius + 0.36;
      if (pd > 0.001 && pd < pmin) moveWith(state, a, pdx / pd * (pmin - pd), pdy / pd * (pmin - pd));
    }
    state.zombies = zs.filter(z => z.hp > 0);
  }

  function alienShot(state, z, dmgMul) {
    const p = state.player;
    state.aliFx.push({ x: z.x, y: z.y, kind: z.kind, t: 0 });
    sfx('splat');
    if (!losClear(state, z.x, z.y, p.x, p.y)) return;
    // the sheriff's aim is deliberately bad: wide misses most of the time
    const missChance = z.kind === 'sheriff' ? 0.55 : 0.3;
    if (rand(state, 'rng') < missChance) return;
    hurtPlayer(state, z.dmg * dmgMul * 0.75);
  }

  function hurtPlayer(state, dmg) {
    const p = state.player;
    if (p.hurtCd > 0) return;
    p.hp -= dmg;
    p.lastHurt = state.tick;
    p.hurtCd = 0.5;
    state.flash = Math.min(1, state.flash + dmg / 50);
    state.shake = Math.min(1, state.shake + 0.35);
    sfx('hit');
    if (p.hp <= 0) playerDown(state);
  }

  function playerDown(state) {
    state.deaths++;
    state.score = Math.max(0, state.score - 100);
    const p = state.player;
    p.hp = p.maxHp;
    p.x = 10.5; p.y = 11.5; p.yaw = -Math.PI / 2;
    p.lastHurt = state.tick;
    state.flash = 1;
    msg(state, 'DOWN — DRAGGED BACK TO THE STREET (-100)');
    sfx('die');
    if (state.deaths >= 3) { state.over = true; state.won = false; }
  }

  const LAST_STAND_ROUNDS = 4;   // three last stands = the whole run

  // ---- Step ----------------------------------------------------------------------------
  function step(state, input) {
    if (state.over) return state;
    state.tick++;
    input = input || {};
    if (state.phase === 'title') {
      if (input.actionPressed) { startRun(state); sfx('level'); }
      return state;
    }
    state.runSeconds += DT;
    handleInput(state, input);
    const p = state.player;
    // drops auto-pickup on walk-over
    for (const d of state.drops) {
      d.t += DT;
      if (!d.taken && Math.hypot(d.x - p.x, d.y - p.y) < 0.7) applyDrop(state, d);
    }
    state.drops = state.drops.filter(d => d.t <= d.ttl);
    // spawns
    if (state.spawnQueue.length) {
      state.spawnTimer -= DT;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = Math.max(0.4, 1.6 - state.round * 0.06);
        spawnOne(state);
      }
    }
    // round flow
    if (state.roundEnded) {
      state.between -= DT;
      if (state.between <= 0) {
        state.roundEnded = false;
        if (state.round < state.maxRounds) spawnWave(state);
        else { state.over = true; state.won = true; }
      }
    } else if (state.roundKillTarget === 0 && state.spawnQueue.length === 0 && state.zombies.length === 0) {
      spawnWave(state);
    }
    stepZombies(state);
    for (const c of state.corpses) c.t += DT;
    state.corpses = state.corpses.filter(c => c.t < 9);
    for (const g of state.gibFx) g.t += DT;
    state.gibFx = state.gibFx.filter(g => g.t < 0.5);
    for (const a of state.aliFx) a.t += DT;
    state.aliFx = state.aliFx.filter(a => a.t < 0.4);
    for (const m of state.msgs) m.t -= DT;
    state.msgs = state.msgs.filter(m => m.t > 0);
    for (const b in state.dropBuffs) if (state.dropBuffs[b] > 0) state.dropBuffs[b] = Math.max(0, state.dropBuffs[b] - DT);
    state.flash = Math.max(0, state.flash - DT * 1.4);
    state.shake = Math.max(0, state.shake - DT * 3);
    state.muzzle = Math.max(0, (state.muzzle || 0) - DT);
    p.recoil = Math.max(0, (p.recoil || 0) - DT * 0.6);
    if (p.punch > 0) p.punch -= DT;
    return state;
  }

  // ---- Bot: a casual survivor ------------------------------------------------------------
  function bot(state) {
    const inp = { left: false, right: false, up: false, down: false, action: false, actionPressed: false, keys: {} };
    if (state.phase === 'title') { inp.actionPressed = true; return inp; }
    if (state.over) return inp;
    const p = state.player, b = state.bot, k = inp.keys;
    const turn = (ang) => {
      let da = ang - p.yaw;
      while (da > Math.PI) da -= TWO_PI;
      while (da < -Math.PI) da += TWO_PI;
      inp.look = { dx: Math.max(-140, Math.min(140, da * 320)), dy: 0 };
      return da;
    };
    b.thinkT -= DT; b.strafeT -= DT;
    // threat scan
    let best = null, bestPri = -1e9, bestD = 1e9;
    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      const d = Math.hypot(z.x - p.x, z.y - p.y);
      const pri = (z.kind === 'queen' ? 100 : z.kind === 'sheriff' ? 80 : z.kind === 'screamer' ? 60 : 40) - d;
      if (pri > bestPri) { bestPri = pri; best = z; bestD = d; }
    }
    const w = WEAPONS[p.weapons[p.slot]];
    const dry = w.kind !== 'melee' && (p.ammo[p.weapons[p.slot]] || 0) === 0;
    // reload: dry, or topping up while nobody is close
    if (w.kind !== 'melee') {
      const mag = p.ammo[p.weapons[p.slot]] || 0;
      if (mag === 0 || (bestD > 9 && mag < w.mag * 0.4 && (p.reserve[p.weapons[p.slot]] || 0) > 0)) k.KeyR = true;
    }
    // swarmed with a dry gun: punch or knife instead of standing there
    if (dry && best && bestD < 4.5) {
      let meleeIdx = -1;
      for (let i = 0; i < p.weapons.length; i++) if (WEAPONS[p.weapons[i]].kind === 'melee') { meleeIdx = i; break; }
      if (meleeIdx >= 0 && meleeIdx < 5) {
        k['Digit' + (meleeIdx + 1)] = true;
        if (p.weapons[p.slot] === p.weapons[meleeIdx]) k.KeyF = true;
      }
    }
    // keep a melee weapon bought and ready once the run can afford one
    if (state.score > 900 && p.weapons.indexOf('rusty_knuckles') < 0) {
      for (const wb of WALL_BUYS) if (wb.id === 'rusty_knuckles') {
        if (Math.hypot(wb.x - p.x, wb.y - p.y) < 1.2) k.KeyE = true;
        else if (b.tx === null) { b.tx = wb.x; b.ty = wb.y; }
      }
    }
    if (best && bestD < 14) {
      const da = turn(Math.atan2(best.y - p.y, best.x - p.x));
      inp.action = true; inp.actionPressed = true;
      if (bestD > 3.2 && Math.abs(da) < 0.7) inp.up = true;
      else if (bestD < 1.9) inp.down = true;
      // combat strafe: circle them, flipping direction periodically
      if (b.strafeT <= 0) { b.strafeT = 0.6 + rand(state, 'botRng'); b.strafe = rand(state, 'botRng') < 0.5 ? -1 : 1; }
      if (bestD < 8) { if (b.strafe < 0) inp.left = true; else inp.right = true; }
      if (dry && bestD < 2.2) k.KeyF = true;      // swing when they are in your face
    } else if (state.roundEnded || state.between > 0 || (state.spawnQueue.length === 0 && !state.zombies.length)) {
      if (b.thinkT <= 0 || b.tx === null) {
        b.thinkT = 1.4;
        b.tx = null;
        let want = null, wantD = 1e9;
        for (const dk in DOORS) {
          if (state.doors[dk]) continue;
          const parts = dk.split(',');
          const dxx = Number(parts[0]) + 0.5, dyy = Number(parts[1]) + 0.5;
          const d = Math.hypot(dxx - p.x, dyy - p.y);
          if (state.score >= DOOR_COST[DOORS[dk]] + 250 && d < wantD) { wantD = d; want = { x: dxx, y: dyy }; }
        }
        if (!want) {
          for (const wb of WALL_BUYS) {
            if (p.weapons.indexOf(wb.id) >= 0) continue;
            const d = Math.hypot(wb.x - p.x, wb.y - p.y);
            if (state.score >= wb.cost + 150 && d < wantD) { wantD = d; want = { x: wb.x, y: wb.y }; }
          }
        }
        if (want) { b.tx = want.x; b.ty = want.y; }
      }
      const gx = b.tx !== null ? b.tx : b.wx, gy = b.tx !== null ? b.ty : b.wy;
      const da = turn(Math.atan2(gy - p.y, gx - p.x));
      const gd = Math.hypot(gx - p.x, gy - p.y);
      if (b.tx !== null && gd < 1.15) { k.KeyE = true; b.tx = null; b.thinkT = 0.5; }
      else inp.up = true;
      const ahead = solidAt(state, Math.floor(p.x + Math.cos(p.yaw) * 0.55), Math.floor(p.y + Math.sin(p.yaw) * 0.55));
      if (ahead) {
        // pick the strafe direction that actually has floor beside us
        const ls = !solidAt(state, Math.floor(p.x + Math.cos(p.yaw - Math.PI / 2) * 0.55), Math.floor(p.y + Math.sin(p.yaw - Math.PI / 2) * 0.55));
        const rs = !solidAt(state, Math.floor(p.x + Math.cos(p.yaw + Math.PI / 2) * 0.55), Math.floor(p.y + Math.sin(p.yaw + Math.PI / 2) * 0.55));
        if (ls && !rs) { inp.left = true; b.strafe = -1; }
        else if (rs && !ls) { inp.right = true; b.strafe = 1; }
        else { if (b.strafe < 0) inp.left = true; else inp.right = true; }
        b.stuckT += DT;
      } else b.stuckT = Math.max(0, b.stuckT - DT);
      if (b.stuckT > 1.6) { b.tx = null; b.thinkT = 0; b.stuckT = 0; b.wx = 2 + rand(state, 'botRng') * (MAP_W - 4); b.wy = 2 + rand(state, 'botRng') * (MAP_H - 4); }
      b.lastX = p.x; b.lastY = p.y;
    } else if (best) {
      // enemies in sight but beyond the fight: face them, drift closer
      turn(Math.atan2(best.y - p.y, best.x - p.x));
      if (b.strafeT <= 0) { b.strafeT = 0.6 + rand(state, 'botRng'); b.strafe = rand(state, 'botRng') < 0.5 ? -1 : 1; }
      if (b.strafe < 0) inp.left = true; else inp.right = true;
    } else {
      // nothing in sight at all: walk somewhere useful
      const gx = b.wx, gy = b.wy;
      turn(Math.atan2(gy - p.y, gx - p.x));
      inp.up = true;
      if (Math.hypot(gx - p.x, gy - p.y) < 1.5) { b.wx = 2 + rand(state, 'botRng') * (MAP_W - 4); b.wy = 2 + rand(state, 'botRng') * (MAP_H - 4); }
      const ahead2 = solidAt(state, Math.floor(p.x + Math.cos(p.yaw) * 0.55), Math.floor(p.y + Math.sin(p.yaw) * 0.55));
      if (ahead2) { if (b.strafe < 0) inp.left = true; else inp.right = true; }
    }
    // pick the best owned weapon with ammo; only flip when the current one is truly dry
    if (p.weapons.length > 1) {
      const curId = p.weapons[p.slot], curW = WEAPONS[curId];
      const curWet = curW.kind !== 'melee' && ((p.ammo[curId] || 0) + (p.reserve[curId] || 0)) > 0;
      if (!curWet) {
        let bestId = curId, bestScore = -1;
        for (let i = 0; i < p.weapons.length; i++) {
          const id = p.weapons[i], ww = WEAPONS[id];
          if (ww.kind === 'melee') continue;
          const sc = (ww.dmg * ww.pellets) / ww.rate * ((p.ammo[id] || 0) + (p.reserve[id] || 0) > 0 ? 1 : 0);
          if (sc > bestScore) { bestScore = sc; bestId = id; }
        }
        if (bestId !== curId) {
          const idx = p.weapons.indexOf(bestId);
          if (idx < 5) k['Digit' + (idx + 1)] = true;
        }
      }
    }
    return inp;
  }

  // ---- Metrics ----------------------------------------------------------------------------
  function metrics(state) {
    const acc = state.shots > 0 ? state.hits / state.shots : 0;
    return {
      score: Math.round(state.score),
      round: state.round,
      kills: state.kills,
      deaths: state.deaths,
      accuracy: Math.min(1, Math.round(acc * 1000) / 1000),
      doors_open: state.doorsOpen,
      wall_buys: state.wallBuys,
      drops_taken: state.dropsTaken,
      boss_kills: state.bossKills,
      queen_kills: state.queenKills,
      won: state.won ? 1 : 0,
    };
  }

  // ---- Raycast core --------------------------------------------------------------------------
  // Lodev-style DDA over the tile map. Returns perpendicular distance so the renderer
  // needs no correction, plus the tile, the hit side and the fractional wall coordinate.
  function ddaWall(state, px, py, rdx, rdy, maxD) {
    let mapX = Math.floor(px), mapY = Math.floor(py);
    // all-zeros directions point straight up a grid line; nudge them off the singularity
    if (!rdx) rdx = 1e-9;
    if (!rdy) rdy = 1e-9;
    const ddx = Math.abs(1 / rdx), ddy = Math.abs(1 / rdy);
    const stepX = rdx < 0 ? -1 : 1, stepY = rdy < 0 ? -1 : 1;
    let sdx = rdx < 0 ? (px - mapX) * ddx : (mapX + 1 - px) * ddx;
    let sdy = rdy < 0 ? (py - mapY) * ddy : (mapY + 1 - py) * ddy;
    let side = 0, tile = 0, perp = maxD;
    for (let i = 0; i < 96; i++) {
      if (sdx < sdy) { perp = sdx; sdx += ddx; mapX += stepX; side = 0; }
      else { perp = sdy; sdy += ddy; mapY += stepY; side = 1; }
      if (perp > maxD) { tile = 0; break; }
      const t = tileAt(mapX, mapY);
      if (t && solidAt(state, mapX, mapY)) { tile = t; break; }
    }
    let wallX = side === 0 ? py + perp * rdy : px + perp * rdx;
    wallX -= Math.floor(wallX);
    return { perp: Math.max(0.02, perp), tile, side, wallX, mapX, mapY };
  }

  // ---- Renderer -------------------------------------------------------------------------------
  function shade(hex, f) {
    const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * f));
    const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * f));
    const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * f));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  const WALL_COL = { 1: '#8a5a2b', 2: '#3f7f74', 3: '#707a86', 4: '#b07a3f', 5: '#4a6f9f', 6: '#7a5230', 7: '#caa04a', 8: '#7de3ff' };

  function drawWorld(s, ctx) {
    const p = s.player;
    const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw);
    const planeK = 0.65;                        // tan(FOV/2) ~ 66 degrees
    const planeX = -sn * planeK, planeY = cs * planeK;
    const shakeX = Math.sin(s.tick * 1.7) * s.shake * 5;
    const horizon = RH / 2 + p.pitch * 300 + Math.sin(p.bob * 2) * 2.2 + p.recoil * 40 + shakeX * 0.4;
    // sky and ground bands (retro dithered stripes)
    ctx.fillStyle = '#101426'; ctx.fillRect(0, 0, RW, Math.max(0, horizon));
    ctx.fillStyle = '#1c2240'; ctx.fillRect(0, 0, RW, Math.max(0, horizon * 0.55));
    ctx.fillStyle = '#242a4d'; ctx.fillRect(0, Math.max(0, horizon * 0.3), RW, Math.max(0, horizon * 0.25));
    ctx.fillStyle = '#3a3226'; ctx.fillRect(0, horizon, RW, RH - horizon);
    ctx.fillStyle = '#463b2b'; ctx.fillRect(0, horizon, RW, (RH - horizon) * 0.3);
    ctx.fillStyle = '#54482f'; ctx.fillRect(0, horizon + (RH - horizon) * 0.6, RW, (RH - horizon) * 0.4);
    // stars
    ctx.fillStyle = '#8f9bd6';
    for (let i = 0; i < 14; i++) {
      const sx = (i * 61 + 17) % RW, sy = ((i * 37 + 5) % Math.max(1, Math.floor(horizon * 0.7)));
      ctx.fillRect(sx, sy, 1, 1);
    }
    // walls
    for (let i = 0; i < RW; i++) {
      const camX = 2 * i / RW - 1;
      const rdx = cs + planeX * camX, rdy = sn + planeY * camX;
      const hit = ddaWall(s, p.x, p.y, rdx, rdy, 30);
      if (!hit.tile) continue;
      const d = hit.perp;
      let h1 = RH * (WH - EYE) / (WH * d);
      let h2 = RH * EYE / (WH * d);
      const yTop = horizon - h1, yBot = horizon + h2;
      let base = WALL_COL[hit.tile] || '#888';
      let f = Math.max(0.25, 1 - d / 17);
      if (hit.side === 1) f *= 0.78;
      if (hit.tile === 7) {                      // doors get a district stripe
        const g = DOORS[hit.mapX + ',' + hit.mapY] || 1;
        base = g === 1 ? '#4a9fd8' : g === 2 ? '#d8894a' : '#9fd84a';
        f = Math.max(0.35, f);
      }
      if (hit.tile === 8) {                      // alien crystal pulses
        const pulse = 0.85 + 0.15 * Math.sin(s.tick * 0.08);
        f *= pulse;
      }
      // plank / panel texture from the fractional wall coordinate
      const band = Math.floor(hit.wallX * 6);
      if (band % 2 === 0) f *= 0.88;
      if (hit.tile === 6 && (hit.wallX < 0.12 || hit.wallX > 0.88)) f *= 0.7;
      ctx.fillStyle = shade(base, f);
      ctx.fillRect(i, Math.max(0, yTop), 1, Math.min(RH, yBot) - Math.max(0, yTop));
      if (hit.tile === 7 && state_checkDoorGlow(s, hit.mapX, hit.mapY, p)) {
        ctx.fillStyle = '#ffe98a';
        ctx.fillRect(i, horizon - 4 / d * 4, 1, 2);
      }
    }
  }

  function state_checkDoorGlow(s, mx, my, p) {
    const key = mx + ',' + my;
    if (s.doors[key]) return false;
    return Math.hypot(mx + 0.5 - p.x, my + 0.5 - p.y) < 3.5;
  }

  // project a world point to buffer screen x and depth
  function project(s, cs, sn, wx, wy) {
    const relX = wx - s.player.x, relY = wy - s.player.y;
    const depth = cs * relX + sn * relY;
    const lateral = sn * relX - cs * relY;
    if (depth < 0.15) return null;
    return { sx: RW / 2 * (1 - lateral / (0.65 * depth)), depth };
  }

  function drawBillboard(s, ctx, cs, sn, e, opt) {
    const pr = project(s, cs, sn, e.x, e.y);
    if (!pr) return;
    const d = pr.depth;
    const horizon = RH / 2 + s.player.pitch * 300 + Math.sin(s.player.bob * 2) * 2.2 + s.player.recoil * 40;
    const floorY = horizon + RH * EYE / (WH * d);
    const hpx = RH * (opt.h / WH) / d;
    const wpx = hpx * opt.w;
    const x0 = pr.sx - wpx / 2, y0 = floorY - hpx;
    if (pr.sx < -wpx || pr.sx > RW + wpx) return;
    const f = Math.max(0.35, 1 - d / 18);
    const flash = e.hitFlash > 0;
    const C = (hex) => flash ? '#ffffff' : shade(hex, f);
    if (opt.kind === 'drop') {
      ctx.fillStyle = C(opt.color); ctx.fillRect(x0, y0 + hpx * 0.4, wpx, hpx * 0.6);
      ctx.fillStyle = flash ? '#fff' : shade('#ffffff', f);
      ctx.fillRect(x0 + wpx * 0.2, y0 + hpx * 0.15, wpx * 0.6, hpx * 0.25);
      return;
    }
    if (opt.kind === 'corpse') {
      ctx.fillStyle = C('#3d2f22');
      ctx.fillRect(x0, floorY - hpx * 0.16, wpx, hpx * 0.16);
      return;
    }
    // body
    ctx.fillStyle = C(opt.body); ctx.fillRect(x0, y0 + hpx * 0.3, wpx, hpx * 0.7);
    // head
    ctx.fillStyle = C(opt.skin); ctx.fillRect(x0 + wpx * 0.2, y0, wpx * 0.6, hpx * 0.3);
    // eyes
    ctx.fillStyle = flash ? '#fff' : shade(opt.eye, f);
    ctx.fillRect(x0 + wpx * 0.3, y0 + hpx * 0.12, wpx * 0.12, hpx * 0.08);
    ctx.fillRect(x0 + wpx * 0.58, y0 + hpx * 0.12, wpx * 0.12, hpx * 0.08);
    if (opt.hat) {
      ctx.fillStyle = C(opt.hat);
      ctx.fillRect(x0 + wpx * 0.05, y0 - hpx * 0.09, wpx * 0.9, hpx * 0.1);
      ctx.fillRect(x0 + wpx * 0.25, y0 - hpx * 0.2, wpx * 0.5, hpx * 0.12);
    }
    if (opt.star) {
      ctx.fillStyle = flash ? '#fff' : shade('#ffd23f', f);
      ctx.fillRect(x0 + wpx * 0.4, y0 + hpx * 0.4, wpx * 0.2, hpx * 0.14);
    }
    if (opt.crown) {
      ctx.fillStyle = flash ? '#fff' : shade('#ff5ad8', f);
      ctx.fillRect(x0 + wpx * 0.1, y0 - hpx * 0.14, wpx * 0.8, hpx * 0.1);
      ctx.fillRect(x0 + wpx * 0.3, y0 - hpx * 0.24, wpx * 0.12, hpx * 0.1);
      ctx.fillRect(x0 + wpx * 0.58, y0 - hpx * 0.24, wpx * 0.12, hpx * 0.1);
    }
    // legs animate
    const step = Math.sin((e.wobble || 0) + s.tick * 0.25) * wpx * 0.12;
    ctx.fillStyle = C(opt.legs || '#2a2320');
    ctx.fillRect(x0 + wpx * 0.18 + step, floorY - hpx * 0.06, wpx * 0.22, hpx * 0.08);
    ctx.fillRect(x0 + wpx * 0.6 - step, floorY - hpx * 0.06, wpx * 0.22, hpx * 0.08);
    // queen aura ring on the ground
    if (opt.aura) {
      ctx.strokeStyle = 'rgba(180,140,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pr.sx, floorY, wpx * 0.9, 0, TWO_PI);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    // telegraph flash: the sheriff drawing his revolver
    if (e.pendingShot) {
      ctx.fillStyle = '#ff4a4a';
      ctx.fillRect(x0 + wpx * 0.9, y0 + hpx * 0.3, Math.max(1, wpx * 0.25), Math.max(1, hpx * 0.06));
    }
  }

  function drawSprites(s, ctx) {
    const cs = Math.cos(s.player.yaw), sn = Math.sin(s.player.yaw);
    const list = [];
    for (const c of s.corpses) list.push({ e: c, d: (cs * (c.x - s.player.x) + sn * (c.y - s.player.y)), t: 'corpse' });
    for (const d of s.drops) list.push({ e: d, d: (cs * (d.x - s.player.x) + sn * (d.y - s.player.y)), t: 'drop' });
    for (const z of s.zombies) list.push({ e: z, d: (cs * (z.x - s.player.x) + sn * (z.y - s.player.y)), t: 'zombie' });
    list.sort((a, b) => b.d - a.d);
    for (const it of list) {
      const e = it.e;
      if (it.t === 'corpse') { drawBillboard(s, ctx, cs, sn, e, { kind: 'corpse', h: 0.4, w: 1.6, body: '#3d2f22', skin: '#3d2f22', eye: '#000' }); continue; }
      if (it.t === 'drop') {
        const col = e.kind === 'health' ? '#ff5a6e' : e.kind === 'ammo' ? '#ffd23f' : e.kind === 'nuka' ? '#ff9de2' : e.kind === 'insta' ? '#fff' : e.kind === 'nuke' ? '#7dff8a' : '#66ffe6';
        const pulse = 1 + 0.15 * Math.sin(s.tick * 0.3);
        drawBillboard(s, ctx, cs, sn, e, { kind: 'drop', h: 0.32 * pulse, w: 0.6, color: col });
        continue;
      }
      const look = {
        walker:   { body: '#5f7350', skin: '#8fa06d', eye: '#ffd23f', hat: '#6b4a2a', legs: '#3a2f24' },
        screamer: { body: '#7a4aff', skin: '#b48cff', eye: '#ff5ad8', legs: '#3a2560' },
        sheriff:  { body: '#2c3550', skin: '#c9a07a', eye: '#ff4a4a', hat: '#1d2438', star: true, legs: '#23283c' },
        queen:    { body: '#b43fd8', skin: '#ff9de2', eye: '#7dff8a', crown: true, aura: true, legs: '#5c1f73' },
      }[e.kind];
      const k = KINDS[e.kind];
      drawBillboard(s, ctx, cs, sn, e, Object.assign({ kind: 'zombie', h: k.h, w: k.w }, look));
      // boss / queen health bar
      if ((k.boss || k.queen) && e.hp < e.maxHp) {
        const pr = project(s, cs, sn, e.x, e.y);
        if (pr && pr.depth > 0.3) {
          const top = RH / 2 + s.player.pitch * 300 - RH * (k.h / WH) / pr.depth * 0.62;
          const bw = Math.min(RW * 0.5, RH * 0.6 / pr.depth);
          ctx.fillStyle = '#1a1010'; ctx.fillRect(pr.sx - bw / 2, top - 6, bw, 4);
          ctx.fillStyle = k.queen ? '#ff5ad8' : '#ffd23f';
          ctx.fillRect(pr.sx - bw / 2, top - 6, bw * Math.max(0, e.hp / e.maxHp), 4);
        }
      }
    }
    // gib puffs and alien shots (screen-space stamps at their world spot)
    for (const g of s.gibFx) {
      if (g.t < 0) continue;
      const pr = project(s, cs, sn, g.x, g.y);
      if (!pr) continue;
      const r = RH * 0.5 / pr.depth * (0.15 + g.t * 0.8);
      ctx.fillStyle = g.t < 0.12 ? '#ffe98a' : '#8fa06d';
      ctx.fillRect(pr.sx - r / 2, RH / 2 + RH * EYE / (WH * pr.depth) - r, r, r);
    }
    for (const a of s.aliFx) {
      const pr = project(s, cs, sn, a.x, a.y);
      if (!pr) continue;
      const r = RH * 0.7 / pr.depth * (0.1 + a.t);
      ctx.fillStyle = a.kind === 'sheriff' ? '#ffd23f' : '#b48cff';
      ctx.fillRect(pr.sx - r / 2, RH / 2 - r + RH * EYE / (WH * pr.depth) * 0.3, r, r);
    }
  }

  function drawViewmodel(s, ctx) {
    const p = s.player, w = weaponOf(s);
    const bobX = Math.sin(p.bob) * 6, bobY = Math.abs(Math.cos(p.bob)) * 5;
    const rec = (p.recoil || 0) * 26;
    const punch = (p.punch > 0 ? p.punch : 0) * 60;
    const bx = W - 150 + bobX, by = H - 150 + bobY + rec + punch;
    ctx.save();
    ctx.translate(bx, by);
    ctx.fillStyle = '#c9a07a';                                    // hand
    ctx.fillRect(30, 60, 26, 46);
    ctx.fillStyle = '#3a2f24';
    ctx.fillRect(30, 60, 26, 8);
    const col = w.color || '#3b3b42';
    if (w.kind === 'melee') {
      ctx.fillStyle = '#8a8f98'; ctx.fillRect(38, -40 + punch, 12, 70);       // blade
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(34, 26 + punch, 20, 26);        // grip
    } else if (w.kind === 'pistol') {
      ctx.fillStyle = col; ctx.fillRect(24, 6 + rec, 18, 52);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(20, 40 + rec, 26, 18);
      if (w.color) { ctx.fillStyle = w.color; ctx.fillRect(30, 10 + rec, 6, 30); }
    } else if (w.kind === 'shotgun') {
      ctx.fillStyle = col; ctx.fillRect(6, -8 + rec, 16, 96);
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(6, 42 + rec, 16, 34);
      ctx.fillStyle = '#23232a'; ctx.fillRect(22, -4 + rec, 8, 60);
    } else if (w.kind === 'rifle') {
      ctx.fillStyle = col; ctx.fillRect(2, -16 + rec, 14, 110);
      ctx.fillStyle = '#6b4a2a'; ctx.fillRect(2, 48 + rec, 14, 30);
      ctx.fillStyle = '#23232a'; ctx.fillRect(16, -10 + rec, 7, 44);
    } else if (w.kind === 'laser') {
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(16, 2 + rec, 24, 56);
      ctx.fillStyle = w.color; ctx.fillRect(22, -30 + rec, 10, 44);
      ctx.fillStyle = '#fff'; ctx.fillRect(24, -30 + rec, 4, 10);
    }
    if (s.muzzle > 0) {
      ctx.fillStyle = '#fff3b0';
      const mx = w.kind === 'melee' ? 40 : 26;
      ctx.fillRect(mx - 8, -34 + rec, 26, 20);
      ctx.fillStyle = '#ff9d4a';
      ctx.fillRect(mx - 3, -28 + rec, 16, 10);
    }
    ctx.restore();
  }

  function txt(ctx, str, x, y, size, color, align, weight) {
    ctx.fillStyle = color;
    ctx.font = (weight || 700) + ' ' + size + 'px "Courier New", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  function drawCrosshair(ctx, s) {
    const p = s.player, w = weaponOf(s);
    const gap = 6 + (w.spread || 2) * 1.6 + (p.sprinting ? 6 : 0) + (p.recoil || 0) * 60;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - gap - 7, H / 2); ctx.lineTo(W / 2 - gap, H / 2);
    ctx.moveTo(W / 2 + gap, H / 2); ctx.lineTo(W / 2 + gap + 7, H / 2);
    ctx.moveTo(W / 2, H / 2 - gap - 7); ctx.lineTo(W / 2, H / 2 - gap);
    ctx.moveTo(W / 2, H / 2 + gap); ctx.lineTo(W / 2, H / 2 + gap + 7);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(W / 2 - 1, H / 2 - 1, 2, 2);
    ctx.lineWidth = 1;
  }

  function drawRadar(ctx, s) {
    const sc = 3, ox = W - MAP_W * sc - 10, oy = 12;
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    ctx.fillRect(ox - 3, oy - 3, MAP_W * sc + 6, MAP_H * sc + 6);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = tileAt(x, y);
      if (!t) continue;
      if (t === 7 && s.doors[x + ',' + y]) continue;
      ctx.fillStyle = t === 8 ? '#7de3ff' : t === 7 ? '#caa04a' : t === 5 ? '#4a6f9f' : t === 4 ? '#b07a3f' : '#5c5142';
      ctx.fillRect(ox + x * sc, oy + y * sc, sc, sc);
    }
    for (const z of s.zombies) {
      const dx = z.x - s.player.x, dy = z.y - s.player.y;
      if (dx * dx + dy * dy > 196) continue;
      ctx.fillStyle = z.kind === 'queen' ? '#ff5ad8' : z.kind === 'sheriff' ? '#ffd23f' : '#ff6a5a';
      ctx.fillRect(ox + z.x * sc - 1, oy + z.y * sc - 1, 3, 3);
    }
    for (const d of s.drops) {
      ctx.fillStyle = '#7dff8a';
      ctx.fillRect(ox + d.x * sc - 1, oy + d.y * sc - 1, 3, 3);
    }
    ctx.fillStyle = '#e8ecff';
    ctx.fillRect(ox + s.player.x * sc - 2, oy + s.player.y * sc - 2, 4, 4);
  }

  function drawHud(ctx, s) {
    const p = s.player, w = weaponOf(s), id = weaponId(s);
    // bottom plate
    ctx.fillStyle = 'rgba(10,12,20,0.78)';
    ctx.fillRect(0, H - 74, W, 74);
    // health
    txt(ctx, 'HP', 14, H - 48, 13, '#9aa3c0');
    ctx.fillStyle = '#2a1520'; ctx.fillRect(40, H - 58, 150, 14);
    ctx.fillStyle = p.hp > 40 ? '#e84a4a' : '#ff2222';
    ctx.fillRect(40, H - 58, 150 * Math.max(0, p.hp / p.maxHp), 14);
    txt(ctx, Math.ceil(p.hp), 196, H - 46, 13, '#fff');
    // ammo
    if (w.kind === 'melee') txt(ctx, w.name, W - 14, H - 40, 15, '#e8ecff', 'right');
    else {
      txt(ctx, (p.ammo[id] || 0) + ' / ' + (p.reserve[id] || 0), W - 14, H - 40, 20, (p.ammo[id] || 0) === 0 ? '#ff5a5a' : '#ffe98a', 'right');
      txt(ctx, w.name, W - 14, H - 20, 12, '#9aa3c0', 'right');
      if (p.reloadTimer > 0) {
        txt(ctx, 'RELOADING', W - 14, H - 58, 12, '#7dff8a', 'right');
        ctx.fillStyle = '#234a2a'; ctx.fillRect(W - 120, H - 68, 106, 5);
        ctx.fillStyle = '#7dff8a'; ctx.fillRect(W - 120, H - 68, 106 * (1 - p.reloadTimer / w.reload), 5);
      }
    }
    // score
    txt(ctx, '$ ' + Math.round(s.score), 14, H - 20, 16, '#ffe98a');
    // round + remaining
    txt(ctx, 'ROUND ' + s.round, 14, 26, 20, '#e8ecff');
    const remaining = s.spawnQueue.length + state_alive(s);
    txt(ctx, remaining + ' REMAIN', 14, 44, 12, '#9aa3c0');
    // buffs
    let bx = 14;
    if (s.dropBuffs.insta > 0) { txt(ctx, 'INSTA ' + Math.ceil(s.dropBuffs.insta), bx, 64, 12, '#fff'); bx += 86; }
    if (s.dropBuffs.nuka > 0) { txt(ctx, 'x2 PTS ' + Math.ceil(s.dropBuffs.nuka), bx, 64, 12, '#ff9de2'); }
    // messages
    let my = H - 92;
    for (const m of s.msgs) {
      ctx.globalAlpha = Math.min(1, m.t);
      txt(ctx, m.text, W / 2, my, 14, '#ffe98a', 'center');
      ctx.globalAlpha = 1;
      my -= 18;
    }
    // lives
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < 3 - s.deaths ? '#e84a4a' : '#3a2020';
      ctx.fillRect(W / 2 - 26 + i * 18, H - 92, 12, 8);
    }
    drawRadar(ctx, s);
  }

  function state_alive(s) {
    let n = 0;
    for (const z of s.zombies) if (z.hp > 0) n++;
    return n;
  }

  function drawTitle(ctx, s) {
    ctx.fillStyle = '#101426'; ctx.fillRect(0, 0, W, H);
    // desert dusk bands
    ctx.fillStyle = '#242a4d'; ctx.fillRect(0, 0, W, 160);
    ctx.fillStyle = '#4a2f4f'; ctx.fillRect(0, 160, W, 90);
    ctx.fillStyle = '#7a3b3b'; ctx.fillRect(0, 250, W, 70);
    ctx.fillStyle = '#b06a3a'; ctx.fillRect(0, 320, W, 60);
    // sun
    ctx.fillStyle = '#ffe98a'; ctx.fillRect(W / 2 - 60, 180, 120, 120);
    ctx.fillStyle = '#ffb14a'; ctx.fillRect(W / 2 - 60, 250, 120, 50);
    // town silhouette
    ctx.fillStyle = '#1a1420';
    ctx.fillRect(30, 330, 90, 110); ctx.fillRect(150, 300, 60, 140);
    ctx.fillRect(240, 320, 110, 120); ctx.fillRect(380, 340, 70, 100);
    ctx.fillRect(0, 420, W, H - 420);
    txt(ctx, 'COWBOYS & ALIENS', W / 2, 92, 40, '#ffe98a', 'center', 900);
    txt(ctx, CONFIG.tagline, W / 2, 122, 14, '#e8ecff', 'center');
    txt(ctx, 'HOLD THE TOWN AGAINST THE UNDEAD WEST', W / 2, 470, 13, '#9aa3c0', 'center');
    const lines = [
      'WASD move · MOUSE aim · CLICK fire',
      'SHIFT sprint · R reload · F melee · E buy/open',
      'Wall buys and locked doors cost points',
      'Sheriffs every 5th round · Queens from round 7',
    ];
    for (let i = 0; i < lines.length; i++) txt(ctx, lines[i], W / 2, 500 + i * 20, 12, '#c9cfe8', 'center');
    const pulse = 0.6 + 0.4 * Math.sin(s.tick * 0.06);
    ctx.globalAlpha = pulse;
    txt(ctx, 'CLICK OR SPACE TO START', W / 2, 610, 18, '#7dff8a', 'center', 900);
    ctx.globalAlpha = 1;
    txt(ctx, 'seed ' + s.seedText, W - 8, H - 8, 10, 'rgba(255,255,255,0.35)', 'right');
    txt(ctx, 'reach round ' + CONFIG.maxRounds + ' to win', W / 2, 650, 11, '#9aa3c0', 'center');
  }

  function drawResults(ctx, s) {
    ctx.fillStyle = 'rgba(8,8,14,0.88)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, s.won ? 'THE TOWN STANDS' : 'THE TOWN FELL', W / 2, 150, 34, s.won ? '#7dff8a' : '#ff5a5a', 'center', 900);
    txt(ctx, 'SCORE', W / 2, 210, 16, '#9aa3c0', 'center');
    txt(ctx, String(Math.round(s.score)), W / 2, 260, 44, '#ffe98a', 'center', 900);
    const acc = s.shots > 0 ? Math.round((s.hits / s.shots) * 100) : 0;
    const rows = [
      'ROUNDS ' + s.round + ' / ' + CONFIG.maxRounds,
      'KILLS ' + s.kills + ' · HEADSHOTS ' + s.headshots,
      'ACCURACY ' + acc + '%',
      'DOORS ' + s.doorsOpen + ' · WALL BUYS ' + s.wallBuys + ' · DROPS ' + s.dropsTaken,
      'SHERIFFS ' + s.bossKills + ' · QUEENS ' + s.queenKills,
    ];
    for (let i = 0; i < rows.length; i++) txt(ctx, rows[i], W / 2, 310 + i * 24, 14, '#e8ecff', 'center');
    const pulse = 0.6 + 0.4 * Math.sin(s.tick * 0.06);
    ctx.globalAlpha = pulse;
    txt(ctx, 'SPACE OR TAP TO GO AGAIN', W / 2, H - 60, 16, '#7dff8a', 'center', 900);
    ctx.globalAlpha = 1;
  }

  function render(s, ctx, ui) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (s.phase === 'title') { drawTitle(ctx, s); ctx.restore(); return; }
    // world at buffer resolution, scaled up chunky
    ctx.save();
    ctx.scale(W / RW, H / RH);
    drawWorld(s, ctx);
    drawSprites(s, ctx);
    ctx.restore();
    if (!s.over) {
      drawViewmodel(s, ctx);
      drawCrosshair(ctx, s);
      drawHud(ctx, s);
    } else drawResults(ctx, s);
    // damage flash + low-health vignette
    if (s.flash > 0) {
      ctx.fillStyle = 'rgba(200,30,30,' + (s.flash * 0.45).toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (!s.over && s.player.hp < 30) {
      const a = 0.18 + 0.14 * Math.sin(s.tick * 0.25);
      ctx.strokeStyle = 'rgba(200,30,30,' + a.toFixed(3) + ')';
      ctx.lineWidth = 14;
      ctx.strokeRect(0, 0, W, H);
      ctx.lineWidth = 1;
    }
    if (ui && ui.paused && !s.over) {
      ctx.fillStyle = 'rgba(8,12,20,0.6)'; ctx.fillRect(0, 0, W, H);
      txt(ctx, 'PAUSED', W / 2, H / 2, 36, '#fff', 'center', 900);
      txt(ctx, 'Click to resume', W / 2, H / 2 + 26, 13, 'rgba(255,255,255,0.8)', 'center', 700);
    }
    ctx.restore();
  }

  function touchStick(state) {
    return !!state.player && state.phase === 'play' && !state.over;
  }

  globalThis.Game = {
    id: 'cowboys-and-aliens',
    title: CONFIG.title, width: W, height: H, autoJuice: false,
    pointerLook: true, touchStick,
    keys: ['ShiftLeft', 'ShiftRight', 'KeyR', 'KeyF', 'KeyE', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'ArrowLeft', 'ArrowRight'],
    guide: {
      version: 1,
      summary: 'First-person horde shooter: survive rounds of zombie-cowboys, sheriffs and queens in a western town.',
      goal: 'Survive as many rounds as you can and reach round ' + CONFIG.maxRounds + '; points buy doors and wall weapons.',
      lose: 'Your third last stand ends the run.',
      rules: [
        'Kills give points: 10 per hit, 60 per walker, 90 per screamer, 400 per sheriff, 600 per queen, +100 for a headshot.',
        'Wall buys sell weapons where they hang; locked doors open whole districts.',
        'Kills can drop ammo, whiskey, Nuga-Cola (double points), insta-kill, an alien nuke or max ammo.',
        'Sheriffs arrive every 5th round: six slow, wide revolver shots, then a long reload.',
        'Queens arrive from round 7: slow, huge, hard melee, and they buff every alien within 6 metres.',
      ],
      controls: [
        { action: 'Move / aim / fire', keyboard: 'WASD / mouse (click to lock) / click', touch: 'Left thumb stick to move, drag elsewhere or tap to fire' },
        { action: 'Sprint', keyboard: 'Shift', touch: 'Push the stick to its edge' },
        { action: 'Reload / melee / buy & open', keyboard: 'R / F / E', touch: 'No dedicated buttons; walk onto drops to take them' },
        { action: 'Switch weapon', keyboard: '1-5', touch: 'No dedicated touch control' },
      ],
      firstSteps: [
        'Click to lock the pointer, then hold the street.',
        'Save 600 points for the laundromat door or 750 for the 1911 on the north wall.',
        'Watch the sheriff: count his six shots and move in while he reloads.',
      ],
      tips: [
        'Queens buff everything around them — kill the queen first, or lure her followers away.',
        'Shotguns for the street, the Frontier Special for screamers at range.',
      ],
      modes: [],
    },
    init, step, bot, metrics, render,
    testHooks: { ddaWall, solidAt, castFovDebug: (state, x, y, ang) => { const d = Math.cos(ang), e = Math.sin(ang); return ddaWall(state, x, y, d, e, 30); } },
  };
})();
