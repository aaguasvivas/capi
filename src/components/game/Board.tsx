"use client";

import { useRef, useState, useEffect } from "react";
import type { Tile } from "@/lib/engine/types";
import TileDisplay from "./TileDisplay";
import { useI18n } from "@/lib/i18n/context";

interface Props {
  board: Tile[];
}

const TW = 36;
const TH = 72;

interface Placed {
  tile: Tile;
  x: number;
  y: number;
  rot: number;
  scale: number;
}

interface RowDef {
  tileIndices: number[];
  turnIdx: number | null;
  dir: 1 | -1;
}

function buildRows(board: Tile[], rowW: number): RowDef[] {
  const GAP = 2;
  const isDbl = (t: Tile) => t[0] === t[1];
  const rows: RowDef[] = [];
  let i = 0;
  let dir: 1 | -1 = 1;

  while (i < board.length) {
    const row: RowDef = { tileIndices: [], turnIdx: null, dir };
    let w = 0;

    while (i < board.length) {
      const adv = isDbl(board[i]) ? TW : TH;
      const need = row.tileIndices.length > 0 ? adv + GAP : adv;
      if (w + need > rowW && row.tileIndices.length > 0) break;
      w += need;
      row.tileIndices.push(i);
      i++;
    }

    if (i < board.length) {
      row.turnIdx = i;
      i++;
      dir = (dir === 1 ? -1 : 1) as 1 | -1;
    }

    rows.push(row);
  }

  return rows;
}

function layout(board: Tile[], cw: number, ch: number): Placed[] {
  if (!board.length || cw < 80) return [];

  const GAP = 2;
  const EDGE = 10;
  const TURN_COL = TW + 4;
  const isDbl = (t: Tile) => t[0] === t[1];

  const totalAdv = board.reduce(
    (s, t) => s + (isDbl(t) ? TW : TH) + GAP,
    -GAP
  );

  if (totalAdv <= cw - EDGE * 2) {
    let x = (cw - totalAdv) / 2;
    const y = ch / 2;
    return board.map((tile) => {
      const a = isDbl(tile) ? TW : TH;
      const p: Placed = {
        tile,
        x: x + a / 2,
        y,
        rot: isDbl(tile) ? 0 : -90,
        scale: 1,
      };
      x += a + GAP;
      return p;
    });
  }

  const rowW = cw - EDGE * 2 - TURN_COL * 2;
  if (rowW < TH) return [];

  const rows = buildRows(board, rowW);

  const ROW_STEP = TH + 12;

  const out: Placed[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowY = r * ROW_STEP;

    if (row.dir === 1) {
      let x = EDGE + TURN_COL;
      for (const idx of row.tileIndices) {
        const adv = isDbl(board[idx]) ? TW : TH;
        out.push({
          tile: board[idx],
          x: x + adv / 2,
          y: rowY,
          rot: isDbl(board[idx]) ? 0 : -90,
          scale: 1,
        });
        x += adv + GAP;
      }
      if (row.turnIdx !== null) {
        out.push({
          tile: board[row.turnIdx],
          x: cw - EDGE - TW / 2,
          y: rowY + ROW_STEP / 2,
          rot: 0,
          scale: 1,
        });
      }
    } else {
      let x = cw - EDGE - TURN_COL;
      for (const idx of row.tileIndices) {
        const adv = isDbl(board[idx]) ? TW : TH;
        out.push({
          tile: board[idx],
          x: x - adv / 2,
          y: rowY,
          rot: isDbl(board[idx]) ? 0 : 90,
          scale: 1,
        });
        x -= adv + GAP;
      }
      if (row.turnIdx !== null) {
        out.push({
          tile: board[row.turnIdx],
          x: EDGE + TW / 2,
          y: rowY + ROW_STEP / 2,
          rot: 0,
          scale: 1,
        });
      }
    }
  }

  if (!out.length) return [];

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of out) {
    const halfW = p.rot === 0 ? TW / 2 : TH / 2;
    const halfH = p.rot === 0 ? TH / 2 : TW / 2;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
  }

  const bboxW = maxX - minX;
  const bboxH = maxY - minY;

  const padH = 12;
  const padV = 12;
  const availW = cw - padH * 2;
  const availH = ch - padV * 2;

  let scale = 1;
  if (availW > 0 && availH > 0) {
    const sx = availW / bboxW;
    const sy = availH / bboxH;
    scale = Math.min(1, sx, sy);
  }

  const bboxCx = (minX + maxX) / 2;
  const bboxCy = (minY + maxY) / 2;

  for (const p of out) {
    p.x = cw / 2 + (p.x - bboxCx) * scale;
    p.y = ch / 2 + (p.y - bboxCy) * scale;
    p.scale = scale;
  }

  return out;
}

export default function Board({ board }: Props) {
  const { s } = useI18n();
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
          {s.emptyTable}
        </div>
      )}
      {tiles.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) rotate(${p.rot}deg) scale(${p.scale})`,
          }}
        >
          <TileDisplay tile={p.tile} small />
        </div>
      ))}
    </div>
  );
}
