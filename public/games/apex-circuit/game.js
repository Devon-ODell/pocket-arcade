// game.js — Apex Circuit, a traditional circuit racer. One car, one circuit, one clean lap.
// The track is a segment list; the view is a behind-the-car projection drawn far to near.
// Contract (docs/GAME_CONTRACT.md): classic script, no DOM, no Math.random, no Date; every
// piece of state is plain JSON inside the state object.
(function () {
  'use strict';

  // Tunables. The block between the markers must stay valid JSON: studio.pipeline.spec
  // rewrites it for procedurally invented variants.
  const CONFIG = /*CONFIG*/{
    "title": "Apex Circuit",
    "tagline": "One car. One circuit. One clean lap.",
    "laps": 3,
    "car": {
        "name": "Coupe",
        "drive": "rear",
        "mass": 1250,
        "cgFront": 1.29,
        "cgRear": 1.33,
        "cgHeight": 0.49,
        "inertia": 1850,
        "torque": 400,
        "redline": 7200,
        "finalDrive": 3.44,
        "eff": 0.88,
        "gears": [3.25, 2.1, 1.54, 1.19, 0.97, 0.81],
        "brakeForce": 17500,
        "mu": 1.42,
        "loadSens": 0.14,
        "maxSteer": 0.44,
        "cd": 0.33,
        "area": 2.0
    },
    "palette": {
        "sky": "#1b2a4a",
        "sky2": "#54407a",
        "grass": "#1d3a24",
        "grass2": "#20442a",
        "road": "#3a3f4a",
        "road2": "#343945",
        "kerb": "#d94f4f",
        "line": "#e9eef7",
        "car": "#ff7a3d",
        "text": "#eef3ff"
    },
    "botSkill": 0.72
  }/*END*/;

  const W = 800, H = 480, DT = 1 / 60;
  const SEG = 20;                       // one segment is 20 m of track
  const ROAD_W = 9;                     // half-width of the tarmac, in metres
  const DRAW = 70;                      // segments drawn ahead
  const CAM_H = 1.5, CAM_D = 1 / Math.tan((62 / 2) * Math.PI / 180);
  const WHEEL_R = 0.33;                 // rolling radius, metres
  const SURFACE = { tarmac: 1, kerb: 0.78, grass: 0.46, gravel: 0.34 };
  const RADIUS_K = 330;                 // curve units -> corner radius in metres
  const LAT_G = 12;                     // peak lateral grip on dry tarmac, m/s^2

  // Monterey Ridge, original: short, dusty, few corners but all of them matter, with a
  // signature descending blind left-right through a compression at the end of sector 2.
  const PLAN = [
    { n: 34, c: 0, g: 0, s: 'Pit Straight' },
    { n: 16, c: -2.6, g: 0.4, s: 'Turn 1 · Rise' },
    { n: 12, c: 0, g: 0.9, s: 'Rise' },
    { n: 18, c: 3.1, g: 0.2, s: 'Quarry Right' },
    { n: 10, c: 0, g: -0.3, s: 'Short Chute' },
    { n: 22, c: -1.5, g: -0.9, s: 'Dust Bowl' },
    { n: 14, c: 4.4, g: -1.6, s: 'The Drop' },          // blind, falls away
    { n: 12, c: -4.8, g: -0.6, s: 'Compression' },      // and back the other way
    { n: 26, c: 0, g: 0.5, s: 'Back Straight' },
    { n: 20, c: 2.2, g: 0.1, s: 'Ridge Sweep' },
    { n: 14, c: -3.4, g: -0.4, s: 'Hairpin' },
    { n: 18, c: 1.1, g: 0, s: 'Onto The Straight' },
  ];

  // The circuit, built once from PLAN. It never changes, so it lives outside the state.
  const TRACK = (() => {
    const segs = [];
    let y = 0;
    for (const part of PLAN) {
      for (let i = 0; i < part.n; i++) {
        const ease = Math.sin((i / part.n) * Math.PI);        // corners open and close
        y += part.g * SEG * 0.07;     // metres: the steepest section is an 11% grade, not 80%.
                                      // Only render() reads y, so this changes the view, never the lap.
        segs.push({
          curve: part.c * ease,
          y,
          sector: part.s,
          kerb: Math.abs(part.c) > 1.2 ? 1 : 0,
        });
      }
    }
    return segs;
  })();
  const LENGTH = TRACK.length * SEG;
  const seg = (z) => TRACK[((Math.floor(z / SEG) % TRACK.length) + TRACK.length) % TRACK.length];

  function rand(o, key) {           // mulberry32; the seed lives in o[key] so it survives JSON
    let t = (o[key] = (o[key] + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Presentation events for the shell; the rules never read them back.
  function fx(s, e) { if (e.k === 'sound' && s.fx.length < 40) s.fx.push(e); }   // a handheld: sound, no neon

  function surfaceAt(x) {
    const off = Math.abs(x);
    if (off <= 1) return 'tarmac';
    if (off <= 1.18) return 'kerb';
    if (off <= 1.9) return 'grass';
    return 'gravel';
  }

  // --- tyres -----------------------------------------------------------------
  // A Pacejka-shaped curve: lateral force climbs with slip angle to a peak near 7 degrees
  // and then falls away. The falloff is the whole point — past the peak, asking for more
  // angle gives you less grip, which is what makes a slide a slide.
  const PAC_B = 9.2, PAC_C = 1.5, PAC_E = 0.96;
  function pacejka(slip) {
    const b = PAC_B * slip;
    return Math.sin(PAC_C * Math.atan(b - PAC_E * (b - Math.atan(b))));
  }
  // Load sensitivity: a tyre carrying twice the load does not make twice the grip.
  function muAt(car, load, nominal) {
    return car.mu * (1 - car.loadSens * (load / Math.max(1, nominal) - 1));
  }

  function rpmOf(car, speed, gear) {
    const ratio = car.gears[gear] * car.finalDrive;
    return Math.max(900, Math.min(car.redline, (Math.abs(speed) * ratio * 60) / (2 * Math.PI * WHEEL_R)));
  }
  // Engine torque against rpm, in newton-metres at the crank.
  function torqueAt(car, rpm) {
    const peak = car.redline * 0.76;
    const shape = rpm < peak
      ? 0.58 + 0.42 * Math.sin((rpm / peak) * Math.PI / 2)
      : 1 - 0.42 * ((rpm - peak) / (car.redline - peak));
    return car.torque * Math.max(0.15, shape);
  }

  function init(seed, progress) {
    const s = {
      rng: (seed >>> 0) || 1, tick: 0, over: false, fx: [],
      z: 0, x: 0, psi: 0,                 // along track, across track (m), heading vs track
      vx: 0.1, vy: 0, yaw: 0,             // body velocities (m/s) and yaw rate (rad/s)
      steer: 0, gear: 0, shiftIn: 0, slipF: 0, slipR: 0, loadF: 0, loadR: 0, smoke: 0,
      lap: 0, lapTick: 0, laps: [], best: 0, delta: 0, bestTrace: [],
      trace: [], offTicks: 0, spins: 0, score: 0, finished: 0,
      bot: { rng: ((seed >>> 0) ^ 0x9e3779b9) >>> 0, react: 0, aim: 0, lift: 0, nerve: 0 },
    };
    s.bot.nerve = 0.90 + rand(s.bot, 'rng') * 0.17;
    s.bot.aim = (rand(s.bot, 'rng') - 0.5) * 0.3;
    if (progress && Number(progress.best) > 0) s.best = Number(progress.best);
    return s;
  }

  // The speed a corner of this curvature can be taken at, from the tyres' peak grip.
  function safeSpeed(curve) {
    const c = Math.abs(curve);
    if (c < 0.25) return 999;
    return Math.sqrt(CONFIG.car.mu * 9.81 * (RADIUS_K / c));
  }

  function step(s, input) {
    if (s.over) return s;
    s.tick++;
    if (s.tick >= 36000) { s.over = true; return s; }
    s.lapTick++;
    s.fx.length = 0;                   // the shell drains it every tick
    const i = input || {};
    const car = CONFIG.car;
    const g = 9.81, m = car.mass, a = car.cgFront, b = car.cgRear, L = a + b;

    const touch = i.pointer && i.pointer.down ? i.pointer : null;
    const throttle = i.up || (touch && touch.x > 660) ? 1 : 0;
    const brake = i.down || (touch && touch.x > 535 && touch.x < 660) ? 1 : 0;
    const steerIn = typeof i.steer === "number" ? Math.max(-1, Math.min(1, i.steer)) : i.stick ? i.stick.x : (i.right ? 1 : 0) - (i.left ? 1 : 0);

    // Steering: less lock the faster you go, and the wheel takes time to move.
    const lock = car.maxSteer * (0.32 + 0.68 / (1 + s.vx * s.vx / 900));
    s.steer += (steerIn * lock - s.steer) * 0.18;

    const surf = surfaceAt(s.x);
    const grip = SURFACE[surf];
    const here = seg(s.z);
    const kappa = here.curve / RADIUS_K;              // track curvature, 1/m

    // Two substeps: the yaw equation is stiff at speed and one 60 Hz step wanders.
    for (let sub = 0; sub < 2; sub++) {
      const h = DT / 2;

      // Longitudinal forces, which also set the weight transfer.
      const rpm = rpmOf(car, s.vx, s.gear);
      const ratio = car.gears[s.gear] * car.finalDrive;
      const driveF = throttle * (torqueAt(car, rpm) * ratio * car.eff) / WHEEL_R;
      const engBrake = (1 - throttle) * (rpm / car.redline) * 220;
      const brakeF = brake * car.brakeForce;
      const dragF = 0.5 * car.cd * car.area * 1.225 * s.vx * s.vx;
      const rollF = (surf === 'grass' || surf === 'gravel') ? 4200 : 260;
      const along = (driveF * grip - brakeF * grip - dragF - rollF - engBrake) / m;

      const transfer = m * along * car.cgHeight / L;
      const loadF = Math.max(400, m * g * b / L - transfer);
      const loadR = Math.max(400, m * g * a / L + transfer);
      s.loadF = loadF; s.loadR = loadR;

      // Below a walking pace the bicycle model is singular: vx in the denominator of the
      // slip angles sends yaw to infinity from a standing start. Under 6 m/s the car simply
      // goes where the wheels point, and the tyre model fades in over the next few m/s.
      const dynamic = Math.min(1, Math.max(0, (s.vx - 5) / 12));
      if (dynamic < 1) {
        const kin = (s.vx / L) * Math.tan(s.steer);
        s.yaw += (kin - s.yaw) * (1 - dynamic) * 0.35;
        s.vy *= 1 - 0.3 * (1 - dynamic);
      }
      if (dynamic > 0) {
        const vx = Math.max(7, s.vx);
        const slipF = Math.atan2(s.vy + a * s.yaw, vx) - s.steer;
        const slipR = Math.atan2(s.vy - b * s.yaw, vx);
        s.slipF = slipF; s.slipR = slipR;

        const muF = muAt(car, loadF, m * g * b / L) * grip;
        const muR = muAt(car, loadR, m * g * a / L) * grip;
        let fyF = -muF * loadF * pacejka(slipF);
        let fyR = -muR * loadR * pacejka(slipR);

        // Friction ellipse on the driven axle: force spent going forward is not available
        // sideways, so power-on oversteer and trail braking both fall out of the model.
        const capR = Math.max(1, muR * loadR);
        const usedLong = Math.min(1, Math.abs(driveF - brakeF * 0.4) / capR);
        fyR *= Math.sqrt(Math.max(0, 1 - usedLong * usedLong));

        const ay = (fyF * Math.cos(s.steer) + fyR) / m - s.vx * s.yaw;
        const yawAcc = (a * fyF * Math.cos(s.steer) - b * fyR) / car.inertia - s.yaw * 1.4;
        s.vy += ay * h * dynamic;
        s.yaw += yawAcc * h * dynamic;
      } else {
        s.slipF = 0; s.slipR = 0;
      }

      s.vx = Math.max(0, Math.min(96, s.vx + (along + s.vy * s.yaw) * h));
      s.vy *= 0.994;
      s.yaw = Math.max(-2.2, Math.min(2.2, s.yaw));

      // Position relative to the track ribbon rather than the world.
      s.psi += (s.yaw - kappa * s.vx) * h;
      s.psi = Math.max(-1.2, Math.min(1.2, s.psi));
      s.x += (s.vx * Math.sin(s.psi) + s.vy * Math.cos(s.psi)) * h / ROAD_W;
      s.z += (s.vx * Math.cos(s.psi)) * h;
    }

    // Automatic gearbox with a real shift pause.
    if (s.shiftIn > 0) s.shiftIn--;
    else {
      const rpm = rpmOf(car, s.vx, s.gear);
      if (rpm > car.redline * 0.96 && s.gear < car.gears.length - 1) { s.gear++; s.shiftIn = 7; }
      else if (rpm < car.redline * 0.42 && s.gear > 0) { s.gear--; s.shiftIn = 5; }
    }

    const slide = Math.max(Math.abs(s.slipF), Math.abs(s.slipR));
    s.smoke = Math.max(0, s.smoke * 0.9 + (slide > 0.2 ? slide : 0));
    s.x = Math.max(-3.2, Math.min(3.2, s.x));
    if (Math.abs(s.x) > 1) s.offTicks++;

    // A spin: the rear has let go completely and the car is no longer pointing down the road.
    if ((Math.abs(s.psi) > 0.95 || Math.abs(s.slipR) > 0.72) && s.vx > 24) {
      s.spins++;
      s.vx *= 0.55; s.vy = 0; s.yaw = 0; s.psi *= 0.2; s.steer = 0;
      fx(s, { k: 'shake', m: 17 });
      fx(s, { k: 'flash', a: 0.28, c: '#ffb347' });
      fx(s, { k: 'pop', x: W / 2, y: H * 0.34, t: 'SNAP!', c: '#ffb347', size: 26 });
      fx(s, { k: 'sound', s: 'hit' });
    }

    // Lap timing, and a delta against the best lap's split at this point on the track.
    if (s.lapTick % 6 === 0) s.trace.push(Math.round(s.z));
    const idx = Math.floor(s.lapTick / 6);
    if (s.bestTrace.length > idx + 1) s.delta = Math.round(((s.bestTrace[idx] - s.z) / Math.max(8, s.vx)) * 100) / 100;

    if (s.z >= LENGTH) {
      s.z -= LENGTH;
      s.lap++;
      const secs = s.lapTick / 60;
      s.laps.push(Math.round(secs * 1000) / 1000);
      const isBest = !s.best || secs < s.best;
      if (isBest) { s.best = Math.round(secs * 1000) / 1000; s.bestTrace = s.trace.slice(0, 1200); }
      s.score += Math.max(0, Math.round(4000 - secs * 20));
      fx(s, { k: 'flash', a: 0.18, c: '#ffffff' });
      fx(s, { k: 'pop', x: W / 2, y: H * 0.3, t: `LAP ${s.lap} · ${secs.toFixed(2)}s`, c: isBest ? '#9dff3a' : '#eef3ff', size: 28 });
      fx(s, { k: 'sound', s: isBest ? 'level' : 'pick' });
      if (isBest && s.lap > 1) fx(s, { k: 'confetti' });
      s.lapTick = 0; s.trace = [];
      if (s.lap >= CONFIG.laps) {
        s.over = true; s.finished = 1;
        fx(s, { k: 'confetti' });
        fx(s, { k: 'sound', s: 'win' });
      }
    }
    return s;
  }

  // The headless driver: works out where it must already be braking for each corner it can
  // see rather than lifting the moment anything bends, and holds a slip angle rather than
  // a line. Nerve and aim vary by seed, so two seeds are two drivers and neither is perfect.
  function bot(s) {
    const b = s.bot, car = CONFIG.car;
    b.react -= 1;
    if (b.react <= 0) {
      b.react = Math.round(3 + 7 * (1 - CONFIG.botSkill) * rand(b, 'rng'));
      b.lift = rand(b, 'rng') < 0.03 ? 14 : 0;
      b.aim = Math.max(-0.95, Math.min(0.95, b.aim + (rand(b, 'rng') - 0.5) * 0.55));
    }
    if (b.lift > 0) b.lift--;

    const decel = (car.brakeForce / car.mass) * 0.9;
    let braking = false, limit = 999;
    for (let k = 1; k < 30; k++) {
      const vmax = safeSpeed(seg(s.z + k * SEG).curve) * b.nerve;
      if (vmax >= s.vx) continue;
      const needed = (s.vx * s.vx - vmax * vmax) / (2 * decel);
      if (needed >= k * SEG - SEG) { braking = true; limit = Math.min(limit, vmax); }
    }
    const tightest = seg(s.z + 26).curve;
    const hold = safeSpeed(tightest) * b.nerve;
    limit = Math.min(limit, hold);

    // Clip the apex: in the tight stuff that means putting a wheel on the kerb, which is
    // why offtrack_share should be small but never zero.
    const want = -Math.sign(tightest) * 0.25 + b.aim * 0.15;
    const offLine = (want - s.x) * ROAD_W;
    const aimPsi = Math.max(-0.25, Math.min(0.25, offLine * 0.05));
    // Match the road's required yaw first; then correct line and heading error.
    // Without this feed-forward term the old controller fought every corner.
    const desiredYaw = seg(s.z).curve / RADIUS_K * s.vx + (aimPsi - s.psi) * 1.8;
    const wheel = Math.atan((car.cgFront + car.cgRear) * desiredYaw / Math.max(6, s.vx)) + (desiredYaw - s.yaw) * 0.12;
    const lock = car.maxSteer * (0.32 + 0.68 / (1 + s.vx * s.vx / 900));
    return {
      up: !braking && !b.lift && s.vx < limit * .9,
      down: (braking && s.vx > limit) || Math.abs(s.psi) > .4,
      steer: Math.max(-1, Math.min(1, wheel / lock)),
    };
  }

  function metrics(s) {
    const laps = s.laps.length ? s.laps : [0];
    return {
      score: s.score,
      laps: s.lap,
      best_lap_s: s.best || 0,
      mean_lap_s: Math.round((laps.reduce((p, q) => p + q, 0) / laps.length) * 1000) / 1000,
      offtrack_share: Math.round((s.offTicks / Math.max(1, s.tick)) * 1000) / 1000,
      spins: s.spins,
      finished: s.finished,
    };
  }

  // --- drawing ---------------------------------------------------------------

  // --- drawing: full-width race view -----------------------------------------
  // Screen geometry is presentation only. Touch pedals retain their input columns.
  // One lateral unit remains one road half-width for both the car and the road.
  const INK = '#1d2630', DARK = '#43566a', MID = '#8a9db0', LIGHT = '#d8e0e6';
  const SX = 16, SY = 66, SW = 768, SH = 330, SCX = SX + SW / 2, SB = SY + SH;
  const HOR = SY + Math.round(SH * 0.44), NEAR = 3, RW_PX = 290, CURVE_K = 0.0117;
  const VS = (SB - HOR) / ((CAM_D / NEAR) * CAM_H);       // the nearest road row lands on the bottom edge
  const CAR = ["......11111111......", ".....1333333331.....", "....133333333331....", "...11111111111111...", "..1444444444444441..", ".122444444444444221.", ".144444444444444441.", "11111111111111111111", "1441............1441", "1441............1441"];
  // The circuit's outline for the minimap. A curve-list circuit need not turn a whole 360
  // degrees (this one nets 0.89 curve units), so its integrated shape would never close.
  // Heading sweeps one full turn evenly instead, and each corner bends it: the loop always
  // closes, and a corner still shows up on the map where it is on the lap.
  const OUTLINE = (() => {
    const mean = TRACK.reduce((a, sg) => a + sg.curve, 0) / TRACK.length;
    let h = 0, x = 0, y = 0;
    const pts = TRACK.map((sg) => { h += (2 * Math.PI) / TRACK.length + (sg.curve - mean) * 0.03; x += Math.cos(h); y += Math.sin(h); return [x, y]; });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const f = Math.min(56 / (Math.max(...xs) - x0 || 1), 40 / (Math.max(...ys) - y0 || 1));
    return pts.map(([px, py]) => [Math.round((px - x0) * f / 2) * 2, Math.round((py - y0) * f / 2) * 2]);
  })();

  function box(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function label(c, t, x, y, size = 16, col = INK, align = 'center') { c.fillStyle = col; c.font = `bold ${size}px monospace`; c.textAlign = align; c.fillText(t, x, y); }
  function sprite(c, rows, x, y, scale, pal) {
    x = Math.round(x); y = Math.round(y);
    rows.forEach((row, j) => [...row].forEach((v, i) => { if (v !== '.') box(c, x + i * scale, y + j * scale, scale, scale, pal[Number(v) - 1]); }));
  }
  const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
  const pips = (c, x, y, n, lit, on, off, w = 6) => { for (let k = 0; k < n; k++) box(c, x + k * (w + 2), y, w, 6, k < lit ? on : off); };

  function render(s, c, ui) {
    c.imageSmoothingEnabled = false;
    const here = seg(s.z), base = Math.floor(s.z / SEG), camY = here.y + CAM_H;
    // The device.
    box(c, 0, 0, W, H, '#e7e4d7');box(c,16,18,3,31,'#b36d51');
    label(c, 'APEX CIRCUIT', 28, 34, 22, INK, 'left'); label(c, 'MONTEREY / 04', 28, 50, 11, DARK, 'left');
    label(c, 'MONTEREY RIDGE / TIME ATTACK', 396, 34, 11, DARK);
    label(c, `LAP ${Math.min(s.lap + 1, CONFIG.laps)}/${CONFIG.laps}`, 772, 32, 18, INK, 'right');
    label(c, `${clock(s.lapTick / 60)}  BEST ${s.best ? clock(s.best) : '-:--.-'}`, 772, 50, 11, DARK, 'right');
    box(c, 12, 62, 776, 338, '#607978');

    c.save(); c.beginPath(); c.rect(SX, SY, SW, SH); c.clip();
    box(c, SX, SY, SW, HOR - SY, '#c8d9d7');
    box(c, SX, HOR, SW, SB - HOR, '#789077');
    c.fillStyle='#f6e3af';c.beginPath();c.arc(590,119,22,0,Math.PI*2);c.fill();
    const slide=here.curve*24;
    for(let layer=0;layer<2;layer++){
      c.fillStyle=layer?'#7b9a8c':'#a0b6a6';c.beginPath();c.moveTo(SX,HOR);
      for(let x=SX;x<=SX+SW+8;x+=8){const k=(x-slide*(layer+1))/8;c.lineTo(x,HOR-22-layer*8-(18+layer*4)*Math.sin(k*.07+layer)-12*Math.sin(k*.13));}
      c.lineTo(SX+SW,HOR);c.closePath();c.fill();
    }
    // The road, near to far in 2px scanlines. `top` only ever rises, so a crest hides the
    // road beyond it the way the brief's blind crests should.
    let dx = 0, xw = 0, top = SB, prev = null;
    for (let k = 0; k < DRAW; k++) {
      const sg = TRACK[(base + k) % TRACK.length];
      // The first boundary is behind the camera once the car is past NEAR into its segment;
      // clamped to the near plane it lands on the bottom edge instead of projecting garbage.
      const dz = Math.max(NEAR, k * SEG - (s.z % SEG) + NEAR), scale = CAM_D / dz;
      dx += sg.curve * CURVE_K; xw += dx;
      const p = { x: SCX + scale * (xw - s.x) * RW_PX, y: HOR - scale * (sg.y - camY) * VS, w: scale * RW_PX };
      if (prev) {
        const stripe = Math.floor((base + k) / 3) % 2 === 0;
        const y0 = Math.max(SY, Math.round(p.y / 2) * 2), y1 = Math.min(top, Math.round(prev.y / 2) * 2);
        for (let y = y0; y < y1; y += 2) {
          const f = (y - p.y) / ((prev.y - p.y) || 1), x = p.x + (prev.x - p.x) * f, w = p.w + (prev.w - p.w) * f;
          box(c, SX, y, SW, 2, stripe ? '#72866a' : '#7e9272');
          if (sg.kerb) { const e = Math.max(2, w * .1); box(c, x - w - e, y, e, 2, stripe ? '#eadfbe' : '#ba7561'); box(c, x + w, y, e, 2, stripe ? '#eadfbe' : '#ba7561'); }
          else { box(c, x - w - 2, y, 2, 2, LIGHT); box(c, x + w, y, 2, 2, LIGHT); }
          box(c, x - w, y, w * 2, 2, stripe ? '#57676b' : '#5c6c70');
          if (stripe && w > 8) box(c, x - Math.max(1, w * .015), y, Math.max(2, w * .03), 2, LIGHT);
        }
        top = Math.min(top, y0);
      }
      prev = p;
    }
    // The car. It leans with the rear's slip, and a sliding rear throws smoke.
    const lean = Math.max(-6, Math.min(6, Math.round(-s.slipR * 24 / 2) * 2));
    if (s.smoke > 0.25) for (let k = 0; k < 8; k++) if ((k + s.tick) % 3) box(c, SCX - 38 + lean + (k % 4) * 22 + (s.tick % 2) * 2, SB - 10 - Math.floor(k / 4) * 6, 4, 4, k % 2 ? LIGHT : MID);
    sprite(c, CAR, SCX - 30 + lean, SB - 34, 3, ['#243841', '#e2b176', '#b7674f', '#577d8a']);
    // Glass-top readouts: the sector, the gap to your best lap, the minimap.
    box(c, SX, SY, SW, 16, LIGHT);
    label(c, here.sector.toUpperCase(), SX + 8, SY + 12, 10, INK, 'left');
    if (s.best && s.lap > 0) label(c, (s.delta > 0 ? '+' : '') + s.delta.toFixed(2), SX + SW - 8, SY + 12, 10, s.delta > 0 ? DARK : INK, 'right');
    const mx = SX + SW - 74, my = SY + 22;
    box(c, mx, my, 66, 50, INK); box(c, mx + 2, my + 2, 62, 46, LIGHT);
    for (let i = 0; i < OUTLINE.length; i += 2) box(c, mx + 5 + OUTLINE[i][0], my + 5 + OUTLINE[i][1], 2, 2, DARK);
    const me = OUTLINE[Math.floor(s.z / SEG) % OUTLINE.length];
    if (s.tick % 20 < 14) box(c, mx + 4 + me[0], my + 4 + me[1], 4, 4, INK);

    if (s.tick < 150 && !s.over) {
      box(c, SCX - 150, SY + 96, 300, 104, INK); box(c, SCX - 146, SY + 100, 292, 96, LIGHT);
      label(c, 'APEX CIRCUIT', SCX, SY + 132, 22);
      label(c, 'MONTEREY RIDGE · COUPE · 3 LAPS', SCX, SY + 156, 11, DARK);
      if (Math.floor(s.tick / 20) % 2) label(c, 'A · GAS TO GO', SCX, SY + 182, 12);
    }
    if (s.over) {
      box(c, SX + 20, SY + 50, SW - 40, SH - 100, INK);
      label(c, s.finished ? 'THE LAP IS YOURS' : 'SESSION OVER', SCX, SY + 90, 20, LIGHT);
      label(c, 'BEST ' + (s.best ? clock(s.best) : '-:--.-'), SCX, SY + 128, 24, MID);
      label(c, s.laps.slice(-3).map(clock).join('  '), SCX, SY + 156, 12, LIGHT);
      label(c, `${s.spins} SPIN${s.spins === 1 ? '' : 'S'}`, SCX, SY + 178, 11, MID);
      if (ui && ui.best) label(c, s.score >= ui.best ? 'A NEW BEST' : 'BEST SCORE ' + ui.best, SCX, SY + 200, 11, LIGHT);
      label(c, 'SPACE / TAP TO RACE AGAIN', SCX, SY + 226, 12, LIGHT);
    }
    c.restore();

    // Compact dashboard and pedals leave the full width available to the road.
    box(c,16,410,116,53,'#293f45');label(c,'← STEER →',74,438,15,'#eae5d3');label(c,'DRAG / ARROWS',74,453,9,'#b0c1b8');
    label(c,String(Math.round(s.vx*3.6)).padStart(3,'0'),150,444,34,INK,'left');
    label(c,'KM/H',150,462,10,DARK,'left');label(c,'G'+(s.gear+1),238,443,23,INK,'left');
    const rev=rpmOf(CONFIG.car,s.vx,s.gear)/CONFIG.car.redline;
    pips(c,285,421,14,Math.round(rev*14),rev>.93?'#b66b50':'#4f7774','#c0c4b6',6);
    label(c,'RPM',285,445,9,DARK,'left');
    const share=s.loadF/Math.max(1,s.loadF+s.loadR),past=a=>Math.abs(a)>.13&&s.tick%10<5;
    label(c,'F',417,426,10,DARK,'left');pips(c,433,419,5,Math.round(share*10)-2,past(s.slipF)?'#c0c4b6':INK,'#c0c4b6');
    label(c,'R',417,449,10,DARK,'left');pips(c,433,442,5,Math.round((1-share)*10)-2,past(s.slipR)?'#c0c4b6':INK,'#c0c4b6');
    label(c,'TYRE LOAD',417,464,9,DARK,'left');
    const r=ui&&ui.rank;if(r)label(c,'LV '+r.level,285,463,10,DARK,'left');
    box(c,546,414,104,52,'#c5c7bb');label(c,'B · BRAKE',598,439,14,INK);label(c,'↓ / S',598,456,10,DARK);
    box(c,668,410,114,56,'#a85f48');label(c,'A · GAS',725,439,17,'#fff0d5');label(c,'↑ / W',725,456,10,'#f3d0b5');

  }

  globalThis.Game = {id: "apex-circuit",
    guide: {
  "version": 1,
  "summary": "Rear-wheel-drive time trial on one circuit, three laps within ten minutes.",
  "goal": "Complete three laps; performance goal is your personal best, not an existing medal target.",
  "lose": "Ten-minute run cap without completing the laps.",
  "rules": [
    "Rear-wheel-drive time trial on one circuit, three laps within ten minutes. Throttle can induce rear slides. Best lap persists; no opponent, medal threshold or championship exists yet."
  ],
  "controls": [
    {
      "action": "Drive / brake",
      "keyboard": "W/Up / S/Down",
      "touch": "Pedals"
    },
    {
      "action": "Steer",
      "keyboard": "A/D or Left/Right",
      "touch": "Steering controls"
    }
  ],
  "firstSteps": [
    "Accelerate on the straight.",
    "Brake before a corner and feed in throttle on exit."
  ],
  "tips": [
    "Brake before the corner; full throttle while turning can spin the rear tires."
  ],
  "modes": []
},

    title: CONFIG.title, autoJuice: false, width: W, height: H,
    controls: 'Up/W throttle, Down/S brake, Left/Right steer. Touch stick and pedals.',
    touchStick: (s, p) => !s.over && (!p || p.x < 400),
    init, step, bot, metrics, render,
    progress: (s) => ({ best: s.best || 0 }),
    rules: { seg, safeSpeed, surfaceAt, TRACK },
  };
})();
