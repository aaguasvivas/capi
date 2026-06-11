import { useRef, useState, useEffect } from "react";
import { ScrollView, View, Text, type LayoutChangeEvent } from "react-native";
import {
  layoutBoard,
  dimsForWidth,
  tileHalfExtents,
  type Tile,
} from "@capi/engine";
import TileDisplay from "./TileDisplay";
import { useI18n } from "../lib/i18n";

interface Props {
  board: Tile[];
}

export default function Board({ board }: Props) {
  const { s } = useI18n();
  // Outer = horizontal axis, inner = vertical axis. RN ScrollView is
  // single-axis, so we nest a vertical ScrollView inside a horizontal one and
  // pan each independently for the two-axis auto-scroll.
  const hScrollRef = useRef<ScrollView>(null);
  const vScrollRef = useRef<ScrollView>(null);

  // Available width AND height of the container. Web reads both from a
  // ResizeObserver; on RN we read them from the outer container's onLayout.
  const [size, setSize] = useState({ w: 0, h: 0 });

  const lastBoardLenRef = useRef(0);
  const prevFirstTileRef = useRef<Tile | null>(null);
  const newestIndexRef = useRef(-1);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height }
    );
  };

  // Compact tiles on narrow screens so more fit per row and the chain stays
  // short; full size on tablet/desktop.
  const dims = dimsForWidth(size.w);
  const layout =
    board.length > 0 && size.w > 0
      ? layoutBoard(board, size.w, dims)
      : { placements: [], contentW: 0, contentH: 0 };

  // The inner content view is at least the size of the visible viewport, so
  // short chains sit centered instead of stuck in the top-left corner. Once
  // the chain outgrows the viewport, it grows beyond and the ScrollViews scroll.
  const innerW = Math.max(layout.contentW, size.w);
  const innerH = Math.max(layout.contentH, size.h);
  const xOffset = (innerW - layout.contentW) / 2;
  const yOffset = (innerH - layout.contentH) / 2;

  // The chain grows at either end: a tile played on the left end lands at
  // index 0, on the right end at the last index. Detect which end grew by
  // comparing the first tile against the previous render, and remember it so
  // the last-move highlight survives unrelated re-renders.
  const prevLen = lastBoardLenRef.current;
  const grew = board.length > prevLen;
  if (grew) {
    const prevFirst = prevFirstTileRef.current;
    newestIndexRef.current =
      prevLen > 0 &&
      prevFirst &&
      (board[0][0] !== prevFirst[0] || board[0][1] !== prevFirst[1])
        ? 0
        : board.length - 1;
  } else if (board.length < prevLen) {
    newestIndexRef.current = -1; // round reset
  }
  const newestIndex = newestIndexRef.current;

  useEffect(() => {
    lastBoardLenRef.current = board.length;
    prevFirstTileRef.current = board.length > 0 ? board[0] : null;
  }, [board]);

  // Auto-scroll to keep the latest played tile in view. Only fires when the
  // tile count grows — not on resize, not on round resets.
  useEffect(() => {
    if (layout.placements.length === 0 || !grew) return;

    // If the whole chain fits in the viewport, no scroll needed.
    if (layout.contentW <= size.w && layout.contentH <= size.h) return;

    const target =
      layout.placements[newestIndex] ??
      layout.placements[layout.placements.length - 1];
    const targetLeft = target.x + xOffset - size.w / 2;
    const targetTop = target.y + yOffset - size.h / 2;
    hScrollRef.current?.scrollTo({ x: Math.max(0, targetLeft), animated: true });
    vScrollRef.current?.scrollTo({ y: Math.max(0, targetTop), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.length, layout.contentW, layout.contentH, size.w, size.h]);

  return (
    <View style={{ flex: 1, width: "100%" }} onLayout={onLayout}>
      {board.length === 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <Text
            style={{
              color: "rgba(255,255,255,0.3)",
              fontSize: 14,
              fontStyle: "italic",
            }}
          >
            {s.emptyTable}
          </Text>
        </View>
      )}
      <ScrollView
        ref={hScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={vScrollRef}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: innerW, height: innerH }}>
            {layout.placements.map((p, i) => {
              const isNewest = i === newestIndex;
              // Web uses translate(-50%,-50%) (percent of the element's own
              // box). RN transforms don't take percentages, so compute the
              // tile's half-extents in PIXELS from its dims+rotation. We reuse
              // the engine's tileHalfExtents so this can never drift from the
              // layout math: vertical (rot 0) → halfW=TW/2, halfH=TH/2;
              // horizontal (rot ±90) → halfW=TH/2, halfH=TW/2.
              const { halfW, halfH } = tileHalfExtents(p, dims);
              return (
                <View
                  // Re-key the newest tile per play so any future entrance
                  // animation re-triggers even when the same index grows twice.
                  key={isNewest ? `n-${i}-${board.length}` : `t-${i}`}
                  style={{
                    position: "absolute",
                    left: p.x + xOffset,
                    top: p.y + yOffset,
                    // translate first (center the tile on its anchor point),
                    // then rotate about that center.
                    transform: [
                      { translateX: -halfW },
                      { translateY: -halfH },
                      { rotate: `${p.rot}deg` },
                    ],
                  }}
                >
                  <View
                    style={
                      isNewest
                        ? {
                            borderRadius: 8,
                            borderWidth: 2,
                            borderColor: "#fbbf24",
                          }
                        : undefined
                    }
                  >
                    <TileDisplay tile={p.tile} w={dims.TW} h={dims.TH} />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
