import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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
}

function tileMatchesEnd(tile: Tile, pip: number): boolean {
  return tile[0] === pip || tile[1] === pip;
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
}: Props) {
  const { s } = useI18n();
  const [selected, setSelected] = useState<Tile | null>(null);

  // Clear any stale tile selection when it's no longer my turn or a new
  // round starts with an empty board.
  useEffect(() => {
    if (!isMyTurn || boardLeftEnd === -1) {
      setSelected(null);
    }
  }, [isMyTurn, boardLeftEnd]);

  const hasLegalPlay =
    boardLeftEnd === -1
      ? tiles.length > 0
      : tiles.some(
          (t) =>
            tileMatchesEnd(t, boardLeftEnd) ||
            tileMatchesEnd(t, boardRightEnd)
        );

  function handleTileClick(tile: Tile) {
    if (!isMyTurn) return;
    // Empty board (e.g., round 2+ first move): play immediately, no
    // left/right end choice is meaningful when there are no ends yet.
    if (boardLeftEnd === -1) {
      onPlay(tile, "left");
      setSelected(null);
      return;
    }
    setSelected((prev) =>
      prev && prev[0] === tile[0] && prev[1] === tile[1] ? null : tile
    );
  }

  function handleEndClick(end: "left" | "right") {
    if (!selected) return;
    onPlay(selected, end);
    setSelected(null);
  }

  const matchesLeft = selected
    ? tileMatchesEnd(selected, boardLeftEnd)
    : false;
  const matchesRight = selected
    ? tileMatchesEnd(selected, boardRightEnd)
    : false;

  return (
    <View style={{ gap: 12 }}>
      {isMyTurn && selected && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <EndButton
            label={s.leftEnd}
            disabled={!matchesLeft}
            onPress={() => handleEndClick("left")}
          />
          <Pressable
            onPress={() => setSelected(null)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "#d1d5db",
            }}
          >
            <Text style={{ fontSize: 14, color: "#6b7280" }}>✕</Text>
          </Pressable>
          <EndButton
            label={s.rightEnd}
            disabled={!matchesRight}
            onPress={() => handleEndClick("right")}
          />
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          flexDirection: "row",
          gap: 6,
          paddingHorizontal: 8,
          justifyContent: "center",
          flexGrow: 1,
        }}
      >
        {tiles.map((tile) => {
          const isPlayable =
            isMyTurn &&
            !selected &&
            (boardLeftEnd === -1 ||
              tileMatchesEnd(tile, boardLeftEnd) ||
              tileMatchesEnd(tile, boardRightEnd));

          const isSelected =
            !!selected &&
            selected[0] === tile[0] &&
            selected[1] === tile[1];

          return (
            <TileDisplay
              key={`${tile[0]}-${tile[1]}`}
              tile={tile}
              selected={isSelected}
              highlight={isPlayable}
              small
              onPress={isMyTurn ? () => handleTileClick(tile) : undefined}
            />
          );
        })}
      </ScrollView>

      {isMyTurn && !selected && !hasLegalPlay && boneyardCount > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "center", paddingTop: 4 }}>
          <Pressable
            onPress={onDraw}
            style={({ pressed }) => ({
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: "#f59e0b",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontSize: 14, color: "#fff", fontWeight: "700" }}>
              {s.draw(boneyardCount)}
            </Text>
          </Pressable>
        </View>
      )}

      {isMyTurn && !selected && !hasLegalPlay && boneyardCount === 0 && (
        <View style={{ flexDirection: "row", justifyContent: "center", paddingTop: 4 }}>
          <Pressable
            onPress={onPass}
            style={({ pressed }) => ({
              paddingHorizontal: 24,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: THEME.accent,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 14, color: THEME.accent, fontWeight: "700" }}>
              {s.pass}
            </Text>
          </Pressable>
        </View>
      )}

      {!isMyTurn && (
        <Text
          style={{
            textAlign: "center",
            fontSize: 14,
            color: "#6b7280",
            paddingTop: 4,
          }}
        >
          {s.waitingTurn}
        </Text>
      )}
    </View>
  );
}

function EndButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: THEME.accent,
        opacity: disabled ? 0.3 : pressed ? 0.85 : 1,
      })}
    >
      <Text style={{ fontSize: 14, color: "#fff", fontWeight: "600" }}>
        {label}
      </Text>
    </Pressable>
  );
}
