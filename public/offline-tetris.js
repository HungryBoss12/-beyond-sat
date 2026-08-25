/**
 * Tiny Tetris for the BeyondSAT offline page.
 * Exposes window.startOfflineTetris(root) → destroy fn.
 */
(function () {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 18;

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    J: [
      [1, 0, 0],
      [1, 1, 1],
    ],
    L: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  };

  const COLORS = {
    I: "#7dd3fc",
    O: "#fde68a",
    T: "#c4b5fd",
    S: "#86efac",
    Z: "#fda4af",
    J: "#93c5fd",
    L: "#fdba74",
  };

  const KEYS = Object.keys(SHAPES);

  function rotate(matrix) {
    const h = matrix.length;
    const w = matrix[0].length;
    const next = Array.from({ length: w }, () => Array(h).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        next[x][h - 1 - y] = matrix[y][x];
      }
    }
    return next;
  }

  function clone(m) {
    return m.map((row) => row.slice());
  }

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function randomPiece() {
    const type = KEYS[(Math.random() * KEYS.length) | 0];
    const shape = clone(SHAPES[type]);
    return {
      type,
      shape,
      x: ((COLS - shape[0].length) / 2) | 0,
      y: 0,
    };
  }

  function collides(board, piece, ox, oy, shape) {
    const m = shape || piece.shape;
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const nx = piece.x + x + (ox || 0);
        const ny = piece.y + y + (oy || 0);
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  /**
   * @param {HTMLElement} root
   * @returns {() => void}
   */
  function startOfflineTetris(root) {
    if (!root) return () => {};

    const canvas = root.querySelector("[data-board]");
    const scoreEl = root.querySelector("[data-score]");
    const overlayEl = root.querySelector("[data-overlay]");
    if (!(canvas instanceof HTMLCanvasElement)) return () => {};

    const ctx = canvas.getContext("2d");
    canvas.width = COLS * CELL;
    canvas.height = ROWS * CELL;

    let board = emptyBoard();
    let piece = randomPiece();
    let score = 0;
    let over = false;
    let dropMs = 650;
    let last = 0;
    let raf = 0;
    let paused = false;

    function setScore(n) {
      score = n;
      if (scoreEl) scoreEl.textContent = String(score);
    }

    function merge() {
      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (!piece.shape[y][x]) continue;
          const by = piece.y + y;
          const bx = piece.x + x;
          if (by < 0) {
            over = true;
            return;
          }
          board[by][bx] = piece.type;
        }
      }
    }

    function clearLines() {
      let cleared = 0;
      board = board.filter((row) => {
        const full = row.every((c) => c);
        if (full) cleared++;
        return !full;
      });
      while (board.length < ROWS) board.unshift(Array(COLS).fill(null));
      if (cleared) {
        setScore(score + [0, 100, 300, 500, 800][cleared]);
        dropMs = Math.max(180, 650 - Math.floor(score / 800) * 40);
      }
    }

    function spawn() {
      piece = randomPiece();
      if (collides(board, piece, 0, 0)) over = true;
    }

    function hardDrop() {
      if (over || paused) return;
      while (!collides(board, piece, 0, 1)) piece.y++;
      merge();
      if (!over) {
        clearLines();
        spawn();
      }
      draw();
    }

    function softDrop() {
      if (over || paused) return;
      if (!collides(board, piece, 0, 1)) {
        piece.y++;
        setScore(score + 1);
      } else {
        merge();
        if (!over) {
          clearLines();
          spawn();
        }
      }
      draw();
    }

    function move(dx) {
      if (over || paused) return;
      if (!collides(board, piece, dx, 0)) piece.x += dx;
      draw();
    }

    function turn() {
      if (over || paused) return;
      const next = rotate(piece.shape);
      if (!collides(board, piece, 0, 0, next)) piece.shape = next;
      else if (!collides(board, piece, -1, 0, next)) {
        piece.x -= 1;
        piece.shape = next;
      } else if (!collides(board, piece, 1, 0, next)) {
        piece.x += 1;
        piece.shape = next;
      }
      draw();
    }

    function restart() {
      board = emptyBoard();
      piece = randomPiece();
      setScore(0);
      over = false;
      paused = false;
      dropMs = 650;
      last = performance.now();
      if (overlayEl) overlayEl.hidden = true;
      draw();
    }

    function drawCell(x, y, color) {
      const px = x * CELL;
      const py = y * CELL;
      ctx.fillStyle = color;
      ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(px + 1, py + 1, CELL - 2, 3);
    }

    function draw() {
      ctx.fillStyle = "#040459";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL + 0.5, 0);
        ctx.lineTo(x * CELL + 0.5, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL + 0.5);
        ctx.lineTo(canvas.width, y * CELL + 0.5);
        ctx.stroke();
      }

      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const t = board[y][x];
          if (t) drawCell(x, y, COLORS[t]);
        }
      }

      if (!over) {
        for (let y = 0; y < piece.shape.length; y++) {
          for (let x = 0; x < piece.shape[y].length; x++) {
            if (!piece.shape[y][x]) continue;
            const by = piece.y + y;
            const bx = piece.x + x;
            if (by >= 0) drawCell(bx, by, COLORS[piece.type]);
          }
        }
      }

      if (over && overlayEl) {
        overlayEl.hidden = false;
        overlayEl.textContent = "Game over · tap New game";
      }
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (over || paused) return;
      if (now - last >= dropMs) {
        last = now;
        if (!collides(board, piece, 0, 1)) piece.y++;
        else {
          merge();
          if (!over) {
            clearLines();
            spawn();
          }
        }
        draw();
      }
    }

    function onKey(e) {
      if (e.target && /** @type {HTMLElement} */ (e.target).closest("button[data-retry]")) return;
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          move(-1);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          move(1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          softDrop();
          break;
        case "ArrowUp":
        case "w":
        case "W":
        case " ":
          e.preventDefault();
          turn();
          break;
        case "Enter":
          if (over) restart();
          break;
        default:
          break;
      }
    }

    const bind = (sel, fn) => {
      const el = root.querySelector(sel);
      if (!el) return;
      const handler = (e) => {
        e.preventDefault();
        fn();
      };
      el.addEventListener("pointerdown", handler);
      cleanups.push(() => el.removeEventListener("pointerdown", handler));
    };

    const cleanups = [];
    bind("[data-left]", () => move(-1));
    bind("[data-right]", () => move(1));
    bind("[data-rotate]", () => turn());
    bind("[data-soft]", () => softDrop());
    bind("[data-hard]", () => hardDrop());
    bind("[data-restart]", () => restart());

    window.addEventListener("keydown", onKey);
    cleanups.push(() => window.removeEventListener("keydown", onKey));

    restart();
    last = performance.now();
    raf = requestAnimationFrame(tick);

    return function destroy() {
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
    };
  }

  window.startOfflineTetris = startOfflineTetris;
})();
