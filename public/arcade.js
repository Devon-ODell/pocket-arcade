// arcade.js — home screen, play page and the bug portal. Reads games.json, posts to api/bugs.
// Everything user- or game-supplied goes in with textContent, never innerHTML.
(function () {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const PAGE = document.body.dataset.page;

  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v);
    }
    node.append(...kids.filter(Boolean));
    return node;
  }

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ago(t) {
    const s = Math.max(0, Date.now() / 1000 - t);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }

  const playUrl = (g) => `play.html?game=${encodeURIComponent(g.slug)}`;

  // ---------------------------------------------------------------- home

  const COLORS = ['#27e0ff', '#ff4fd8', '#9dff3a', '#ffb627'];

  // Studio games save their best score as `studio:<title>:best` on this same site.
  function bestScore(g) {
    try { return Number(localStorage.getItem(`studio:${g.title}:best`)) || 0; } catch (e) { return 0; }
  }

  function renderHome(games) {
    const grid = $('#games');
    let selected = games;
    const filters = el('nav', { class: 'categories', 'aria-label': 'Game categories' });
    const categories = { all: 'All games', arcade: 'Arcade', platformer: 'Platformers', puzzle: 'Puzzles', typing: 'Typing', racing: 'Racing', board: 'Board games', cards: 'Card games' };
    for (const [category, label] of Object.entries(categories)) {
      const count = games.filter(g => category === 'all' || (g.category || 'arcade') === category).length;
      if (!count) continue;
      const button = el('button', { type: 'button', 'data-category': category, 'aria-pressed': String(category === 'all'), text: `${label} · ${count}` });
      button.addEventListener('click', () => {
        selected = games.filter(g => category === 'all' || (g.category || 'arcade') === category);
        for (const card of grid.querySelectorAll('.card')) card.hidden = category !== 'all' && card.dataset.category !== category;
        for (const tab of filters.children) tab.setAttribute('aria-pressed', String(tab === button));
        $('#rectangle-slot').hidden = category !== 'all';
      });
      filters.append(button);
    }
    grid.before(filters);
    for (const preview of document.querySelectorAll('[data-upcoming]')) {
      preview.hidden = games.some(game => game.slug === preview.dataset.upcoming);
    }
    const nextUp = $('.next-up');
    if (nextUp) nextUp.hidden = !document.querySelector('[data-upcoming]:not([hidden])');
    const quickPlay = $('#quick-play');
    if (quickPlay) {
      quickPlay.disabled = games.length === 0;
      quickPlay.addEventListener('click', () => {
        if (selected.length) location.href = playUrl(selected[Math.floor(Math.random() * selected.length)]);
      });
    }
    const count = $('#game-count');
    if (count) count.textContent = `${games.length} game${games.length === 1 ? '' : 's'} · Free to play`;
    games.forEach((g, i) => {
      const best = bestScore(g);
      const card = el('a', { class: 'card', href: playUrl(g), 'data-category': g.category || 'arcade' },
        el('div', { class: 'thumb' },
          g.thumb ? el('img', { src: g.thumb, alt: '', loading: 'lazy' }) : null,
          g.difficulty ? el('span', { class: 'chip', text: g.difficulty }) : null,
          best ? el('span', { class: 'best', text: `Best ${best}` }) : null),
        el('div', { class: 'card-body' },
          el('h3', { text: g.title }),
          el('p', { class: 'muted', text: g.tagline }),
          g.controls ? el('p', { class: 'controls muted', text: g.controls }) : null,
          el('span', { class: 'btn', text: 'Play' })));
      card.style.setProperty('--card', g.color || COLORS[i % COLORS.length]);
      grid.append(card);
    });
    grid.append($('#rectangle-slot'));
    fillAds(games);
  }

  // House ads: until an ad network is approved, every slot promotes a game on this site.
  // To switch to a network, replace fillAds for the slots marked data-ad-slot.
  function fillAds(games) {
    const slots = [...document.querySelectorAll('[data-ad-slot]')];
    const pool = shuffle(games.filter((g) => g.thumb));
    slots.forEach((slot, i) => {
      const g = pool[i % Math.max(1, pool.length)];
      if (!g) return;
      slot.dataset.adFill = 'house';
      slot.append(el('a', { href: playUrl(g), 'aria-label': `Advertisement: play ${g.title}` },
        el('img', { src: g.thumb, alt: '' }),
        el('div', { class: 'ad-copy' },
          el('span', { class: 'ad-kicker', text: 'Free to play' }),
          el('strong', { text: g.title }),
          el('span', { text: g.tagline })),
        el('span', { class: 'ad-cta', text: 'Play now' })));
    });
  }

  // ---------------------------------------------------------------- bug portal

  function setupBugs(games, current, captureState, onOpen, onClose) {
    const form = $('#bug-form');
    const select = form.elements.game;
    select.append(el('option', { value: 'site', text: 'The arcade site itself' }));
    for (const g of games) select.append(el('option', { value: g.slug, text: g.title }));
    select.value = current ? current.slug : 'site';
    const attachRow = $('#attach-row');
    const updateAttach = () => {
      const g = games.find((x) => x.slug === select.value);
      attachRow.hidden = !(captureState && g && g.studio && current && g.slug === current.slug);
    };
    select.addEventListener('change', updateAttach);
    updateAttach();

    const status = $('#bug-status');
    const say = (text, kind) => { status.textContent = text; status.className = `status ${kind || ''}`; };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const summary = form.elements.summary.value.trim();
      if (summary.length < 3) { say('Add a few words about what went wrong.', 'err'); form.elements.summary.focus(); return; }
      const g = games.find((x) => x.slug === select.value);
      const report = {
        summary, details: form.elements.details.value.trim(), game: select.value,
        version: g ? g.version : '', severity: form.elements.severity.value || 'annoying',
        state: !attachRow.hidden && form.elements.attach.checked ? captureState() : null,
        page: location.pathname + location.search, viewport: `${innerWidth}x${innerHeight}`,
        agent: navigator.userAgent,
      };
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      say('Sending…');
      try {
        const res = await fetch('api/bugs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report) });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `server said ${res.status}`);
        say(`Thanks! Saved as report #${body.id}.`, 'ok');
        form.elements.summary.value = '';
        form.elements.details.value = '';
        refreshRecent();
      } catch (err) {
        say(`Could not send: ${err.message}. Your text is still here.`, 'err');
      } finally {
        button.disabled = false;
      }
    });

    const recent = $('#recent');
    async function refreshRecent() {
      try {
        const rows = await (await fetch('api/bugs?limit=5', { cache: 'no-store' })).json();
        recent.replaceChildren(...rows.map((r) => {
          const g = games.find((x) => x.slug === r.game);
          return el('li', {}, el('span', { class: 'meta', text: `#${r.id} · ${g ? g.title : 'Site'} · ${r.severity} · ${ago(r.t)}` }),
            document.createTextNode(r.summary));
        }));
        $('#recent-title').hidden = rows.length === 0;
      } catch (err) {
        $('#recent-title').hidden = true;
        if (form && !form.dataset.staticMode) { // static host (GitHub Pages): no bug API
          form.dataset.staticMode = '1';
          [...form.elements].forEach((n) => { n.disabled = true; });
          const note = el('p', { class: 'status', text: 'This is a static copy of the arcade — bug reports are only collected when the studio server runs (python3 -m studio.arcade).' });
          form.before(note);
        }
      }
    }
    refreshRecent();

    const panel = $('#bugs'), main = $('.main');
    const triggers = [...document.querySelectorAll('[data-open-bugs]')];
    let opener = null;
    const open = (e) => {
      if (!panel.hidden) return;
      opener = e.currentTarget;
      panel.hidden = false;
      main.inert = true;
      document.body.classList.add('bugs-open');
      triggers.forEach(b => b.setAttribute('aria-expanded', 'true'));
      if (onOpen) onOpen();
      form.elements.summary.focus();
    };
    const close = () => {
      if (panel.hidden) return;
      panel.hidden = true;
      main.inert = false;
      document.body.classList.remove('bugs-open');
      triggers.forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (opener) opener.focus();
      if (onClose) onClose();
    };
    triggers.forEach(b => b.addEventListener('click', open));
    document.querySelectorAll('[data-close-bugs]').forEach(b => b.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (panel.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (e.key === 'Tab') {
        const items = [...panel.querySelectorAll('button,input,select,textarea,a[href]')]
          .filter(n => !n.disabled && n.getClientRects().length);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  // ---------------------------------------------------------------- play page

  function setupPlay(games) {
    const slug = new URLSearchParams(location.search).get('game');
    const game = games.find((g) => g.slug === slug);
    if (!game) { location.replace('./'); return; }
    document.title = `${game.title} · Pocket Arcade`;
    $('#game-title').textContent = game.title;
    const frame = $('#frame');
    frame.title = game.title;
    frame.src = `${game.preview_revision ? `build/${game.preview_revision}/` : ""}games/${encodeURIComponent(game.slug)}/`;
    const api = () => { try { return frame.contentWindow.studio || null; } catch (e) { return null; } };
    const focusGame = () => { try { frame.focus(); frame.contentWindow.focus(); } catch (e) { /* not ready */ } };
    frame.addEventListener('load', focusGame);

    const pause = $('#pause'), restart = $('#restart');
    if (game.studio) {
      pause.hidden = false;
      restart.hidden = false;
      const sync = () => { const s = api(); if (s) pause.textContent = s.getState().paused ? 'Resume' : 'Pause'; };
      setInterval(sync, 400);
      pause.addEventListener('click', () => {
        const s = api();
        if (s) { if (s.getState().paused) s.resume(); else s.pause(); }
        sync();
        focusGame();
      });
      restart.addEventListener('click', () => {
        const s = api();
        if (s) { s.reset((Math.random() * 2 ** 31) >>> 0); s.resume(); }
        sync();
        focusGame();
      });
    }

    const capture = () => {
      const s = api();
      if (!s) return null;
      const st = s.getState();
      let snapshot = null;
      try { snapshot = JSON.parse(s.snapshot()); } catch (e) { /* older shell */ }
      return { seed: st.seed, tick: st.tick, over: st.over, metrics: st.metrics, snapshot };
    };
    let resumeAfterReport = false;
    const pauseForReport = () => {
      const s = api(); resumeAfterReport = !!(s && !s.getState().paused);
      if (s) s.pause();
    };
    const closeReport = () => {
      const s = api(); if (s && resumeAfterReport) s.resume();
      resumeAfterReport = false; focusGame();
    };
    setupBugs(games, game, game.studio ? capture : null, game.studio ? pauseForReport : null, closeReport);
  }

  // A playing iframe stays pinned to the build it loaded. New work is opt-in,
  // so a successful swarm commit cannot erase a run or mix script versions.
  // A chip in the top bar saying what the swarm is doing. Hidden unless the arcade was
  // started with --swarm-bridge, so an arcade with no swarm beside it looks no different.
  function watchSwarm() {
    const bar = document.querySelector('.topbar');
    if (!bar) return;
    const chip = el('span', { class: 'swarm-chip', title: 'The flint swarm', hidden: true });
    bar.querySelector('.spacer').after(chip);
    let timer;
    async function poll() {
      try {
        const response = await fetch('api/swarm', { cache: 'no-store' });
        const s = response.ok ? await response.json() : { enabled: false };
        chip.hidden = !s.enabled;
        if (s.enabled) {
          chip.textContent = swarmText(s);
          chip.dataset.state = s.running ? (s.doing && !s.doing.waiting ? 'working' : 'waiting') : 'stopped';
        }
      } catch (_) { chip.hidden = true; }
      timer = setTimeout(poll, 10000);
    }
    poll();
    window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
  }

  function swarmText(s) {
    const tail = [s.landed_today ? `${s.landed_today} landed today` : null,
      s.queued ? `${s.queued} queued` : null].filter(Boolean).join(' · ');
    if (!s.running) return `Swarm: stopped${tail ? ` · ${tail}` : ''}`;
    const d = s.doing;
    if (d && d.waiting) return `Swarm: ${d.waiting}${tail ? ` · ${tail}` : ''}`;
    if (!d) return `Swarm: ${s.idle || 'between tasks'}${tail ? ` · ${tail}` : ''}`;
    const round = d.round ? ` (round ${d.round}/${d.rounds})` : '';
    return `Swarm: ${d.role || 'working'} ${String(d.title || '').slice(0, 40)}${round}`
      + (tail ? ` · ${tail}` : '');
  }

  /** "2m10s" — how long the current test run has been going. */
  function elapsed(since) {
    const s = Math.max(0, Math.round(Date.now() / 1000 - since));
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
  }

  /** What the preview bar says.

   *  The revision is a merge tree of main and the swarm branch, so it moves when *either*
   *  moves. The bar used to print `status.swarm_commit` whenever it changed, which credited
   *  the swarm for commits that came from main. `changes` says which is which. */
  function describe(status, newer) {
    if (status.state === 'testing') {
      return `Testing a new build${status.testing_since ? ` · ${elapsed(status.testing_since)}` : ''}`;
    }
    if (status.state === 'failed') {
      return `New build failed its tests${status.failure_line ? ` · ${status.failure_line}` : ''}`
        + ' · still on the last tested build';
    }
    if (!newer) return `Build ${status.revision ? status.revision.slice(0, 8) : '?'} · ${status.message}`;
    const changes = status.changes || [];
    if (!changes.length) return 'New tested build ready';
    const from = changes.some((c) => c.source === 'swarm')
      ? (changes.every((c) => c.source === 'swarm') ? 'the swarm' : 'the swarm and main')
      : 'main';
    const subjects = changes.slice(0, 3).map((c) => c.subject).join('; ');
    const more = changes.length > 3 ? ` (+${changes.length - 3} more)` : '';
    return `New tested build from ${from} · ${subjects}${more}`;
  }

  function watchPreview(games) {
    const initial = games[0] && games[0].preview_revision;
    if (!initial) return;
    const label = el('span', { text: 'Live swarm preview' });
    const button = el('button', { class: 'btn update-available', type: 'button', text: 'Update available', title: 'Refresh the page to load the latest tested build', hidden: true });
    const auto = el('input', { type: 'checkbox', 'aria-label': 'Automatically load new builds' });
    try { auto.checked = localStorage.getItem('studio:auto-preview') === '1'; } catch (_) {}
    auto.addEventListener('change', () => { try { localStorage.setItem('studio:auto-preview', auto.checked ? '1' : '0'); } catch (_) {} });
    const bar = el('aside', { class: 'preview-bar', 'aria-label': 'Live swarm preview' }, label,
      el('label', {}, auto, document.createTextNode(' Auto-load (restarts game)')));
    document.querySelector('.topbar [data-open-bugs]').before(button);
    document.querySelector('.topbar').after(bar);
    button.addEventListener('click', () => location.reload());
    let timer;
    async function poll() {
      try {
        const response = await fetch('api/preview', { cache: 'no-store' });
        if (!response.ok) throw new Error('Preview unavailable');
        const status = await response.json();
        const newer = status.revision && status.revision !== initial;
        bar.dataset.state = status.state;
        label.textContent = describe(status, newer);
        label.title = `Main ${status.base_commit || ''} / Swarm ${status.swarm_commit || ''}`;
        button.hidden = !newer;
        if (newer && auto.checked && document.querySelector('#bugs').hidden) location.reload();
      } catch (_) { label.textContent = 'Preview connection lost · your current game is still running'; }
      timer = setTimeout(poll, 5000);
    }
    poll();
    window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
  }

  // ---------------------------------------------------------------- boot

  fetch('games.json', { cache: 'no-store' })
    .then((r) => r.json())
    .then((games) => {
      if (PAGE === 'home') { renderHome(games); setupBugs(games, null, null, null); }
      if (PAGE === 'play') setupPlay(games);
      watchSwarm();
      watchPreview(games);
    })
    .catch((err) => {
      const note = $('#load-error');
      if (note) { note.hidden = false; note.textContent = `Could not load the game list (${err.message}). Start the arcade with: python3 -m studio.arcade`; }
    });
})();
