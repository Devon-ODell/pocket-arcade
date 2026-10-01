(function () {
  'use strict';
  // Change MODE only when creating another board-game folder. All search uses these same rules.
  const MODE = /*MODE*/'tic'/*END_MODE*/;
  const CONFIG = {
    tic:     { title: 'Tic Tac Toe',  size: 3, rows: 3, connect: 3 },
    four:    { title: 'Four in a Row', size: 7, rows: 6, connect: 4 },
    reversi: { title: 'Reversi',       size: 8, rows: 8, connect: 0 },
  }[MODE];

  const W = 480, H = 720;
  const CELL = 420 / CONFIG.size, TOP = 170, LEFT = 30;
  const COLORS = ['#1e3b41', '#7fc6bd', '#e5ad72'];
  const THINK = 25;            // ticks the computer "thinks" before replying
  const FLASH = 40;            // ticks the winning line pulses
  const DROP_CAP = 22;         // a falling disc never takes longer than this

  function random(s) {
    s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
    return s.rng / 4294967296;
  }

  function init(seed, progress) {
    const board = Array(CONFIG.size * CONFIG.rows).fill(0);
    if (MODE === 'reversi') { board[27] = 2; board[28] = 1; board[35] = 1; board[36] = 2; }
    // The browser always passes a progress object (saved setting, or {} meaning "medium").
    // The headless playtest passes nothing, so vary difficulty by seed and the gate covers all three.
    const saved = progress === undefined ? seed % 3
      : Number.isInteger(progress.difficulty) ? progress.difficulty : 1;
    return {
      rng: seed >>> 0, tick: 0, over: false, board, turn: 1, winner: 0, score: 0,
      moves: 0, last: -1, cursor: 0, difficulty: Math.max(0, Math.min(2, saved)),
      wait: 0, passes: 0, fx: [],
      anim: null,      // a move in flight: {index, player, t, span, flips}
      line: null,      // the winning cells, once there are any
      queued: -1,      // a tap taken during an animation, played when it lands
    };
  }

  // --- rules -----------------------------------------------------------------

  // Reversi: the opponent discs a move at `index` would flip, in every direction.
  function flips(board, index, player) {
    if (board[index]) return [];
    const n = CONFIG.size;
    const x = index % n, y = Math.floor(index / n), all = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      let xx = x + dx, yy = y + dy;
      const line = [];
      while (xx >= 0 && xx < n && yy >= 0 && yy < n && board[yy * n + xx] === 3 - player) {
        line.push(yy * n + xx); xx += dx; yy += dy;
      }
      if (line.length && xx >= 0 && xx < n && yy >= 0 && yy < n && board[yy * n + xx] === player) {
        all.push(...line);
      }
    }
    return all;
  }

  // Every move `player` may make. For Connect 4 a move is a column, elsewhere a cell.
  function legal(board, player) {
    if (MODE === 'four') return Array.from({ length: CONFIG.size }, (_, x) => x).filter(x => !board[x]);
    return board
      .map((v, i) => i)
      .filter(i => !board[i] && (MODE !== 'reversi' || flips(board, i, player).length));
  }

  // The board after `move`, plus the cell actually filled (Connect 4 discs fall).
  function place(board, move, player) {
    const next = board.slice();
    let index = move;
    if (MODE === 'four') {
      for (let y = CONFIG.rows - 1; y >= 0; y--) {
        if (!next[y * CONFIG.size + move]) { index = y * CONFIG.size + move; break; }
      }
    }
    if (MODE === 'reversi') for (const i of flips(board, index, player)) next[i] = player;
    next[index] = player;
    return { board: next, index };
  }

  // Walk every line of `connect` cells and return the winning cells, or null.
  // Kept apart from result() so the minimax hot loop never allocates an array.
  function winningLine(board) {
    if (MODE === 'reversi') return null;
    const n = CONFIG.size, r = CONFIG.rows, k = CONFIG.connect;
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < n; x++) {
        const first = board[y * n + x];
        if (!first) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          const endX = x + (k - 1) * dx, endY = y + (k - 1) * dy;
          if (endX < 0 || endX >= n || endY >= r) continue;
          const cells = [];
          for (let j = 0; j < k; j++) {
            const i = (y + j * dy) * n + x + j * dx;
            if (board[i] !== first) { cells.length = 0; break; }
            cells.push(i);
          }
          if (cells.length === k) return cells;
        }
      }
    }
    return null;
  }

  // -1 while the game is live, else the winner (0 = draw). Called inside search().
  function result(board) {
    if (MODE === 'reversi') {
      if (legal(board, 1).length || legal(board, 2).length) return -1;
      const delta = board.filter(x => x === 1).length - board.filter(x => x === 2).length;
      return delta === 0 ? 0 : delta > 0 ? 1 : 2;
    }
    const n = CONFIG.size, r = CONFIG.rows, k = CONFIG.connect;
    for (let y = 0; y < r; y++) {
      for (let x = 0; x < n; x++) {
        const first = board[y * n + x];
        if (!first) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          const endX = x + (k - 1) * dx, endY = y + (k - 1) * dy;
          if (endX < 0 || endX >= n || endY >= r) continue;
          let match = true;
          for (let j = 1; j < k; j++) {
            if (board[(y + j * dy) * n + x + j * dx] !== first) { match = false; break; }
          }
          if (match) return first;
        }
      }
    }
    return board.every(Boolean) ? 0 : -1;
  }

  // --- the opponent ----------------------------------------------------------

  // Reversi rates corners and edges; the connect games count open runs of k.
  function evaluate(board, player) {
    if (MODE === 'reversi') {
      let score = 0;
      for (let i = 0; i < 64; i++) {
        if (!board[i]) continue;
        const x = i % 8, y = Math.floor(i / 8);
        let weight = 1;
        if ((x === 0 || x === 7) && (y === 0 || y === 7)) weight = 35;
        else if (x === 0 || x === 7 || y === 0 || y === 7) weight = 4;
        else if ((x === 1 || x === 6) && (y === 1 || y === 6)) weight = -7;
        score += board[i] === player ? weight : -weight;
      }
      return score + 3 * (legal(board, player).length - legal(board, 3 - player).length);
    }
    let score = 0;
    const n = CONFIG.size, k = CONFIG.connect;
    for (let y = 0; y < CONFIG.rows; y++) {
      for (let x = 0; x < n; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          if (x + (k - 1) * dx < 0 || x + (k - 1) * dx >= n || y + (k - 1) * dy >= CONFIG.rows) continue;
          let us = 0, them = 0;
          for (let j = 0; j < k; j++) {
            const v = board[(y + j * dy) * n + x + j * dx];
            if (v === player) us++;
            if (v === 3 - player) them++;
          }
          if (!them) score += Math.pow(5, us);
          if (!us) score -= Math.pow(5, them);
        }
      }
    }
    return score;
  }

  // Minimax with alpha-beta. Depth 0 falls back to the static evaluation.
  function search(board, turn, player, depth, alpha, beta) {
    const end = result(board);
    if (end >= 0) return end === 0 ? 0 : end === player ? 10000 + depth : -10000 - depth;
    if (!depth) return evaluate(board, player);
    const moves = legal(board, turn);
    if (!moves.length) return search(board, 3 - turn, player, depth - 1, alpha, beta);
    let value = turn === player ? -100000 : 100000;
    for (const move of moves) {
      const v = search(place(board, move, turn).board, 3 - turn, player, depth - 1, alpha, beta);
      if (turn === player) { value = Math.max(value, v); alpha = Math.max(alpha, value); }
      else { value = Math.min(value, v); beta = Math.min(beta, value); }
      if (beta <= alpha) break;
    }
    return value;
  }

  // level 0 plays at random; 1 sees wins and blocks; 2 searches several turns ahead.
  function choose(board, player, level, s) {
    const moves = legal(board, player);
    if (!moves.length) return -1;
    if (level === 0) return moves[Math.floor(random(s) * moves.length)];
    const depth = level === 1 ? 2 : MODE === 'tic' ? 9 : MODE === 'four' ? 4 : 3;
    const centre = (CONFIG.size - 1) / 2;
    const ordered = moves.slice().sort(
      (a, b) => Math.abs(a % CONFIG.size - centre) - Math.abs(b % CONFIG.size - centre));
    let best = moves[0], value = -100000;
    for (const move of ordered) {
      const v = search(place(board, move, player).board, 3 - player, player, depth - 1, -100000, 100000);
      if (v > value) { value = v; best = move; }
    }
    return best;
  }

  // --- turns -----------------------------------------------------------------

  // How long a disc takes to reach its row: further is slower, but never past the cap.
  function dropSpan(index) {
    if (MODE !== 'four') return 6;
    return Math.min(DROP_CAP, Math.round(9 + 1.6 * Math.floor(index / CONFIG.size)));
  }

  // Start a move. The board is NOT written yet: commit() does that when the disc lands,
  // so the board array stays the one source of truth and render() only ever draws it.
  function play(s, move) {
    if (s.anim || !legal(s.board, s.turn).includes(move)) return false;
    const target = place(s.board, move, s.turn);
    s.anim = {
      index: target.index, player: s.turn, t: 0, span: dropSpan(target.index),
      flips: MODE === 'reversi' ? flips(s.board, target.index, s.turn) : [],
    };
    return true;
  }

  // Presentation events for the shell; the rules never read them back.
  function fx(s, e) { if (s.fx.length < 40) s.fx.push(e); }
  const cellX = (i) => LEFT + ((i % CONFIG.size) + 0.5) * CELL;
  const cellY = (i) => TOP + (Math.floor(i / CONFIG.size) + 0.5) * CELL;

  function commit(s) {
    const a = s.anim;
    const next = place(s.board, MODE === 'four' ? a.index % CONFIG.size : a.index, a.player);
    s.board = next.board;
    s.last = a.index;
    s.moves++;
    s.turn = 3 - a.player;
    s.anim = null;
    s.wait = THINK;                                   // the pause starts once the disc has landed
    const cx = cellX(a.index), cy = cellY(a.index);
    fx(s, { k: 'ring', x: cx, y: cy, max: CELL * 0.9, c: COLORS[a.player] });
    fx(s, { k: 'burst', x: cx, y: cy, n: 8, c: COLORS[a.player], spd: 2.4 });
    fx(s, { k: 'shake', m: 4 });
    fx(s, { k: 'sound', s: 'thud' });
    if (a.flips && a.flips.length) {                  // every flipped disc gets its own pop
      for (const idx of a.flips) fx(s, { k: 'burst', x: cellX(idx), y: cellY(idx), n: 6, c: COLORS[a.player], spd: 2 });
      fx(s, { k: 'pop', x: cx, y: cy - CELL * 0.8, t: `+${a.flips.length} FLIPPED`, c: COLORS[a.player], size: 16 });
      fx(s, { k: 'sound', s: 'clear', n: a.flips.length });
    }
    const outcome = result(s.board);
    if (outcome >= 0) {
      s.over = true;
      s.winner = outcome;
      s.line = outcome > 0 ? winningLine(s.board) : null;
      s.score = outcome === 1 ? 100 : outcome === 0 ? 50 : 10;
      s.wait = 0;
      if (outcome === 1) { fx(s, { k: 'confetti' }); fx(s, { k: 'flash', a: 0.22, c: '#9dff3a' }); fx(s, { k: 'sound', s: 'win' }); }
      else if (outcome === 2) { fx(s, { k: 'shake', m: 16 }); fx(s, { k: 'flash', a: 0.32, c: '#ff3b6b' }); fx(s, { k: 'sound', s: 'die' }); }
      else fx(s, { k: 'sound', s: 'level' });
    } else if (!legal(s.board, s.turn).length) {
      s.turn = 3 - s.turn;
      s.passes++;
    }
  }

  function step(s, input) {
    if (s.over) return s;
    s.tick++;
    s.fx.length = 0;                                  // the shell drains it every tick
    if (s.anim) {                                     // a disc is in flight; input waits
      s.anim.t++;
      const i = input || {};
      if (i.actionPressed && i.pointer) s.queued = pointerMove(i.pointer);
      if (s.anim.t >= s.anim.span) commit(s);
      return s;
    }
    if (s.wait > 0) { s.wait--; return s; }
    if (s.queued >= 0) { const m = s.queued; s.queued = -1; if (play(s, m)) return s; }
    if (s.turn === 2) { play(s, choose(s.board, 2, s.difficulty, s)); return s; }

    const i = input || {};
    const cells = CONFIG.size * CONFIG.rows;
    if (s.tick % 8 === 0) {                           // Connect 4 only ever picks a column
      if (MODE === 'four') {
        if (i.left) s.cursor = (s.cursor + CONFIG.size - 1) % CONFIG.size;
        if (i.right) s.cursor = (s.cursor + 1) % CONFIG.size;
      } else {
        if (i.left) s.cursor = (s.cursor + cells - 1) % cells;
        if (i.right) s.cursor = (s.cursor + 1) % cells;
        if (i.up) s.cursor = (s.cursor + CONFIG.size * (CONFIG.rows - 1)) % cells;
        if (i.down) s.cursor = (s.cursor + CONFIG.size) % cells;
      }
    }
    if (i.actionPressed) {
      let move = s.cursor;
      if (i.pointer) {
        move = pointerMove(i.pointer);
        if (move < 0) return s;
      }
      play(s, move);
    }
    return s;
  }

  // A tap becomes a column in Connect 4 and a cell elsewhere; -1 means "off the board".
  function pointerMove(pointer) {
    const x = Math.floor((pointer.x - LEFT) / CELL);
    const y = Math.floor((pointer.y - TOP) / CELL);
    if (x < 0 || x >= CONFIG.size) return -1;
    if (MODE === 'four') return x;
    if (y < 0 || y >= CONFIG.rows) return -1;
    return y * CONFIG.size + x;
  }

  // The headless player always plays at one casual strength (level 1). The computer's
  // strength is what s.difficulty changes, so holding the bot steady is what makes
  // won_easy / won_hard a measurement of the difficulty setting rather than of itself.
  function bot(s) {
    if (s.anim || s.wait || s.turn !== 1) return {};
    const move = choose(s.board, 1, 1, s);
    if (move < 0) return {};
    const col = MODE === 'four' ? move : move % CONFIG.size;
    const row = MODE === 'four' ? 0 : Math.floor(move / CONFIG.size);
    return { actionPressed: true, pointer: { x: LEFT + (col + 0.5) * CELL, y: TOP + (row + 0.5) * CELL, down: true } };
  }

  // --- drawing ---------------------------------------------------------------

  function text(c, value, x, y, size = 18, color = '#e8f1ff') {
    c.fillStyle = color;
    c.font = `bold ${size}px system-ui`;
    c.textAlign = 'center';
    c.fillText(value, x, y);
  }

  function disc(c,cx,cy,player,radius){
    c.save();c.translate(cx,cy);
    if(MODE==='tic'){
      c.strokeStyle=COLORS[player];c.lineWidth=Math.max(5,radius*.18);c.lineCap='round';c.beginPath();
      if(player===1){const r=radius*.65;c.moveTo(-r,-r);c.lineTo(r,r);c.moveTo(r,-r);c.lineTo(-r,r);}
      else c.arc(0,0,radius*.76,0,Math.PI*2);
      c.stroke();
    }else{
      c.fillStyle='#0a252e';c.beginPath();c.arc(0,3,radius+1,0,Math.PI*2);c.fill();
      c.fillStyle=COLORS[player];c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.fill();
      c.strokeStyle='#ffffff50';c.lineWidth=1.5;c.beginPath();c.arc(0,-1,radius*.78,Math.PI,Math.PI*2);c.stroke();
      c.strokeStyle='#18394045';c.beginPath();c.arc(0,1,radius*.72,0,Math.PI);c.stroke();
      c.strokeStyle='#16363835';c.lineWidth=1;c.beginPath();c.arc(0,0,radius*.48,0,Math.PI*2);c.stroke();
    }
    c.restore();
  }

  function render(s, c) {
    c.fillStyle = '#142f36';
    c.fillRect(0, 0, W, H);
    for(let y=0;y<H;y+=6){c.fillStyle=y%18?'#173138':'#19343a';c.fillRect(0,y,W,1);}
    c.fillStyle='#ba9b6b';c.fillRect(30,25,3,31);
    text(c, CONFIG.title, 240, 48, 32);
    text(c, MODE==='tic'?'YOU / ×       COMPUTER / ○':'YOU / MINT       COMPUTER / AMBER', 240, 80, 12, '#9bb8b4');
    const status = s.over
      ? (s.winner === 1 ? 'You win!' : s.winner === 2 ? 'Computer wins' : 'A well-played draw')
      : s.turn === 1 ? 'Your move' : 'Computer is thinking…';
    text(c, status, 240, 126, 23, s.turn === 1 ? '#9bd5c9' : '#e5ad72');

    // Connect 4 shows the pending column as a disc hovering over the board.
    if (MODE === 'four' && !s.over && !s.anim && s.turn === 1) {
      disc(c, LEFT + (s.cursor + 0.5) * CELL, TOP - 26, 1, CELL * 0.26);
    }

    // A continuous tray for Four in a Row; a quiet ruled surface for noughts and crosses.
    c.fillStyle='#081f29';c.fillRect(LEFT-8,TOP-8,420+16,CELL*CONFIG.rows+22);
    c.fillStyle=MODE==='four'?'#3d6267':'#28494e';c.fillRect(LEFT-8,TOP-12,436,CELL*CONFIG.rows+20);
    c.fillStyle='#78918a';c.fillRect(LEFT-8,TOP-12,436,2);
    const available = legal(s.board, 1);
    const pulse = s.line ? 0.5 + 0.5 * Math.sin(s.tick * 0.25) : 0;
    for (let y = 0; y < CONFIG.rows; y++) {
      for (let x = 0; x < CONFIG.size; x++) {
        const i = y * CONFIG.size + x, xx = LEFT + x * CELL, yy = TOP + y * CELL;
        c.fillStyle=MODE==='four'?'#1c3942':((x+y)%2?'#29494e':'#2c4d51');
        if(MODE==='four'){
          c.beginPath();c.arc(xx+CELL/2,yy+CELL/2,CELL*.36,0,Math.PI*2);c.fill();
          c.strokeStyle='#829b8e';c.lineWidth=1;c.beginPath();c.arc(xx+CELL/2,yy+CELL/2,CELL*.36,0,Math.PI);c.stroke();
        }else c.fillRect(xx+2,yy+2,CELL-4,CELL-4);
        if (s.line && s.line.includes(i)) {          // the winning cells pulse
          c.fillStyle = `rgba(231,232,202,${0.25 + 0.45 * pulse})`;
          c.fillRect(xx + 2, yy + 2, CELL - 4, CELL - 4);
        } else if (s.last === i && !s.over) {
          c.strokeStyle = '#e7e8ca';
          c.lineWidth = 3;
          c.strokeRect(xx + 4, yy + 4, CELL - 8, CELL - 8);
        }
        const v = s.board[i];
        if (v) {
          disc(c, xx + CELL / 2, yy + CELL / 2, v, CELL * 0.34);
        } else if (!s.over && !s.anim && s.turn === 1 && MODE !== 'four' && available.includes(i)) {
          c.fillStyle = '#a7cfc366';
          c.beginPath();
          c.arc(xx + CELL / 2, yy + CELL / 2, 4, 0, Math.PI * 2);
          c.fill();
        }
        if (s.cursor === i && !s.over && MODE !== 'four') {
          c.strokeStyle = '#e3c993';
          c.lineWidth = 2;
          c.strokeRect(xx + 8, yy + 8, CELL - 16, CELL - 16);
        }
      }
    }

    // The disc in flight, eased by t squared, with a short squash as it lands.
    if (s.anim) {
      const a = s.anim;
      const col = a.index % CONFIG.size, row = Math.floor(a.index / CONFIG.size);
      const p = Math.min(1, a.t / a.span);
      const endY = TOP + row * CELL + CELL / 2;
      const startY = MODE === 'four' ? TOP - 26 : endY;
      const cy = startY + (endY - startY) * p * p;
      const squash = p > 0.86 ? 1 - 0.22 * Math.sin((p - 0.86) / 0.14 * Math.PI) : 1;
      const r = CELL * 0.34 * (MODE === 'four' ? 1 : Math.min(1, 0.4 + p));
      c.save();
      c.translate(LEFT + (col + 0.5) * CELL, cy);
      c.scale(1 / Math.max(0.4, squash), squash);
      disc(c, 0, 0, a.player, r);
      c.restore();
    }

    const footer = TOP + CELL * CONFIG.rows + 32;
    const hint = MODE === 'reversi'
      ? `You ${s.board.filter(v => v === 1).length}  ·  Computer ${s.board.filter(v => v === 2).length}`
      : MODE === 'four' ? 'Drop a disc. Connect four to win.' : 'Three in a row wins.';
    text(c, hint, 240, footer, 17);
    text(c, s.over ? 'Tap or press Space for a rematch' : MODE==='four'?'Choose a column · ← → + Space to drop':'Tap a square · Arrows + Space also work',
         240, footer + 30, 13, '#9bb8b4');
    const passes = s.passes ? `  ·  Passes ${s.passes}` : '';
    text(c, `AI: ${['EASY', 'MEDIUM', 'HARD'][s.difficulty]}  ·  ${s.moves} moves${passes}`,
         240, 690, 12, '#9bb8b4');
  }

  globalThis.Game = {id: "tic-tac-toe",
    guide: {
  "version": 1,
  "summary": "Standard 3x3; three in a row wins, full board draws.",
  "goal": "Three aligned marks; a specified later training lesson can instead reward forcing a draw.",
  "lose": "Opponent makes three; a full board without a line is a draw, not a failure.",
  "rules": [
    "Standard 3x3; three in a row wins, full board draws. Hard searches the complete tree and should never lose. Progress currently stores difficulty only; this ruleset has a genuine complexity ceiling."
  ],
  "controls": [
    {
      "action": "Place mark",
      "keyboard": "Arrows + Space",
      "touch": "Tap an empty cell"
    }
  ],
  "firstSteps": [
    "Place a mark in an empty square.",
    "Block an immediate opposing line before making another threat."
  ],
  "tips": [
    "A draw against perfect play is a valid result; do not open a fork trying to force a win."
  ],
  "modes": []
},

    title: CONFIG.title, width: W, height: H, init, step, bot, render,
    metrics: s => ({
      score: s.score, moves: s.moves,
      won: s.winner === 1 ? 1 : 0,
      draw: s.over && s.winner === 0 ? 1 : 0,
      won_easy: s.difficulty === 0 && s.winner === 1 ? 1 : 0,
      won_medium: s.difficulty === 1 && s.winner === 1 ? 1 : 0,
      won_hard: s.difficulty === 2 && s.winner === 1 ? 1 : 0,
    }),
    settings: { difficulty: true },
    rules: { legal, place, result, choose, flips, winningLine },
    progress: s => ({ difficulty: s.difficulty }),
  };
})();
