import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

// Emerald ring on an open end the current hand can play on. Same margin
// trick as the amber ring.
const END_RING: ViewStyle = {
  borderRadius: 8,
  borderWidth: 2,
  borderColor: "#34d399",
  margin: -2,
};

const EMPTY_LAYOUT: ReturnType<typeof layoutBoard> = {
  placements: [],
  contentW: 0,
  contentH: 0,
};

function tileMatchesEnd(tile: Tile, pip: number): boolean {
  return tile[0] === pip || tile[1] === pip;
}

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
  ringStyle?: ViewStyle;
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

// Breathing ring over an open end that the selected hand tile fits. Drawn as
// an overlay outside the tile box, so it never moves the tile off its anchor
// and the outer rotation carries it along.
function PulseRing() {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 500,
          isInteraction: false,
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 500,
          isInteraction: false,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 11,
        borderWidth: 3,
        borderColor: "#34d399",
        shadowColor: "#34d399",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 8,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
        transform: [
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
        ],
      }}
    />
  );
}

interface Props {
  board: Tile[];
  /** Emerald halo on the open ends (index 0 and last) while it's your turn. */
  endsGlow?: boolean;
  /**
   * Narrows endsGlow to the ends the current hand can actually play on.
   * Omitted = both ends glow, as before.
   */
  playableEnds?: { left: boolean; right: boolean };
  /** Tile waiting on the hand's end chooser; the end(s) it fits pulse. */
  selectedTile?: Tile | null;
}

function Board({ board, endsGlow, playableEnds, selectedTile }: Props) {
  const { s } = useI18n();
  // Outer = horizontal axis, inner = vertical axis. RN ScrollView is
  // single-axis, so we nest a vertical ScrollView inside a horizontal one and
  // pan each independently for the two-axis auto-scroll.
  const hScrollRef = useRef<ScrollView>(null);
  const vScrollRef = useRef<ScrollView>(null);

  // Available width AND height of the container. Web reads both from a
  // ResizeObserver; on RN we read them from the outer container's onLayout.
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize((prev) =>
      prev.w === width && prev.h === height ? prev : { w: width, h: height }
    );
  };

  // Compact tiles on narrow screens so more fit per row and the chain stays
  // short; full size on tablet/desktop. Both only change with the board or
  // the container width, so unrelated re-renders reuse the last layout.
  const dims = useMemo(() => dimsForWidth(size.w), [size.w]);
  const layout = useMemo(
    () =>
      board.length > 0 && size.w > 0
        ? layoutBoard(board, size.w, dims)
        : EMPTY_LAYOUT,
    [board, size.w, dims]
  );

  // The inner content view is at least the size of the visible viewport, so
  // short chains sit centered instead of stuck in the top-left corner. Once
  // the chain outgrows the viewport, it grows beyond and the ScrollViews scroll.
  const innerW = Math.max(layout.contentW, size.w);
  const innerH = Math.max(layout.contentH, size.h);
  const xOffset = (innerW - layout.contentW) / 2;
  const yOffset = (innerH - layout.contentH) / 2;

  // The chain grows at either end: a tile played on the left end lands at
  // index 0, on the right end at the last index. Detect which end grew by
  // comparing the first tile against the previously committed board. The
  // memo keys on the board, so unrelated re-renders keep the same answer and
  // the last-move highlight survives them; the effect below records the
  // committed board for the next comparison.
  const prevRef = useRef<{ board: Tile[]; newest: number }>({
    board: [],
    newest: -1,
  });
  const newestIndex = useMemo(() => {
    const prev = prevRef.current;
    if (board.length > prev.board.length) {
      const prevFirst = prev.board[0];
      const leftGrew =
        prevFirst !== undefined &&
        (board[0][0] !== prevFirst[0] || board[0][1] !== prevFirst[1]);
      return leftGrew ? 0 : board.length - 1;
    }
    if (board.length < prev.board.length) return -1; // round reset
    return prev.newest;
  }, [board]);

  useEffect(() => {
    prevRef.current = { board, newest: newestIndex };
  }, [board, newestIndex]);

  // Auto-scroll to keep the latest played tile in view. Only fires when the
  // tile count grows, not on resize, not on round resets.
  const scrolledLenRef = useRef(0);
  useEffect(() => {
    const grew = board.length > scrolledLenRef.current;
    scrolledLenRef.current = board.length;
    if (!grew || layout.placements.length === 0) return;

    // If the whole chain fits in the viewport, no scroll needed.
    if (layout.contentW <= size.w && layout.contentH <= size.h) return;

    const target =
      layout.placements[newestIndex] ??
      layout.placements[layout.placements.length - 1];
    const targetLeft = target.x + xOffset - size.w / 2;
    const targetTop = target.y + yOffset - size.h / 2;
    hScrollRef.current?.scrollTo({ x: Math.max(0, targetLeft), animated: true });
    vScrollRef.current?.scrollTo({ y: Math.max(0, targetTop), animated: true });
  }, [board.length, layout, size.w, size.h, newestIndex, xOffset, yOffset]);

  // Open ends of the serpentine chain are always index 0 and the last index
  // (a 1-tile board is one tile that is both ends). Pip values follow the
  // same convention the screen uses for boardLeftEnd/boardRightEnd.
  const lastIndex = layout.placements.length - 1;
  const leftGlow = !!endsGlow && (playableEnds?.left ?? true);
  const rightGlow = !!endsGlow && (playableEnds?.right ?? true);
  const leftPulse =
    !!selectedTile && board.length > 0 && tileMatchesEnd(selectedTile, board[0][0]);
  const rightPulse =
    !!selectedTile &&
    board.length > 0 &&
    tileMatchesEnd(selectedTile, board[board.length - 1][1]);

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
              const isLeftEnd = i === 0;
              const isRightEnd = i === lastIndex;
              const glow = (isLeftEnd && leftGlow) || (isRightEnd && rightGlow);
              const pulse = (isLeftEnd && leftPulse) || (isRightEnd && rightPulse);
              // Ring priority: the pulse (a tile is waiting to land here)
              // beats the amber newest ring, which beats the static end glow.
              const ringStyle = pulse
                ? undefined
                : isNewest
                  ? NEWEST_RING
                  : glow
                    ? END_RING
                    : undefined;
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
                    <NewestTile ringStyle={ringStyle}>
                      <TileDisplay tile={p.tile} w={dims.TW} h={dims.TH} />
                    </NewestTile>
                  ) : (
                    <View style={ringStyle}>
                      <TileDisplay tile={p.tile} w={dims.TW} h={dims.TH} />
                    </View>
                  )}
                  {pulse ? <PulseRing /> : null}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function sameTile(a: Tile | null | undefined, b: Tile | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a[0] === b[0] && a[1] === b[1];
}

// The screen re-renders on every realtime tick; the board only needs to when
// the chain, the turn, or the hand's selection changes. playableEnds and
// selectedTile are compared by value so inline literals don't defeat the memo.
export default memo(
  Board,
  (prev, next) =>
    prev.board === next.board &&
    !!prev.endsGlow === !!next.endsGlow &&
    (prev.playableEnds?.left ?? true) === (next.playableEnds?.left ?? true) &&
    (prev.playableEnds?.right ?? true) === (next.playableEnds?.right ?? true) &&
    sameTile(prev.selectedTile, next.selectedTile)
);
