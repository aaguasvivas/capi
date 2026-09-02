import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";
import type { Tile } from "@capi/engine";
import TileDisplay from "./TileDisplay";
import { useI18n } from "../lib/i18n";
import { THEME } from "../theme";

interface Props {
  tiles: Tile[];
  isMyTurn: boolean;
  boardLeftEnd: number;
  boardRightEnd: number;
  boneyardCount: number;
  onPlay: (tile: Tile, end: "left" | "right") => void;
  onPass: () => void;
  onDraw: () => void;
  /** Fires with the tile waiting on the end chooser, or null once it clears. */
  onSelectionChange?: (tile: Tile | null) => void;
}

// The row above the strip keeps this height in every state (end chooser,
// draw, pass, waiting, or empty) so the tiles never move under a thumb.
const ACTION_ROW_HEIGHT = 40;

function tileMatchesEnd(tile: Tile, pip: number): boolean {
  return tile[0] === pip || tile[1] === pip;
}

function sameTile(a: Tile, b: Tile): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function tileKey(tile: Tile): string {
  return `${tile[0]}-${tile[1]}`;
}

export type EndChoice =
  | { kind: "play"; end: "left" | "right" }
  | { kind: "choose" }
  | { kind: "none" };

/**
 * What a tap on a hand tile does. Only a tile that fits both ends with
 * different pips needs the player to choose; everything else resolves on the
 * spot: one fit plays there, both ends equal plays right, no fit does nothing.
 */
export function resolveEndChoice(
  tile: Tile,
  leftEnd: number,
  rightEnd: number
): EndChoice {
  // Empty board (round 2+ first move): there are no ends yet.
  if (leftEnd === -1) return { kind: "play", end: "left" };
  const left = tileMatchesEnd(tile, leftEnd);
  const right = tileMatchesEnd(tile, rightEnd);
  if (left && right) {
    return leftEnd === rightEnd
      ? { kind: "play", end: "right" }
      : { kind: "choose" };
  }
  if (left) return { kind: "play", end: "left" };
  if (right) return { kind: "play", end: "right" };
  return { kind: "none" };
}

export default function Hand({
  tiles,
  isMyTurn,
  boardLeftEnd,
  boardRightEnd,
  boneyardCount,
  onPlay,
  onPass,
  onDraw,
  onSelectionChange,
}: Props) {
  const { s } = useI18n();
  const [selected, setSelected] = useState<Tile | null>(null);
  // Tile to flash after a tap that fits nowhere. The counter makes a repeat
  // tap on the same tile flash again.
  const [pulse, setPulse] = useState<{ key: string; n: number } | null>(null);

  // Clear any stale tile selection when it's no longer my turn or a new
  // round starts with an empty board.
  useEffect(() => {
    if (!isMyTurn || boardLeftEnd === -1) {
      setSelected(null);
    }
  }, [isMyTurn, boardLeftEnd]);

  useEffect(() => {
    onSelectionChange?.(selected);
  }, [selected, onSelectionChange]);

  const hasLegalPlay =
    boardLeftEnd === -1
      ? tiles.length > 0
      : tiles.some(
          (t) =>
            tileMatchesEnd(t, boardLeftEnd) ||
            tileMatchesEnd(t, boardRightEnd)
        );

  // Stable across pulse/selection changes (functional updates only), so the
  // memoized tiles keep their handler between taps.
  const handleTileTap = useCallback(
    (tile: Tile) => {
      const choice = resolveEndChoice(tile, boardLeftEnd, boardRightEnd);
      if (choice.kind === "play") {
        onPlay(tile, choice.end);
        setSelected(null);
        return;
      }
      if (choice.kind === "choose") {
        setSelected((prev) => (prev && sameTile(prev, tile) ? null : tile));
        return;
      }
      setPulse((prev) => ({ key: tileKey(tile), n: (prev?.n ?? 0) + 1 }));
    },
    [boardLeftEnd, boardRightEnd, onPlay]
  );

  function handleEndPress(end: "left" | "right") {
    if (!selected) return;
    onPlay(selected, end);
    setSelected(null);
  }

  const showChooser = isMyTurn && selected !== null;
  const showDraw = isMyTurn && !selected && !hasLegalPlay && boneyardCount > 0;
  const showPass = isMyTurn && !selected && !hasLegalPlay && boneyardCount === 0;

  return (
    <View style={{ gap: 12 }}>
      <View
        style={{
          height: ACTION_ROW_HEIGHT,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        {showChooser ? (
          <>
            <EndButton
              label={s.playOnEnd(boardLeftEnd)}
              onPress={() => handleEndPress("left")}
            />
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              accessibilityLabel={s.closeTray}
              hitSlop={8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 9,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#d1d5db",
              }}
            >
              <Text style={{ fontSize: 14, color: "#6b7280" }}>✕</Text>
            </Pressable>
            <EndButton
              label={s.playOnEnd(boardRightEnd)}
              onPress={() => handleEndPress("right")}
            />
          </>
        ) : showDraw ? (
          <Pressable
            onPress={onDraw}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 24,
              paddingVertical: 9,
              borderRadius: 12,
              backgroundColor: "#f59e0b",
            }}
          >
            <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>
              {s.draw(boneyardCount)}
            </Text>
          </Pressable>
        ) : showPass ? (
          <Pressable
            onPress={onPass}
            accessibilityRole="button"
            style={{
              paddingHorizontal: 24,
              paddingVertical: 8,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: THEME.accent,
            }}
          >
            <Text style={{ fontSize: 14, color: THEME.accent, fontWeight: "700" }}>
              {s.pass}
            </Text>
          </Pressable>
        ) : !isMyTurn ? (
          <Text style={{ textAlign: "center", fontSize: 14, color: "#6b7280" }}>
            {s.waitingTurn}
          </Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: "row",
          gap: 6,
          paddingHorizontal: 8,
          // Headroom for raised tiles: selected lifts -8 (+ scale overflow),
          // playable lifts -2; without this the tile tops clip at the
          // ScrollView edge.
          paddingTop: 12,
          paddingBottom: 2,
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        {tiles.map((tile) => {
          const key = tileKey(tile);
          const isPlayable =
            isMyTurn &&
            !selected &&
            (boardLeftEnd === -1 ||
              tileMatchesEnd(tile, boardLeftEnd) ||
              tileMatchesEnd(tile, boardRightEnd));
          const isSelected = !!selected && sameTile(selected, tile);

          return (
            <HandTile
              key={key}
              tile={tile}
              selected={isSelected}
              highlight={isPlayable}
              pulseNonce={pulse?.key === key ? pulse.n : 0}
              onTap={isMyTurn ? handleTileTap : undefined}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

function HandTile({
  tile,
  selected,
  highlight,
  pulseNonce,
  onTap,
}: {
  tile: Tile;
  selected: boolean;
  highlight: boolean;
  pulseNonce: number;
  onTap?: (tile: Tile) => void;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  // Short dip and back: the tap landed, the tile just fits nowhere.
  useEffect(() => {
    if (pulseNonce === 0) return;
    opacity.setValue(1);
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0.35,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [pulseNonce, opacity]);

  const onPress = useMemo(
    () => (onTap ? () => onTap(tile) : undefined),
    [onTap, tile]
  );

  return (
    <Animated.View style={{ opacity }}>
      <TileDisplay
        tile={tile}
        selected={selected}
        highlight={highlight}
        small
        onPress={onPress}
      />
    </Animated.View>
  );
}

function EndButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexShrink: 1,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: THEME.accent,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ fontSize: 14, color: "#fff", fontWeight: "600" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
