// shell.js — the browser runtime every studio game shares. Do not put game rules here:
// they go in game.js, which is the only file the headless playtest can see.
//   ?seed=123  fixes the seed      ?autoplay  lets Game.bot play (thumbnails, browser checks)
(function () {
  'use strict';
  const root = document.documentElement;
  window.addEventListener('error', (e) => { root.dataset.studioError = String(e.message || e.error); });

  const Game = globalThis.Game;
  if (!Game) { root.dataset.studioError = 'game.js did not set globalThis.Game'; return; }
  const TICK_MS = 1000 / 60;
  const params = new URLSearchParams(location.search);
  const autoplay = params.has('autoplay');
  let seed = params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : (Date.now() >>> 0);

  const canvas = document.getElementById('game') || document.body.appendChild(document.createElement('canvas'));
  canvas.width = Game.width;
  canvas.height = Game.height;
  const ctx = canvas.getContext('2d');
  document.title = Game.title;

  // Stable identities survive display-name changes; retain existing title saves.
  function storageKey(kind) {
    const key = `studio:${Game.id || Game.title}:${kind}`;
    if (Game.id) try {
      if (localStorage.getItem(key) === null) {
        const titles = Game.id === 'goblins' ? [Game.title, 'Go Gin, Goblins!', 'Go Gin Goblins'] : [Game.title];
        for (const title of titles) {
          const old = localStorage.getItem(`studio:${title}:${kind}`);
          if (old !== null) { localStorage.setItem(key, old); break; }
        }
      }
    } catch (e) { /* storage remains optional */ }
    return key;
  }
  const storeKey = storageKey('best');
  let best = 0;
  try { best = Number(localStorage.getItem(storeKey)) || 0; } catch (e) { /* storage blocked */ }

  const progressKey = storageKey('progress');
  let progress = {};
  try {
    const raw = localStorage.getItem(progressKey) || '{}';
    const saved = raw.length <= 4096 ? JSON.parse(raw) : {};
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) progress = saved;
  } catch (e) { /* unavailable or damaged save */ }
  let savedProgress = JSON.stringify(progress);
  function saveProgress() {
    if (typeof Game.progress !== 'function') return;
    progress = Game.progress(state);
    const serialized = JSON.stringify(progress);
    if (serialized === savedProgress || serialized.length > 4096) return;
    try { localStorage.setItem(progressKey, serialized); savedProgress = serialized; } catch (e) { /* storage blocked */ }
  }
  let toolbar = null, difficulty = null, difficultyLabel = null;
  if (Game.guide || (Game.settings && Game.settings.difficulty)) {
    toolbar = document.createElement('div');
    toolbar.style.cssText = 'position:fixed;top:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:center;gap:12px;background:#10152b;color:#fff;font:600 15px system-ui;z-index:2';
    document.body.append(toolbar);
    document.body.style.paddingTop = '64px';
    document.body.style.boxSizing = 'border-box';
  }
  if (Game.settings && Game.settings.difficulty) {
    difficultyLabel = document.createElement('label');
    difficultyLabel.htmlFor = 'ai-difficulty';
    difficulty = document.createElement('input');
    difficulty.id = 'ai-difficulty'; difficulty.type = 'range';
    difficulty.min = '0'; difficulty.max = '2'; difficulty.step = '1';
    difficulty.setAttribute('aria-label', 'AI difficulty — starts a new match');
    difficulty.style.cssText = 'width:130px;accent-color:#9dff3a';
    toolbar.append(difficultyLabel, difficulty);
    difficulty.addEventListener('input', () => setDifficulty(Number(difficulty.value)));
  }
  function syncDifficulty() {
    if (!difficulty) return;
    difficulty.value = state.difficulty;
    const label = ['Easy', 'Medium', 'Hard'][state.difficulty];
    difficultyLabel.textContent = `AI: ${label}`;
    difficulty.setAttribute('aria-valuetext', label);
  }
  function setDifficulty(level) {
    if (!difficulty || !Number.isInteger(level) || level < 0 || level > 2) return;
    progress.difficulty = level;
    restart();
    saveProgress();
    publish();
  }

  function fit() {
    const scale = Math.min(window.innerWidth / Game.width, (window.innerHeight - (toolbar ? 64 : 0)) / Game.height);
    canvas.style.width = `${Math.floor(Game.width * scale)}px`;
    canvas.style.height = `${Math.floor(Game.height * scale)}px`;
  }
  window.addEventListener('resize', fit);
  fit();

  const typing = Game.inputMode === 'typing';
  // First-person look, opt-in: a game that sets Game.pointerLook gets pointer lock on a
  // mouse click and the mouse's movement since the last tick in input.look {dx, dy}.
  // Game.keys lists extra key codes reported as held in input.keys, so a game can have a
  // sprint or crouch key without the shell knowing what either means. Other games see
  // neither field. `pointerLook` may instead be a function (state, at) -> boolean: the pointer
  // then locks only on a click it approves (at = canvas point) and is released while it says
  // no, so a menu keeps its cursor.
  const lookMode = Game.pointerLook === true || typeof Game.pointerLook === 'function';
  const wantsLook = (at) => Game.pointerLook === true || (typeof Game.pointerLook === 'function' && !!Game.pointerLook(state, at));
  const extraKeys = Array.isArray(Game.keys) ? Game.keys.filter((k) => typeof k === 'string') : [];
  let lookDx = 0, lookDy = 0;
  const locked = () => document.pointerLockElement === canvas;
  if (lookMode) {
    document.addEventListener('mousemove', (e) => {
      if (locked() && !paused) { lookDx += e.movementX || 0; lookDy += e.movementY || 0; }
    });
  }
  let typed = '';
  const keys = new Set();
  let pointer = null, pressed = false, paused = false;
  const pauseReasons = new Set();
  let help = null, helpButton = null, helpReturnFocus = null;
  const guideKey = storageKey('guide');
  function clearInput() {
    keys.clear(); typed = ''; pressed = false; pointer = null; stick = null; lookDx = 0; lookDy = 0;
  }
  function setPause(reason, active) {
    if (active) pauseReasons.add(reason); else pauseReasons.delete(reason);
    paused = pauseReasons.size > 0;
    clearInput();
    if (paused && locked() && document.exitPointerLock) document.exitPointerLock();
    if (typeof audioContext !== 'undefined' && audioContext) {
      const task = paused ? audioContext.suspend() : audioContext.resume();
      if (task && task.catch) task.catch(() => {});
    }
  }
  function openHelp() {
    if (!help || help.open) return;
    helpReturnFocus = document.activeElement;
    setPause('help', true);
    help.showModal();
    help.querySelector('button').focus();
  }
  function closeHelp() {
    if (!help || !help.open) return;
    help.close();
    try { localStorage.setItem(guideKey, String(Game.guide.version)); } catch (e) { /* optional */ }
    if (helpButton) helpButton.textContent = 'Rules';
    setPause('help', false);
    if (helpReturnFocus && helpReturnFocus.focus) helpReturnFocus.focus();
  }
  const ACTION = ['Space', 'Enter'];
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F1') { e.preventDefault(); openHelp(); return; }
    if (help && help.open) {
      if (e.code === 'Escape') { e.preventDefault(); closeHelp(); }
      return;
    }
    if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;
    if ((!typing && e.code === 'KeyP') || e.code === 'Escape') {
      const resume = pauseReasons.has('manual') || pauseReasons.has('hidden');
      setPause('manual', !resume);
      if (resume) setPause('hidden', false);
      e.preventDefault(); return;
    }
    if (paused) return;
    if (!typing && e.code === 'KeyM') { setMuted(!muted); e.preventDefault(); return; }
    if (typing && !paused && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      if (/^[a-z]$/i.test(e.key)) { typed += e.key.toLowerCase(); e.preventDefault(); }
      else if (e.key === 'Backspace') { typed += '\b'; e.preventDefault(); }
    }
    if (ACTION.includes(e.code) && !keys.has(e.code)) pressed = true;
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => { if (document.hidden) setPause('hidden', true); });

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (Game.width / r.width), y: (e.clientY - r.top) * (Game.height / r.height) };
  }
  // Touch joystick: a game that sets Game.touchStick(state) -> true gets a floating stick
  // wherever a finger lands (never under the mouse), reported as input.stick {x, y} in [-1, 1].
  const STICK_R = Math.round(Math.min(Game.width, Game.height) * 0.12);
  let stick = null;
  const wantsStick = (e) => e.pointerType !== 'mouse' && typeof Game.touchStick === 'function' && !!Game.touchStick(state, toCanvas(e));
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    if (help && help.open || pauseReasons.has('report') || pauseReasons.has('parent')) return;
    if (paused) { setPause('manual', false); setPause('hidden', false); return; }
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or already released */ }
    const at = toCanvas(e);
    if (lookMode && e.pointerType === 'mouse' && !locked() && canvas.requestPointerLock && wantsLook(at)) {
      try { canvas.requestPointerLock(); } catch (err) { /* not allowed here; the game still plays */ }
    }
    if (!stick && wantsStick(e)) stick = { id: e.pointerId, ox: at.x, oy: at.y, x: at.x, y: at.y };
    else pointer = Object.assign(at, { down: true });
    pressed = true;

  });
  canvas.addEventListener('pointermove', (e) => {
    if (stick && e.pointerId === stick.id) Object.assign(stick, toCanvas(e));
    else if (pointer) Object.assign(pointer, toCanvas(e));
  });
  const release = (e) => {
    if (stick && e.pointerId === stick.id) stick = null;
    else if (pointer) pointer.down = false;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function stickVector() {
    if (!stick) return null;
    let x = (stick.x - stick.ox) / STICK_R, y = (stick.y - stick.oy) / STICK_R;
    const m = Math.hypot(x, y);
    if (m < 0.15) return { x: 0, y: 0 };
    if (m > 1) { x /= m; y /= m; }
    return { x, y };
  }

  function drawStick() {
    if (!stick) return;
    const v = stickVector();
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(stick.ox, stick.oy, STICK_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(stick.ox + v.x * STICK_R, stick.oy + v.y * STICK_R, STICK_R * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- juice ----------------------------------------------------------------
  // Presentation only; the rules stay in game.js and stay deterministic. A game
  // opts in by keeping an `fx` array on its state and pushing small events onto
  // it — {k:'burst'|'ring'|'pop'|'shake'|'flash'|'combo'|'confetti'|'sound', …}.
  // The shell drains that array every tick and turns it into particles, screen
  // shake, floating numbers and procedural sound, so nothing about the run
  // changes. Clear it at the top of `step` so a headless run stays small.
  // A game with no `fx` array still gets feedback, derived from its own score.
  const reduceMotion = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  })();
  const MUTE_KEY = 'studio:mute';
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { /* storage blocked */ }
  function setMuted(on) {
    muted = !!on;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
  }

  // ---- WebAudio Sound System -------------------------------------------------
  // A sound system that respects user gestures, provides loading/playback API,
  // handles muting/pausing, and has fallbacks for environments without WebAudio.
  let audioContext = null;
  let audioAvailable = true;
  const soundCache = new Map();  // For future sound loading support
  let audioSuspended = false;

  // Initialize audio context on user gesture
  function initAudio() {
    if (!audioAvailable || audioContext) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        audioAvailable = false;
        return;
      }
      audioContext = new Ctor();
      audioSuspended = audioContext.state === 'suspended';
    } catch (e) {
      audioAvailable = false;
    }
  }

  // Resume audio context on user gesture (required by browsers)
  function resumeAudio() {
    if (!audioContext || audioContext.state !== 'suspended') return;
    audioContext.resume().then(() => {
      audioSuspended = false;
    }).catch(e => {
      // Audio resume failed, but game continues
    });
  }

  // Suspend audio when game is paused
  function suspendAudio() {
    if (!audioContext || audioContext.state === 'suspended') return;
    audioContext.suspend().then(() => {
      audioSuspended = true;
    }).catch(e => {
      // Audio suspend failed, but game continues
    });
  }

  // Play a tone with WebAudio
  function tone(wave, from, to, dur, vol) {
    if (muted || !audioAvailable || !audioContext) return;
    try {
      if (audioSuspended) return;  // Don't play if suspended
      const t = audioContext.currentTime, osc = audioContext.createOscillator(), gain = audioContext.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(from, t);
      if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(audioContext.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    } catch (e) { /* no audio here; the game still plays */ }
  }

  const semi = (s) => 440 * Math.pow(2, s / 12);
  const arp = (steps, wave) => steps.forEach((s, i) => setTimeout(() => tone(wave, semi(s), semi(s), 0.13, 0.06), i * 70));
  function sound(name, n) {
    const up = Math.min(24, Math.max(0, Number(n) || 0) * 2);   // climbs with a combo
    if (name === 'hit') tone('square', 200, 60, 0.15, 0.09);
    else if (name === 'die') tone('sawtooth', 320, 40, 0.45, 0.10);
    else if (name === 'thud') tone('sine', 130, 50, 0.22, 0.09);
    else if (name === 'shot') tone('square', 620, 140, 0.05, 0.035);
    else if (name === 'splat') tone('triangle', 260, 70, 0.07, 0.04);
    else if (name === 'clear') arp([up, up + 4, up + 7, up + 12], 'triangle');
    else if (name === 'level') arp([0, 7, 12, 19], 'triangle');
    else if (name === 'win') arp([0, 4, 7, 12, 16], 'sine');
    else tone('sine', semi(up), semi(up + 7), 0.11, 0.075);     // 'pick' and anything unnamed
  }

  // Preload a sound (placeholder for future implementation)
  function loadSound(name, url) {
    if (!audioAvailable) return Promise.resolve();
    // In a real implementation, this would fetch and decode audio data
    // For now, we just cache the name for procedural generation
    soundCache.set(name, { type: 'procedural', url });
    return Promise.resolve();
  }

  // Play a sound by name
  function playSound(name, options = {}) {
    if (muted || !audioAvailable) return;
    // Initialize audio on first sound play if not already done
    if (!audioContext) initAudio();
    // Resume audio if suspended (user gesture)
    if (audioContext && audioContext.state === 'suspended') resumeAudio();

    // Play procedural sound based on name
    sound(name, options.n);
  }

  // Global sound API for games to use
  globalThis.studioSound = {
    load: loadSound,
    play: playSound,
    mute: () => setMuted(true),
    unmute: () => setMuted(false),
    toggleMute: () => setMuted(!muted),
    isMuted: () => muted,
    isAvailable: () => audioAvailable,
  };

  // Handle user gestures to initialize/resume audio
  function onUserGesture() {
    initAudio();
    if (audioContext && audioContext.state === 'suspended') {
      resumeAudio();
    }
  }

  // Add event listeners for user gestures
  window.addEventListener('click', onUserGesture, { once: true });
  window.addEventListener('keydown', onUserGesture, { once: true });
  window.addEventListener('touchstart', onUserGesture, { once: true });

  // Rank: every run feeds a per-game XP total that survives sessions, so there is
  // always a next thing to climb even in a game with no levels of its own.
  const XP_KEY = storageKey('xp');
  let xp = 0;
  try { xp = Math.max(0, Number(localStorage.getItem(XP_KEY)) || 0); } catch (e) { /* storage blocked */ }
  const SPAN = 90;                                   // xp for level 2; level n starts at SPAN*(n-1)^2
  const levelOf = (v) => Math.floor(Math.sqrt(Math.max(0, v) / SPAN)) + 1;
  let level = levelOf(xp), levelAt = -999;
  // A game drawn as a handheld (Game.autoJuice === false) keeps a limited palette, so the
  // shell's neon bar, banner and confetti would sit on top of it. It is handed the rank in
  // `ui.rank` instead and draws it in its own style.
  const retro = Game.autoJuice === false;
  function rankInfo() {
    const floor = SPAN * (level - 1) * (level - 1), ceil = SPAN * level * level;
    return {
      level,
      part: Math.max(0, Math.min(1, (xp - floor) / (ceil - floor || 1))),
      fresh: fxTick - levelAt < 150,
    };
  }
  function addXp(gain) {
    if (!(gain > 0)) return;
    xp += Math.min(5000, Math.round(gain));
    try { localStorage.setItem(XP_KEY, String(xp)); } catch (e) { /* storage blocked */ }
    const now = levelOf(xp);
    if (now > level) { level = now; levelAt = fxTick; if (!retro) confetti(); sound('level'); }
  }

  const TIERS = ['#9dff3a', '#5bd8ff', '#ffd23f', '#ff8a3d', '#ff3b6b'];
  const fx = { parts: [], rings: [], pops: [], shake: 0, flash: 0, flashC: '#fff', combo: 0, comboAt: -999 };
  let fxTick = 0, lastScore = 0, lastGainAt = -999, primed = false, wasOver = false;

  function burst(x, y, n, c, spd) {
    if (reduceMotion) return;
    const count = Math.max(1, Math.min(60, Number(n) || 12)), speed = Number(spd) || 3.2;
    for (let i = 0; i < count && fx.parts.length < 420; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random());
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, d: 0.022, g: 0.06, r: 1.5 + Math.random() * 2.5, c: c || '#9dff3a' });
    }
  }
  function confetti() {
    if (reduceMotion) return;
    for (let i = 0; i < 90 && fx.parts.length < 420; i++) {
      fx.parts.push({
        x: Math.random() * Game.width, y: -8 - Math.random() * 70,
        vx: (Math.random() - 0.5) * 1.8, vy: 1.4 + Math.random() * 2.6,
        life: 1, d: 0.007, g: 0.015, r: 2 + Math.random() * 3, c: TIERS.concat('#fff')[i % 6],
      });
    }
  }
  function emit(e) {
    if (!e || typeof e !== 'object') return;
    const x = Number(e.x) || 0, y = Number(e.y) || 0;
    if (e.k === 'burst') burst(x, y, e.n, e.c, e.spd);
    else if (e.k === 'ring') fx.rings.push({ x, y, r: Number(e.r) || 4, max: Number(e.max) || 48, life: 1, c: e.c || '#9dff3a' });
    else if (e.k === 'pop') fx.pops.push({ x, y, t: String(e.t == null ? '' : e.t), life: 1, size: Number(e.size) || 22, c: e.c || '#fff' });
    else if (e.k === 'shake') { if (!reduceMotion) fx.shake = Math.min(26, fx.shake + (Number(e.m) || 6)); }
    else if (e.k === 'flash') { fx.flash = Math.min(0.8, Number(e.a) || 0.35); fx.flashC = e.c || '#ffffff'; }
    else if (e.k === 'combo') { fx.combo = Math.max(0, Math.round(Number(e.n) || 0)); fx.comboAt = fxTick; }
    else if (e.k === 'confetti') confetti();
    else if (e.k === 'sound') sound(e.s, e.n);
  }
  function drainFx() {
    const list = state && state.fx;
    if (!Array.isArray(list)) return false;
    for (const e of list) emit(e);
    list.length = 0;                     // the game refills it on the next tick
    return true;
  }
  // Untouched games get their feedback from the one number every game reports.
  function autoJuice(driven) {
    if (Game.autoJuice === false) return;
    let score = 0;
    try { score = Number(Game.metrics(state).score) || 0; } catch (e) { return; }
    if (!primed) { primed = true; lastScore = score; return; }
    const gained = score - lastScore;
    lastScore = score;
    if (driven || gained <= 0) return;
    fx.combo = (fxTick - lastGainAt < 50) ? fx.combo + 1 : 1;
    fx.comboAt = fxTick;
    lastGainAt = fxTick;
    const x = Game.width / 2, y = Game.height * 0.3;
    fx.pops.push({ x, y, t: `+${gained}`, life: 1, size: 22 + Math.min(18, fx.combo * 2), c: TIERS[Math.min(4, Math.floor(fx.combo / 3))] });
    burst(x, y, 8 + Math.min(20, fx.combo * 2), TIERS[Math.min(4, Math.floor(fx.combo / 3))], 3);
    sound('pick', fx.combo - 1);
  }
  function overJuice(driven) {
    if (!!state.over === wasOver) return;
    wasOver = !!state.over;
    if (!wasOver || driven) return;
    let m = {};
    try { m = Game.metrics(state) || {}; } catch (e) { m = {}; }
    const score = Number(m.score) || 0;
    if (Number(m.won) > 0 || (score > 0 && score >= best)) { confetti(); sound('win'); }
    else { fx.shake = reduceMotion ? 0 : 15; fx.flash = 0.4; fx.flashC = '#ff3b6b'; sound('die'); }
  }

  function fxStep() {
    fxTick++;
    fx.shake = fx.shake > 0.15 ? fx.shake * 0.86 : 0;
    if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - 0.04);
    for (let i = fx.parts.length - 1; i >= 0; i--) {
      const p = fx.parts[i];
      p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.985; p.life -= p.d;
      if (p.life <= 0) fx.parts.splice(i, 1);
    }
    for (let i = fx.rings.length - 1; i >= 0; i--) {
      const r = fx.rings[i];
      r.r += (r.max - r.r) * 0.18; r.life -= 0.05;
      if (r.life <= 0) fx.rings.splice(i, 1);
    }
    for (let i = fx.pops.length - 1; i >= 0; i--) {
      const p = fx.pops[i];
      p.y -= 0.9; p.life -= 0.016;
      if (p.life <= 0) fx.pops.splice(i, 1);
    }
  }
  function fxDrawWorld() {
    ctx.save();
    for (const r of fx.rings) {
      ctx.globalAlpha = Math.max(0, r.life) * 0.7;
      ctx.strokeStyle = r.c; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + p.life * 0.6), 0, Math.PI * 2); ctx.fill();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of fx.pops) {
      const t = Math.max(0, p.life);
      ctx.globalAlpha = t;
      ctx.font = `bold ${Math.round(p.size * (1 + (1 - t) * 0.25))}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(p.t, p.x, p.y);
      ctx.fillStyle = p.c;
      ctx.fillText(p.t, p.x, p.y);
    }
    ctx.restore();
  }
  function fxDrawHud() {
    const age = fxTick - fx.comboAt;
    if (fx.combo >= 2 && age < 110) {
      const pop = Math.max(0, 1 - age / 12);
      ctx.save();
      ctx.globalAlpha = Math.min(1, (110 - age) / 30);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = `bold ${Math.round(26 + pop * 10 + Math.min(14, fx.combo))}px system-ui, sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.strokeText(`×${fx.combo}`, Game.width - 14, 30);
      ctx.fillStyle = TIERS[Math.min(TIERS.length - 1, Math.floor(fx.combo / 3))];
      ctx.fillText(`×${fx.combo}`, Game.width - 14, 30);
      ctx.restore();
    }
    drawRank();
    if (fx.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.75, fx.flash);
      ctx.fillStyle = fx.flashC;
      ctx.fillRect(0, 0, Game.width, Game.height);
      ctx.restore();
    }
  }
  function drawRank() {
    if (retro) return;                             // the game draws it, in its own palette
    const { part, fresh } = rankInfo();
    const h = fresh ? 5 : 3, y = Game.height - h;
    ctx.save();
    ctx.globalAlpha = fresh ? 0.95 : 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, y, Game.width, h);
    ctx.fillStyle = TIERS[Math.min(TIERS.length - 1, (level - 1) % TIERS.length)];
    ctx.fillRect(0, y, Game.width * part, h);
    if (fresh || state.over) {
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.lineJoin = 'round';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      ctx.strokeText(`LV ${level}`, 8, y - 3);
      ctx.fillStyle = '#fff';
      ctx.fillText(`LV ${level}`, 8, y - 3);
    }
    if (fxTick - levelAt < 90) {
      const t = 1 - (fxTick - levelAt) / 90;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.round(34 + (1 - t) * 8)}px system-ui, sans-serif`;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(`LEVEL ${level}`, Game.width / 2, Game.height * 0.42);
      ctx.fillStyle = TIERS[Math.min(TIERS.length - 1, (level - 1) % TIERS.length)];
      ctx.fillText(`LEVEL ${level}`, Game.width / 2, Game.height * 0.42);
    }
    ctx.restore();
  }

  const any = (...codes) => codes.some((c) => keys.has(c));
  function readInput() {
    const s = stickVector();
    const input = {
      left: (typing ? any('ArrowLeft') : any('ArrowLeft', 'KeyA')) || !!(s && s.x < -0.35), right: (typing ? any('ArrowRight') : any('ArrowRight', 'KeyD')) || !!(s && s.x > 0.35),
      up: (typing ? any('ArrowUp') : any('ArrowUp', 'KeyW')) || !!(s && s.y < -0.35), down: (typing ? any('ArrowDown') : any('ArrowDown', 'KeyS')) || !!(s && s.y > 0.35),
      action: any(...ACTION) || !!(pointer && pointer.down), actionPressed: pressed,
      pointer: pointer ? { x: pointer.x, y: pointer.y, down: pointer.down } : null,
      stick: s,
      text: typing ? typed : '',
      stash: !typing && any('KeyC', 'ShiftLeft', 'ShiftRight'),
    };
    if (lookMode) { input.look = { dx: lookDx, dy: lookDy }; lookDx = 0; lookDy = 0; }
    if (extraKeys.length) {
      const held = {};
      for (const k of extraKeys) if (keys.has(k)) held[k] = true;
      input.keys = held;
    }
    pressed = false; typed = '';
    // Preserve quick taps for one tick, then retire released coordinates.
    // Otherwise a later keyboard action is misinterpreted as the old tap.
    if (pointer && !pointer.down) pointer = null;
    return input;
  }

  let state = Game.init(seed, progress), tick = 0, overFor = 0;
  syncDifficulty();
  function restart() {
    seed = (seed + 1) >>> 0;
    state = Game.init(seed, progress);
    setPause('manual', false); setPause('hidden', false);
    syncDifficulty();
    tick = 0;
    overFor = 0;
    fx.combo = 0; fx.flash = 0; fx.shake = 0;
    primed = false; wasOver = false;
  }
  function update() {
    if (state.over) {
      overFor++;
      const input = readInput();
      if ((autoplay && overFor > 120) || (overFor > 30 && input.actionPressed)) restart();
      return;
    }
    const next = Game.step(state, autoplay ? Game.bot(state) : readInput());
    if (next !== undefined) state = next;
    tick++;
    const driven = drainFx();
    autoJuice(driven);
    overJuice(driven);
    if (tick % 60 === 0 || state.over) saveProgress();
    if (state.over) {
      const score = Number(Game.metrics(state).score) || 0;
      addXp(score);                                  // one deposit per run, on the tick it ends
      if (score > best) {
        best = score;
        try { localStorage.setItem(storeKey, String(best)); } catch (e) { /* storage blocked */ }
      }
    }
  }

  function publish() {
    root.dataset.studioReady = '1';
    root.dataset.studioTick = String(tick);
    root.dataset.studioOver = state.over ? '1' : '0';
    root.dataset.studioMetrics = JSON.stringify(Game.metrics(state));
  }

  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= TICK_MS) {
      if (!paused) update();
      acc -= TICK_MS;
    }
    if (!paused) fxStep();
    ctx.fillStyle = '#000';                        // shake shifts the frame; keep the edges clean
    ctx.fillRect(0, 0, Game.width, Game.height);
    ctx.save();
    if (fx.shake) ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    Game.render(state, ctx, { best, paused, autoplay, rank: rankInfo() });
    fxDrawWorld();
    ctx.restore();
    fxDrawHud();
    if (stick && typeof Game.touchStick === 'function' && !Game.touchStick(state)) stick = null;
    drawStick();
    if (lookMode && locked() && !wantsLook() && document.exitPointerLock) document.exitPointerLock();
    if (paused && !(help && help.open)) {
      ctx.save();                                  // leave the game's canvas settings untouched
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, Game.width, Game.height);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';           // a band so the label never sits on game text
      ctx.fillRect(0, Game.height / 2 - 28, Game.width, 56);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', Game.width / 2, Game.height / 2);
      ctx.restore();
    }
    if (tick % 30 === 0 || state.over) publish();
    requestAnimationFrame(frame);
  }

  globalThis.studio = {
    getState: () => ({ ready: true, seed, tick, over: !!state.over, paused, helpOpen: !!(help && help.open), pauseReasons: Array.from(pauseReasons), metrics: Game.metrics(state) }),
    snapshot: () => JSON.stringify(state),   // the whole run as plain data, for bug reports
    reset: (s) => { seed = ((s === undefined ? seed : s) - 1) >>> 0; restart(); },
    setDifficulty,
    openHelp, closeHelp,
    pause: (reason = 'parent') => setPause(reason, true),
    resume: (reason = 'parent') => {
      setPause(reason, false);
      if (reason === 'manual' && !document.hidden) setPause('hidden', false);
    },
    muted: () => muted,
    setMuted,
  };

  // Native dialog provides modal focus containment and makes background controls inert.
  if (Game.guide) {
    const guide = Game.guide;
    const node = (tag, text, parent) => {
      const el = document.createElement(tag);
      if (text !== undefined) el.textContent = text;
      if (parent) parent.append(el);
      return el;
    };
    const style = node('style', `
      .studio-guide { color:#efe9d8; background:#15262e; border:2px solid #b99c68;
        border-radius:16px; box-shadow:0 18px 80px #0009; padding:0;
        width:min(580px,calc(100vw - 24px)); max-height:calc(100dvh - 24px);
        box-sizing:border-box; overflow-wrap:anywhere; font:16px/1.55 system-ui,sans-serif; }
      .studio-guide::backdrop { background:#030b16cf; }
      .studio-guide header { padding:20px 22px 12px; border-bottom:1px solid #526269; }
      .studio-guide h2 { margin:0; font-size:25px; }
      .studio-guide h3 { color:#efc682; margin:20px 0 6px; font-size:17px; }
      .studio-guide p { margin:6px 0 12px; }
      .studio-guide .pages { padding:0 22px 22px; overflow-wrap:anywhere; }
      .studio-guide ul, .studio-guide ol { padding-left:22px; }
      .studio-guide li { margin:7px 0; }
      .studio-guide button, .studio-rules { min-height:44px; padding:8px 15px;
        border:1px solid #bd9e67; border-radius:8px; background:#efd49b;
        color:#15262e; cursor:pointer; font:700 15px system-ui,sans-serif; }
      .studio-guide button:focus-visible, .studio-rules:focus-visible { outline:3px solid #83e2dd; outline-offset:3px; }
      .studio-guide footer { position:sticky; bottom:0; padding:12px 22px;
        background:#15262e; border-top:1px solid #526269; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
      .studio-guide label { display:flex; gap:8px; align-items:center; font-size:13px; min-height:44px; }
      .studio-guide .control { padding:10px 0; border-bottom:1px solid #344851; }
      .studio-guide small { color:#b9c9c6; display:block; }
      .studio-guide nav { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
      .studio-guide nav button { background:#243f47; color:#efe9d8; }
      .studio-guide button { min-width:0; max-width:100%; box-sizing:border-box; overflow-wrap:anywhere; }
      @media (max-width:360px) {
        .studio-guide header, .studio-guide footer { padding:10px; }
        .studio-guide .pages { padding:0 10px 10px; }
        .studio-guide h2 { font-size:20px; }
      }
      .studio-guide nav button[aria-pressed=true] { background:#efd49b; color:#15262e; }
    `, document.body);
    help = node('dialog', undefined, document.body);
    help.className = 'studio-guide'; help.setAttribute('aria-labelledby', 'studio-guide-title');
    const header = node('header', undefined, help);
    const heading = node('h2', 'How to play · ' + Game.title, header); heading.id = 'studio-guide-title';
    node('p', guide.summary, header);
    const nav = node('nav', undefined, header); nav.setAttribute('aria-label', 'Tutorial pages');
    const pages = node('div', undefined, help); pages.className = 'pages';
    const sections = ['Start here', 'Rules', 'Controls', 'Strategy'];
    const panels = [], tabs = [];
    const paragraph = (parent, title, text) => { node('h3', title, parent); node('p', text, parent); };
    const list = (parent, items, ordered = false) => { const ul = node(ordered ? 'ol' : 'ul', undefined, parent); (items || []).forEach(t => node('li', t, ul)); };
    sections.forEach((name, i) => {
      const tab = node('button', name, nav); tab.type = 'button'; tabs.push(tab);
      const panel = node('section', undefined, pages); panel.id = 'guide-page-' + i;
      panel.setAttribute('aria-label', name); tab.setAttribute('aria-controls', panel.id);
      panels.push(panel);
      tab.addEventListener('click', () => {
        panels.forEach((p, j) => { p.hidden = i !== j; tabs[j].setAttribute('aria-pressed', String(i === j)); });
      });
      panel.hidden = i !== 0; tab.setAttribute('aria-pressed', String(i === 0));
    });
    paragraph(panels[0], 'Your goal', guide.goal);
    paragraph(panels[0], 'When the run ends', guide.lose);
    node('h3', 'Try this first', panels[0]); list(panels[0], guide.firstSteps, true);
    list(panels[1], guide.rules);
    (guide.modes || []).forEach(mode => paragraph(panels[1], mode.name, mode.rules));
    (guide.controls || []).forEach(control => {
      const row = node('div', undefined, panels[2]); row.className = 'control';
      node('strong', control.action, row); node('div', 'Keyboard: ' + control.keyboard, row);
      node('small', 'Touch: ' + control.touch, row);
    });
    paragraph(panels[2], 'Pause and help', typing ? 'Escape pauses. P is a letter. Use Rules or F1 for help.' : 'P or Escape pauses. Use Rules or F1 for help.');
    list(panels[3], guide.tips);
    const footer = node('footer', undefined, help);
    const label = node('label', undefined, footer);
    const automatic = node('input', undefined, label); automatic.type = 'checkbox'; automatic.checked = true;
    node('span', 'Show first-play help', label);
    try { automatic.checked = localStorage.getItem(guideKey + ':auto') !== '0'; } catch (e) { /* optional */ }
    automatic.addEventListener('change', () => { try { localStorage.setItem(guideKey + ':auto', automatic.checked ? '1' : '0'); } catch (e) {} });
    const play = node('button', 'Play / return', footer); play.type = 'button'; play.addEventListener('click', closeHelp);
    help.addEventListener('cancel', e => { e.preventDefault(); closeHelp(); });
    help.addEventListener('close', () => { if (pauseReasons.has('help')) setPause('help', false); });
    helpButton = node('button', 'Rules', toolbar); helpButton.type = 'button'; helpButton.className = 'studio-rules';
    helpButton.addEventListener('click', openHelp);
    let seen = null;
    try { seen = localStorage.getItem(guideKey); } catch (e) { /* first visit without storage */ }
    if (seen !== null && seen !== String(guide.version)) helpButton.textContent = 'Rules updated';
    const helpSeen = seen !== null || !automatic.checked;
    let helpOpen = !helpSeen && !params.has('autoplay');
    if (helpOpen) openHelp();
  }

  publish();
  requestAnimationFrame(frame);
})();
