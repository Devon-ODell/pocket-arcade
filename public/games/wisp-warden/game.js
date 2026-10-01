// game.js — Wisp Warden, a pocket roguelite: hold the dark back for as many waves as you can,
// drafting one boon of three between waves. shell.js runs this in the browser and
// studio/harness/sim.js runs it headless. Contract: docs/GAME_CONTRACT.md.
(function () {
  'use strict';

  const W = 480, H = 720, DT = 1 / 60;
  const ARENA = { x0: 16, y0: 76, x1: W - 16, y1: H - 16 };
  const MID_Y = (ARENA.y0 + ARENA.y1) / 2;
  const PLAYER_R = 10, BOLT_SPEED = 420;
  const CARD = { x: 60, w: 360, h: 104, y0: 214, gap: 124 };

  // Boons are data; state only records their ids, so a run stays plain JSON.
  const BOONS = {
    swift: { name: 'Swift', text: '+15% move speed', apply: (p) => { p.speed *= 1.15; } },
    rapid: { name: 'Rapid', text: 'fire 20% faster', apply: (p) => { p.cooldown *= 0.8; } },
    sharp: { name: 'Sharp', text: '+1 bolt damage', apply: (p) => { p.dmg += 1; } },
    split: { name: 'Split', text: '+1 bolt per shot', apply: (p) => { p.shots += 1; } },
    pierce: { name: 'Pierce', text: 'bolts pass through one more foe', apply: (p) => { p.pierce += 1; } },
    vital: { name: 'Vital', text: '+2 max light and heal 2', apply: (p) => { p.maxHp += 2; p.hp = Math.min(p.maxHp, p.hp + 2); } },
    reach: { name: 'Reach', text: '+25% bolt range', apply: (p) => { p.range *= 1.25; } },
    mend: { name: 'Mend', text: 'restore all light', apply: (p) => { p.hp = p.maxHp; } },
  };
  const BOON_IDS = Object.keys(BOONS);
  const KINDS = {
    mote: { hp: 2, speed: 52, r: 11, color: '#7b5cff', from: 1, weight: 1 },
    dart: { hp: 1, speed: 112, r: 8, color: '#ff5fa2', from: 2, weight: 0.5 },
    husk: { hp: 7, speed: 30, r: 17, color: '#4a3aa8', from: 4, weight: 0.3 },
  };
  const BOT_PREF = { split: 1.0, rapid: 0.9, sharp: 0.85, vital: 0.7, pierce: 0.6, reach: 0.5, swift: 0.5, mend: 0.2 };

  function rand(o, key) {           // mulberry32 with its seed in o[key], so it survives JSON
    let t = (o[key] = (o[key] + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const waveSize = (wave) => 6 + 4 * wave;

  function init(seed) {
    return {
      rng: (seed >>> 0) || 1, tick: 0, over: false, phase: 'fight',
      wave: 1, toSpawn: waveSize(1), spawnIn: 1.2, cleared: 0, nextId: 1,
      p: { x: W / 2, y: MID_Y, hp: 5, maxHp: 5, speed: 170, cooldown: 0.5, fireIn: 0,
           dmg: 1, shots: 1, pierce: 0, range: 230, hurt: 0 },
      enemies: [], bolts: [], sparks: [], draft: null, boons: {}, fx: [], streak: 0,
      kills: 0, taken: 0, score: 0,
      bot: { rng: ((seed >>> 0) ^ 0x85ebca6b) >>> 0, wx: 0, wy: 0, think: 0, alert: true },
    };
  }

  function spawnEnemy(s) {
    const kinds = Object.keys(KINDS).filter((k) => KINDS[k].from <= s.wave);
    let roll = rand(s, 'rng') * kinds.reduce((t, k) => t + KINDS[k].weight, 0), kind = kinds[0];
    for (const k of kinds) { roll -= KINDS[k].weight; if (roll <= 0) { kind = k; break; } }
    const side = Math.floor(rand(s, 'rng') * 4), t = rand(s, 'rng');
    const x = side < 2 ? ARENA.x0 + t * (ARENA.x1 - ARENA.x0) : (side === 2 ? ARENA.x0 : ARENA.x1);
    const y = side >= 2 ? ARENA.y0 + t * (ARENA.y1 - ARENA.y0) : (side === 0 ? ARENA.y0 : ARENA.y1);
    const hp = Math.ceil(KINDS[kind].hp * (1 + 0.35 * (s.wave - 1)));
    const speed = KINDS[kind].speed * (1 + 0.05 * (s.wave - 1));
    s.enemies.push({ id: s.nextId++, kind, x, y, hp, maxHp: hp, speed });
  }

  function sparks(s, x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(s, 'rng') * Math.PI * 2, v = 40 + 120 * rand(s, 'rng');
      s.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5, color });
    }
  }

  function openDraft(s) {
    const pool = BOON_IDS.slice(), options = [];
    while (options.length < 3) options.push(pool.splice(Math.floor(rand(s, 'rng') * pool.length), 1)[0]);
    s.phase = 'draft';
    s.draft = { options, sel: 1, wait: 0.5, lastDir: 0 };
    s.bolts = [];
  }

  const cardY = (i) => CARD.y0 + i * CARD.gap;
  function cardAt(x, y) {
    for (let i = 0; i < 3; i++) {
      if (x >= CARD.x && x <= CARD.x + CARD.w && y >= cardY(i) && y <= cardY(i) + CARD.h) return i;
    }
    return -1;
  }

  function draftStep(s, input) {
    const d = s.draft;
    d.wait -= DT;
    const dir = (input.down || input.right ? 1 : 0) - (input.up || input.left ? 1 : 0);
    if (dir !== 0 && dir !== d.lastDir) d.sel = clamp(d.sel + dir, 0, 2);
    d.lastDir = dir;
    if (d.wait > 0 || !input.actionPressed) return;
    let pick = d.sel;
    if (input.pointer && input.pointer.down) {
      pick = cardAt(input.pointer.x, input.pointer.y);
      if (pick < 0) return;
    }
    const id = d.options[pick];
    BOONS[id].apply(s.p);
    s.boons[id] = (s.boons[id] || 0) + 1;
    s.wave++;
    s.toSpawn = waveSize(s.wave);
    s.spawnIn = 1.0;
    s.phase = 'fight';
    s.draft = null;
  }

  // Presentation events for the shell; the rules never read them back.
  function fx(s, e) { if (s.fx.length < 40) s.fx.push(e); }

  function step(s, input) {
    if (s.over) return s;
    s.tick++;
    s.fx.length = 0;                       // the shell drains it each tick
    input = input || {};
    for (const k of s.sparks) { k.x += k.vx * DT; k.y += k.vy * DT; k.life -= DT; }
    s.sparks = s.sparks.filter((k) => k.life > 0);
    if (s.phase === 'draft') { draftStep(s, input); return s; }
    const p = s.p;

    let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0), my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (input.stick) {                      // touch joystick: analog, a small push moves slowly
      mx = input.stick.x;
      my = input.stick.y;
    } else if (input.pointer && input.pointer.down) {
      const dx = input.pointer.x - p.x, dy = input.pointer.y - p.y, d = Math.hypot(dx, dy);
      mx = d > 6 ? dx / d : 0;
      my = d > 6 ? dy / d : 0;
    }
    const len = Math.max(1, Math.hypot(mx, my));
    p.x = clamp(p.x + (mx / len) * p.speed * DT, ARENA.x0 + PLAYER_R, ARENA.x1 - PLAYER_R);
    p.y = clamp(p.y + (my / len) * p.speed * DT, ARENA.y0 + PLAYER_R, ARENA.y1 - PLAYER_R);

    if (s.toSpawn > 0) {
      s.spawnIn -= DT;
      if (s.spawnIn <= 0) {
        spawnEnemy(s);
        s.toSpawn--;
        s.spawnIn = Math.max(0.18, 0.95 - 0.08 * s.wave) * (0.6 + 0.8 * rand(s, 'rng'));
      }
    }

    p.fireIn -= DT;
    if (p.fireIn <= 0) {
      let target = null, best = p.range * p.range;
      for (const e of s.enemies) {
        const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d2 < best) { best = d2; target = e; }
      }
      if (target) {
        const base = Math.atan2(target.y - p.y, target.x - p.x);
        for (let i = 0; i < p.shots; i++) {
          const a = base + (i - (p.shots - 1) / 2) * 0.18;
          s.bolts.push({ x: p.x, y: p.y, vx: Math.cos(a) * BOLT_SPEED, vy: Math.sin(a) * BOLT_SPEED,
                         life: p.range / BOLT_SPEED, pierce: p.pierce, hit: [] });
        }
        p.fireIn = p.cooldown;
      }
    }

    for (const e of s.enemies) {
      const k = KINDS[e.kind], dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.speed * DT;
      e.y += (dy / d) * e.speed * DT;
      if (d < k.r + PLAYER_R && p.hurt <= 0) {
        p.hp -= 1;
        p.hurt = 0.7;
        s.taken++;
        e.hp = 0;
        e.popped = true;
        sparks(s, e.x, e.y, '#ffffff', 8);
        s.streak = 0;
        fx(s, { k: 'shake', m: 13 });
        fx(s, { k: 'flash', a: 0.34, c: '#ff5470' });
        fx(s, { k: 'burst', x: e.x, y: e.y, n: 16, c: '#ff5470', spd: 4 });
        fx(s, { k: 'sound', s: 'hit' });
      }
    }
    for (const b of s.bolts) {
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      b.life -= DT;
      for (const e of s.enemies) {
        if (e.hp <= 0 || b.hit.includes(e.id)) continue;
        const r = KINDS[e.kind].r + 4;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < r * r) {
          e.hp -= p.dmg;
          b.hit.push(e.id);
          if (b.pierce-- <= 0) { b.life = 0; break; }
        }
      }
    }
    s.bolts = s.bolts.filter((b) => b.life > 0);
    const alive = [];
    for (const e of s.enemies) {
      if (e.hp > 0) { alive.push(e); continue; }
      if (!e.popped) {
        s.kills++;
        const gain = 10 * s.wave;
        s.score += gain;
        s.streak++;
        sparks(s, e.x, e.y, KINDS[e.kind].color, 6);
        fx(s, { k: 'burst', x: e.x, y: e.y, n: 10, c: KINDS[e.kind].color, spd: 3 });
        fx(s, { k: 'ring', x: e.x, y: e.y, max: 30, c: KINDS[e.kind].color });
        fx(s, { k: 'pop', x: e.x, y: e.y - 20, t: `+${gain}`, c: KINDS[e.kind].color, size: 15 + Math.min(12, s.streak) });
        fx(s, { k: 'combo', n: s.streak });
        fx(s, { k: 'sound', s: 'pick', n: Math.min(12, s.streak) });
      }
    }
    s.enemies = alive;
    p.hurt = Math.max(0, p.hurt - DT);

    if (p.hp <= 0) {
      s.over = true;
      fx(s, { k: 'shake', m: 22 });
      fx(s, { k: 'flash', a: 0.5, c: '#ff5470' });
      fx(s, { k: 'sound', s: 'die' });
    } else if (s.toSpawn === 0 && s.enemies.length === 0) {
      s.cleared++;
      s.score += 50 * s.wave;
      fx(s, { k: 'confetti' });
      fx(s, { k: 'flash', a: 0.2, c: '#ffffff' });
      fx(s, { k: 'pop', x: W / 2, y: MID_Y - 60, t: `WAVE ${s.wave} HELD`, c: '#9dff3a', size: 28 });
      fx(s, { k: 'sound', s: 'level' });
      openDraft(s);
    }
    return s;
  }

  // A casual player: backs away from what is close, drifts toward the middle, gets
  // distracted now and then, and drafts by taste with some noise.
  function bot(s) {
    const b = s.bot, p = s.p;
    if (s.phase === 'draft') {
      let pick = 0, top = -1;
      s.draft.options.forEach((id, i) => {
        const want = (id === 'mend' && p.hp <= 2 ? 1.3 : BOT_PREF[id]) + 0.8 * rand(b, 'rng');
        if (want > top) { top = want; pick = i; }
      });
      return { actionPressed: s.draft.wait <= 0, pointer: { x: W / 2, y: cardY(pick) + CARD.h / 2, down: true } };
    }
    b.think -= 1;
    if (b.think <= 0) {
      b.think = 8 + Math.floor(12 * rand(b, 'rng'));
      b.alert = rand(b, 'rng') < 0.85;
      b.wx = rand(b, 'rng') * 2 - 1;
      b.wy = rand(b, 'rng') * 2 - 1;
    }
    let fx = 0, fy = 0;
    if (b.alert) {
      for (const e of s.enemies) {
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (d < 170) { const w = (1 - d / 170) ** 2; fx += (dx / d) * w; fy += (dy / d) * w; }
      }
      fx *= 2;
      fy *= 2;
    }
    fx += ((W / 2 - p.x) / ((ARENA.x1 - ARENA.x0) / 2)) * 0.6 + b.wx * 0.35;
    fy += ((MID_Y - p.y) / ((ARENA.y1 - ARENA.y0) / 2)) * 0.6 + b.wy * 0.35;
    return { left: fx < -0.15, right: fx > 0.15, up: fy < -0.15, down: fy > 0.15 };
  }

  function metrics(s) {
    return { score: s.score, waves: s.cleared, kills: s.kills, damage: s.taken,
             boons: Object.keys(s.boons).length };
  }

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  function render(s, ctx, ui) {
    const p = s.p;
    ctx.fillStyle = '#10252b';ctx.fillRect(0,0,W,H);
    // Stone courses, broken joints, and moss give the arena a readable sense of place.
    for(let row=0;row<11;row++)for(let col=0;col<8;col++){
      const x=16+col*64-(row%2)*32,y=78+row*60;
      ctx.fillStyle=(row+col)%3===0?'#193339':'#173036';ctx.fillRect(x+1,y+1,61,57);
      ctx.fillStyle='#264348';ctx.fillRect(x+3,y+2,57,1);
      if((row*7+col)%5===0){ctx.fillStyle='#2f4940';ctx.fillRect(x+4,y+49,12,3);ctx.fillRect(x+8,y+46,5,3);}
      if((row+col*3)%7===0){ctx.strokeStyle='#0e242b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+35,y+3);ctx.lineTo(x+29,y+12);ctx.lineTo(x+33,y+18);ctx.stroke();}
    }
    ctx.strokeStyle='#4c6258';ctx.lineWidth=3;ctx.strokeRect(ARENA.x0,ARENA.y0,ARENA.x1-ARENA.x0,ARENA.y1-ARENA.y0);
    ctx.strokeStyle='#34504c';ctx.lineWidth=1;
    for(const r of [66,76]){ctx.beginPath();ctx.arc(W/2,MID_Y,r,0,Math.PI*2);ctx.stroke();}
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(W/2+Math.cos(a)*61,MID_Y+Math.sin(a)*61);ctx.lineTo(W/2+Math.cos(a)*81,MID_Y+Math.sin(a)*81);ctx.stroke();}
    for(const x of [24,W-24])for(const y of [92,H-32]){
      ctx.fillStyle='#0b2027';ctx.fillRect(x-7,y-9,14,22);ctx.fillStyle='#617569';ctx.fillRect(x-7,y-9,14,4);
      ctx.fillStyle='#b5a470';ctx.fillRect(x-3,y-5,6,8);ctx.fillStyle='#f4d496';ctx.fillRect(x-2,y-6,4,4);
    }
    const glow = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, p.range);
    glow.addColorStop(0, 'rgba(255,214,120,0.20)');
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);

    for (const e of s.enemies) {
      const k=KINDS[e.kind],a=Math.atan2(p.y-e.y,p.x-e.x),r=k.r;
      ctx.fillStyle='#06191f70';ctx.beginPath();ctx.ellipse(e.x,e.y+r*.75,r,4,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(e.x,e.y);ctx.rotate(a);
      ctx.fillStyle=e.kind==='husk'?'#8c9c81':e.kind==='dart'?'#d78c7c':'#9b94bc';
      ctx.strokeStyle='#081c26';ctx.lineWidth=2;ctx.beginPath();
      if(e.kind==='dart'){ctx.moveTo(r,0);ctx.lineTo(-r,-r*.85);ctx.lineTo(-r*.5,0);ctx.lineTo(-r,r*.85);}
      else {ctx.moveTo(r,0);ctx.quadraticCurveTo(r,-r,-r*.3,-r);ctx.lineTo(-r,-r*.6);ctx.lineTo(-r*.65,0);ctx.lineTo(-r,r*.6);ctx.quadraticCurveTo(r,r,r,0);}
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#f8ecc4';circle(ctx,r*.38,-r*.35,2.5);circle(ctx,r*.38,r*.35,2.5);
      ctx.fillStyle='#18313a';circle(ctx,r*.5,-r*.35,1.2);circle(ctx,r*.5,r*.35,1.2);
      if(e.kind==='husk'){ctx.strokeStyle='#526956';ctx.beginPath();ctx.moveTo(-6,-11);ctx.lineTo(-1,-2);ctx.lineTo(-5,8);ctx.stroke();}
      ctx.restore();
    }
    ctx.fillStyle = '#ffe9a8';
    for (const b of s.bolts) circle(ctx, b.x, b.y, 3);
    for (const k of s.sparks) {
      ctx.globalAlpha = k.life / 0.5;
      ctx.fillStyle = k.color;
      ctx.fillRect(k.x - 2, k.y - 2, 4, 4);
    }
    ctx.globalAlpha = p.hurt > 0 && s.tick % 8 < 4 ? 0.35 : 1;
    // A hood, face, and trailing cloak replace the anonymous player dot.
    ctx.fillStyle='#071d2870';ctx.beginPath();ctx.ellipse(p.x,p.y+11,11,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#bb925a';ctx.beginPath();ctx.moveTo(p.x-8,p.y);ctx.lineTo(p.x-10,p.y+10);
    ctx.lineTo(p.x-3,p.y+8);ctx.lineTo(p.x+2,p.y+12);ctx.lineTo(p.x+9,p.y+9);ctx.lineTo(p.x+7,p.y);ctx.fill();
    ctx.fillStyle='#eed49a';circle(ctx,p.x,p.y-2,PLAYER_R);
    ctx.fillStyle='#25434a';ctx.beginPath();ctx.ellipse(p.x,p.y-1,7,5,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff5cd';ctx.fillRect(p.x-4,p.y-2,2,2);ctx.fillRect(p.x+2,p.y-2,2,2);
    ctx.globalAlpha = 1;

    ctx.fillStyle='#10252b';ctx.fillRect(0,0,W,75);
    ctx.fillStyle = '#efe7d1';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Wave ${s.wave}`, 18, 32);
    ctx.textAlign = 'right';
    ctx.fillText(String(s.score), W - 18, 32);
    for (let i = 0; i < p.maxHp; i++) {
      ctx.fillStyle = i < p.hp ? '#ffd678' : '#2b2440';
      circle(ctx, 24 + i * 16, 54, 6);
    }

    ctx.fillStyle = '#2b2440'; ctx.fillRect(18, 67, W - 36, 4);
    ctx.fillStyle = '#a88aff';
    ctx.fillRect(18, 67, (W - 36) * Math.max(0, 1 - (s.toSpawn + s.enemies.length) / waveSize(s.wave)), 4);
    ctx.textAlign = 'right'; ctx.font = '12px system-ui'; ctx.fillStyle = '#bcb0d6';
    ctx.fillText(`${s.toSpawn + s.enemies.length} foes remaining`, W - 18, 56);
    ctx.textAlign = 'center';
    if (s.wave === 1 && s.tick < 150 && !s.over) {
      ctx.fillStyle = '#efe7ff';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillText('Wisp Warden', W / 2, MID_Y - 60);
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText('Move to keep the dark at bay.', W / 2, MID_Y - 30);
      ctx.fillText('Your light fires on its own.', W / 2, MID_Y - 6);
    }
    if (s.phase === 'draft') {
      ctx.fillStyle = 'rgba(7,6,15,0.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#efe7ff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.fillText(`Wave ${s.wave} held. Choose a boon`, W / 2, 170);
      s.draft.options.forEach((id, i) => {
        const y = cardY(i), on = i === s.draft.sel;
        ctx.fillStyle = on ? '#3a2f6b' : '#1b1633';
        ctx.fillRect(CARD.x, y, CARD.w, CARD.h);
        ctx.strokeStyle = on ? '#ffd678' : '#4a3f7a';
        ctx.strokeRect(CARD.x, y, CARD.w, CARD.h);
        ctx.fillStyle = '#ffd678';
        ctx.font = 'bold 24px system-ui, sans-serif';
        ctx.fillText(BOONS[id].name + (s.boons[id] ? ` ${'+'.repeat(s.boons[id])}` : ''), W / 2, y + 42);
        ctx.fillStyle = '#d9d0f5';
        ctx.font = '17px system-ui, sans-serif';
        ctx.fillText(BOONS[id].text, W / 2, y + 74);
      });
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillStyle = '#9d93c4';
      ctx.fillText('Tap a card, or arrows + Space', W / 2, CARD.y0 + 3 * CARD.gap + 10);
    }
    if (s.over) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#efe7ff';
      ctx.font = 'bold 38px system-ui, sans-serif';
      ctx.fillText('The light went out', W / 2, MID_Y - 50);
      ctx.font = '21px system-ui, sans-serif';
      ctx.fillText(`${s.cleared} waves held · score ${s.score}` + (ui && ui.best ? ` · best ${ui.best}` : ''), W / 2, MID_Y - 10);
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText('Tap or press Space for a new run', W / 2, MID_Y + 26);
    }
  }

  globalThis.Game = {id: "wisp-warden",
    guide: {
  "version": 1,
  "summary": "Endless waves; movement plus auto-targeting light.",
  "goal": "Currently no final win: survive waves and increase score.",
  "lose": "Your light/health reaches zero (five starting health).",
  "rules": [
    "Endless waves; movement plus auto-targeting light. Clear a wave and select a boon. Eight existing boon types can stack; enemies currently mostly chase directly."
  ],
  "controls": [
    {
      "action": "Move",
      "keyboard": "WASD / arrows",
      "touch": "Touch joystick"
    },
    {
      "action": "Choose boon",
      "keyboard": "Arrows then Space / Enter",
      "touch": "Tap boon card"
    }
  ],
  "firstSteps": [
    "Move away from approaching enemies; your light attacks automatically.",
    "After a wave, read the three boons and choose one."
  ],
  "tips": [
    "Do not stand inside an enemy cluster; movement creates time for automatic attacks."
  ],
  "modes": []
},

    title: 'Wisp Warden', width: W, height: H,
    controls: 'Arrows / WASD, or the touch joystick, to move; your light fires by itself. Tap a card (or arrows + Space) to draft.',
    touchStick: (s) => s.phase === 'fight' && !s.over,   // joystick while fighting; taps pick cards
    init, step, bot, metrics, render,
  };
})();
