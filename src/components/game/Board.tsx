"use client";

import { useRef, useState, useEffect } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";

interface Props {
  board: Tile[];
}

const TW = 36; // tile narrow side
const TH = 72; // tile long side
const PAD = 20;
const ROW_H = 86; // vertical space per row (enough for doubles sticking out + gap)

interface Placed {
  tile: Tile;
  x: number;
  y: number;
  rot: number;
}

function layout(board: Tile[], cw: number, ch: number): Placed[] {
  if (!board.length || cw < TW * 3) return [];

  const usable = cw - PAD * 2;
  const adv = board.map((t) => (t[0] === t[1] ? TW : TH));
  const total = adv.reduce((s, a) => s + a, 0);

  // Single row: center horizontally and vertically
  if (total <= usable) {
    let x = (cw - total) / 2;
    const y = ch / 2;
    return board.map((tile, i) => {
      const a = adv[i];
      const p: Placed = {
        tile,
        x: x + a / 2,
        y,
        rot: tile[0] === tile[1] ? 0 : -90,
      };
      x += a;
      return p;
    });
  }

  // Multi-row: snake. First row goes right, then reverses each row.
  const rows: { s: number; e: number }[] = [];
  let rs = 0;
  let rw = 0;

  for (let i = 0; i < board.length; i++) {
    if (rw + adv[i] > usable && i > rs) {
      rows.push({ s: rs, e: i - 1 });
      rs = i;
      rw = adv[i];
    } else {
      rw += adv[i];
    }
  }
  rows.push({ s: rs, e: board.length - 1 });

  const totalH = rows.length * ROW_H;
  const baseY = Math.max(ROW_H / 2, (ch - totalH) / 2 + ROW_H / 2);

  const out: Placed[] = [];

  rows.forEach((row, r) => {
    const goRight = r % 2 === 0;
    const y = baseY + r * ROW_H;

    if (goRight) {
      let x = PAD;
      for (let i = row.s; i <= row.e; i++) {
        const a = adv[i];
        out.push({
          tile: board[i],
          x: x + a / 2,
          y,
          rot: board[i][0] === board[i][1] ? 0 : -90,
        });
        x += a;
      }
    } else {
      let x = cw - PAD;
      for (let i = row.s; i <= row.e; i++) {
        const a = adv[i];
        x -= a;
        out.push({
          tile: board[i],
          x: x + a / 2,
          y,
          rot: board[i][0] === board[i][1] ? 0 : -90,
        });
      }
    }
  });

  return out;
}

export default function Board({ board }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tiles =
    board.length > 0 && size.w > 0 ? layout(board, size.w, size.h) : [];

  return (
    <div ref={ref} className="flex-1 min-h-0 w-full relative overflow-hidden z-0">
      {board.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/30 text-sm italic select-none">
          Mesa vacía
        </div>
      )}
      {tiles.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) rotate(${p.rot}deg)`,
          }}
        >
          <TileDisplay tile={p.tile} small />
        </div>
      ))}
    </div>
  );
}
