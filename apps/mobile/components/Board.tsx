import { useRef, useState, useEffect, type ReactNode } from "react";
import {
  Animated,
  ScrollView,
  View,
  Text,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import { layoutBoard, dimsForWidth, type Tile } from "@capi/engine";
import TileDisplay from "./TileDisplay";
import { useI18n } from "../lib/i18n";

// Amber last-move ring. The border grows the wrapper by 2px per side; the
// negative margin pulls it back so the tile stays centered on the engine
// anchor.
const NEWEST_RING: ViewStyle = {
  borderRadius: 8,
  borderWidth: 2,
  borderColor: "#fbbf24",
  margin: -2,
};

// Newest tile's inner wrapper: springs from oversized + faded down onto the
// board on mount. The per-play re-key remounts it on every play, which
// retriggers the animation naturally. It lives INSIDE the positioned+rotated
// outer View, so the animated scale never interferes with the
// position/rotation transform. Non-newest tiles keep plain Views.
function NewestTile({
  children,
  ringStyle,
}: {
  children: ReactNode;
  ringStyle: ViewStyle;
}) {
  const scale = useRef(new Animated.Value(1.25)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, opacity]);

  return (
    <Animated.View style={[ringStyle, { transform: [{ scale }], opacity }]}>
      {children}
    </Animated.View>
  );
}

interface Props {
  board: Tile[];
  /** Emerald halo on the open ends (index 0 and last) while it's your turn. */
  endsGlow?: boolean;
}

export default function Board({ board, endsGlow }: Props) {
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
  // tile count grows, not on resize, not on round resets.
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
              // Open ends of the serpentine chain are always index 0 and the
              // last index (a 1-tile board is one tile that is both ends).
              // Amber newest-ring wins when a tile is both newest and an end.
              const isEnd =
                !!endsGlow && (i === 0 || i === layout.placements.length - 1);
              // Center the tile's UNROTATED TW×TH box on the engine's anchor
              // (p.x, p.y) via left/top, then rotate. RN rotates a view about
              // its own center, so the visual center stays exactly on the
              // anchor for every rotation. (Do NOT translate by the rotated
              // half-extents here: RN's translateX/Y move the unrotated box,
              // which shifted every horizontal tile by (TW-TH)/2 and caused
              // on-screen overlaps even though the engine coordinates were
              // clean.)
              return (
                <View
                  // Re-key the newest tile per play so any future entrance
                  // animation re-triggers even when the same index grows twice.
                  key={isNewest ? `n-${i}-${board.length}` : `t-${i}`}
                  style={{
                    position: "absolute",
                    left: p.x + xOffset - dims.TW / 2,
                    top: p.y + yOffset - dims.TH / 2,
                    transform: [{ rotate: `${p.rot}deg` }],
                  }}
                >
                  {isNewest ? (
                    <NewestTile ringStyle={NEWEST_RING}>
                      <TileDisplay tile={p.tile} w={dims.TW} h={dims.TH} />
                    </NewestTile>
                  ) : (
                    <View
                      style={
                        isEnd
                          ? {
                              borderRadius: 8,
                              borderWidth: 2,
                              borderColor: "#34d399",
                              // Same margin trick as the amber ring so the
                              // tile stays centered on the engine anchor.
                              margin: -2,
                            }
                          : undefined
                      }
                    >
                      <TileDisplay tile={p.tile} w={dims.TW} h={dims.TH} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}
