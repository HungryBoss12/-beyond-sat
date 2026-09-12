import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, RotateCw, X } from "lucide-react";

const COLS = 10;
const ROWS = 18;
const CELL = 18;

type Cell = string | null;
type Board = Cell[][];
type PieceId = "I" | "O" | "T" | "S" | "Z" | "J" | "L";

type Piece = {
  id: PieceId;
  rot: number;
  x: number;
  y: number;
};

const COLORS: Record<PieceId, string> = {
  I: "#535291",
  O: "#9f9fc2",
  T: "#0b0761",
  S: "#6b69a8",
  Z: "#3d3a7a",
  J: "#7a78b5",
  L: "#2a2670",
};

const SHAPES: Record<PieceId, number[][][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [2, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

const BAG: PieceId[] = ["I", "O", "T", "S", "Z", "J", "L"];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

function shuffleBag(): PieceId[] {
  const bag = [...BAG];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function cellsOf(piece: Piece) {
  return SHAPES[piece.id][piece.rot].map(([dx, dy]) => ({
    x: piece.x + dx,
    y: piece.y + dy,
  }));
}

function fits(board: Board, piece: Piece) {
  return cellsOf(piece).every(({ x, y }) => {
    if (x < 0 || x >= COLS || y >= ROWS) return false;
    if (y < 0) return true;
    return !board[y][x];
  });
}

function lock(board: Board, piece: Piece): Board {
  const next = board.map((row) => [...row]);
  for (const { x, y } of cellsOf(piece)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = COLORS[piece.id];
  }
  return next;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const kept = board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - kept.length;
  while (kept.length < ROWS) kept.unshift(Array<Cell>(COLS).fill(null));
  return { board: kept, cleared };
}

function spawn(id: PieceId): Piece {
  return { id, rot: 0, x: 3, y: -1 };
}

function dropMs(level: number) {
  return Math.max(120, 800 - level * 70);
}

function scoreFor(cleared: number, level: number) {
  const table = [0, 100, 300, 500, 800];
  return (table[cleared] ?? 0) * (level + 1);
}

type TetrisEggProps = {
  onClose: () => void;
};

export function TetrisEgg({ onClose }: TetrisEggProps) {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [piece, setPiece] = useState<Piece>(() => spawn("T"));
  const [nextId, setNextId] = useState<PieceId>("I");
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [over, setOver] = useState(false);
  const bagRef = useRef<PieceId[]>([]);
  const pieceRef = useRef(piece);
  const boardRef = useRef(board);
  const overRef = useRef(false);
  const linesRef = useRef(0);
  const nextRef = useRef<PieceId>("I");

  pieceRef.current = piece;
  boardRef.current = board;
  overRef.current = over;

  const pullNext = useCallback(() => {
    if (bagRef.current.length === 0) bagRef.current = shuffleBag();
    return bagRef.current.pop()!;
  }, []);

  const startGame = useCallback(() => {
    bagRef.current = shuffleBag();
    const first = pullNext();
    const peek = pullNext();
    const fresh = emptyBoard();
    const spawned = spawn(first);
    setBoard(fresh);
    setPiece(spawned);
    setNextId(peek);
    setScore(0);
    setLines(0);
    setOver(false);
    boardRef.current = fresh;
    pieceRef.current = spawned;
    overRef.current = false;
    linesRef.current = 0;
    nextRef.current = peek;
  }, [pullNext]);

  useEffect(() => {
    startGame();
  }, [startGame]);

  const tryMove = useCallback((dx: number, dy: number, dRot = 0) => {
    if (overRef.current) return false;
    const cur = pieceRef.current;
    const next: Piece = {
      ...cur,
      x: cur.x + dx,
      y: cur.y + dy,
      rot: (cur.rot + dRot + 4) % 4,
    };
    if (!fits(boardRef.current, next)) return false;
    pieceRef.current = next;
    setPiece(next);
    return true;
  }, []);

  const settle = useCallback(
    (locked: Piece) => {
      const merged = lock(boardRef.current, locked);
      const { board: clearedBoard, cleared } = clearLines(merged);
      const nextLines = linesRef.current + cleared;
      const level = Math.floor(linesRef.current / 10);
      setBoard(clearedBoard);
      boardRef.current = clearedBoard;
      if (cleared) {
        linesRef.current = nextLines;
        setScore((s) => s + scoreFor(cleared, level));
        setLines(nextLines);
      }
      const incoming = spawn(nextRef.current);
      const peek = pullNext();
      nextRef.current = peek;
      if (!fits(clearedBoard, incoming)) {
        setOver(true);
        overRef.current = true;
        return;
      }
      pieceRef.current = incoming;
      setPiece(incoming);
      setNextId(peek);
    },
    [pullNext],
  );

  const hardDrop = useCallback(() => {
    if (overRef.current) return;
    let dropped = pieceRef.current;
    while (fits(boardRef.current, { ...dropped, y: dropped.y + 1 })) {
      dropped = { ...dropped, y: dropped.y + 1 };
    }
    pieceRef.current = dropped;
    setPiece(dropped);
    settle(dropped);
  }, [settle]);

  const softDrop = useCallback(() => {
    if (overRef.current) return;
    if (!tryMove(0, 1)) settle(pieceRef.current);
  }, [settle, tryMove]);

  useEffect(() => {
    if (over) return;
    const id = window.setInterval(softDrop, dropMs(Math.floor(lines / 10)));
    return () => window.clearInterval(id);
  }, [lines, over, softDrop]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (overRef.current) {
        if (e.key === "Enter" || e.key === "r" || e.key === "R") {
          e.preventDefault();
          startGame();
        }
        return;
      }
      const map: Record<string, () => void> = {
        ArrowLeft: () => tryMove(-1, 0),
        a: () => tryMove(-1, 0),
        A: () => tryMove(-1, 0),
        ArrowRight: () => tryMove(1, 0),
        d: () => tryMove(1, 0),
        D: () => tryMove(1, 0),
        ArrowDown: () => softDrop(),
        s: () => softDrop(),
        S: () => softDrop(),
        ArrowUp: () => tryMove(0, 0, 1),
        w: () => tryMove(0, 0, 1),
        W: () => tryMove(0, 0, 1),
        " ": () => hardDrop(),
      };
      const act = map[e.key];
      if (!act) return;
      e.preventDefault();
      act();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hardDrop, onClose, softDrop, startGame, tryMove]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const ghost = (() => {
    let g = piece;
    while (fits(board, { ...g, y: g.y + 1 })) g = { ...g, y: g.y + 1 };
    return g;
  })();

  const painted = new Map<string, string>();
  for (const { x, y } of cellsOf(ghost)) {
    if (y >= 0) painted.set(`${x},${y}`, "ghost");
  }
  for (const { x, y } of cellsOf(piece)) {
    if (y >= 0) painted.set(`${x},${y}`, COLORS[piece.id]);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tetris-egg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-3xl border border-brand-400/30 bg-white p-4 shadow-panel sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
              Found it
            </p>
            <h2 id="tetris-egg-title" className="text-lg font-black tracking-tight text-slate-900">
              Beyond Blocks
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Tetris"
            className="tap grid h-9 w-9 place-items-center rounded-xl border border-brand-400/30 text-slate-500 hover:bg-brand-25 hover:text-brand-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-start justify-center gap-4">
          <div
            className="relative overflow-hidden rounded-xl bg-brand-600 ring-1 ring-brand-400/40"
            style={{ width: COLS * CELL, height: ROWS * CELL }}
          >
            {board.map((row, y) =>
              row.map((cell, x) => {
                const overlay = painted.get(`${x},${y}`);
                const fill = overlay && overlay !== "ghost" ? overlay : cell;
                const ghosted = overlay === "ghost" && !cell;
                if (!fill && !ghosted) return null;
                return (
                  <span
                    key={`${x}-${y}`}
                    className="absolute"
                    style={{
                      left: x * CELL,
                      top: y * CELL,
                      width: CELL - 1,
                      height: CELL - 1,
                      background: fill ?? "transparent",
                      boxShadow: ghosted ? "inset 0 0 0 1px rgba(159,159,194,0.55)" : undefined,
                    }}
                  />
                );
              }),
            )}
            {over && (
              <div className="absolute inset-0 grid place-items-center bg-brand-600/85">
                <div className="text-center">
                  <p className="text-sm font-black text-white">Game over</p>
                  <button
                    type="button"
                    onClick={startGame}
                    className="tap mt-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-600"
                  >
                    Play again
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex w-20 flex-col gap-3 text-xs">
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-400">Score</p>
              <p className="text-lg font-black text-slate-900">{score}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-400">Lines</p>
              <p className="text-lg font-black text-slate-900">{lines}</p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-slate-400">Next</p>
              <div className="mt-1 grid h-14 w-14 place-items-center rounded-lg bg-brand-25 ring-1 ring-brand-400/20">
                <MiniPiece id={nextId} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <Control label="Left" onClick={() => tryMove(-1, 0)}>
            <ArrowLeft className="h-4 w-4" />
          </Control>
          <Control label="Rotate" onClick={() => tryMove(0, 0, 1)}>
            <RotateCw className="h-4 w-4" />
          </Control>
          <Control label="Right" onClick={() => tryMove(1, 0)}>
            <ArrowRight className="h-4 w-4" />
          </Control>
          <Control label="Down" onClick={softDrop}>
            <ArrowDown className="h-4 w-4" />
          </Control>
        </div>
        <button
          type="button"
          onClick={hardDrop}
          className="tap mt-2 w-full rounded-xl bg-brand-25 py-2 text-xs font-bold text-brand-600 ring-1 ring-brand-400/30 hover:bg-brand-400 hover:text-white"
        >
          Drop
        </button>
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Arrows or WASD · Space to drop · Esc to close
        </p>
      </div>
    </div>
  );
}

function Control({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="tap grid h-11 place-items-center rounded-xl bg-brand-25 text-brand-600 ring-1 ring-brand-400/30 hover:bg-brand-50"
    >
      {children}
    </button>
  );
}

function MiniPiece({ id }: { id: PieceId }) {
  const cells = SHAPES[id][0];
  const minX = Math.min(...cells.map(([x]) => x));
  const minY = Math.min(...cells.map(([, y]) => y));
  const size = 10;
  return (
    <span className="relative block h-10 w-10">
      {cells.map(([x, y], i) => (
        <span
          key={i}
          className="absolute rounded-[2px]"
          style={{
            left: (x - minX) * size + 6,
            top: (y - minY) * size + 8,
            width: size - 1,
            height: size - 1,
            background: COLORS[id],
          }}
        />
      ))}
    </span>
  );
}
