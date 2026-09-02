import { memo, useRef } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop, G } from "react-native-svg";
import type { Tile } from "@capi/engine";
import { TileBack, useTileSkin } from "../lib/tileSkins";

interface Props {
  tile: Tile;
  selected?: boolean;
  onPress?: () => void;
  small?: boolean;
  faceDown?: boolean;
  highlight?: boolean;
  // Explicit pixel size (board tiles). Overrides the small/large presets so
  // the board can render a crisp compact tile on narrow screens. Pips scale
  // automatically (SVG viewBox).
  w?: number;
  h?: number;
}

const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[30, 28], [70, 72]],
  3: [[30, 24], [50, 50], [70, 76]],
  4: [[30, 28], [70, 28], [30, 72], [70, 72]],
  5: [[30, 24], [70, 24], [50, 50], [30, 76], [70, 76]],
  6: [[30, 22], [70, 22], [30, 50], [70, 50], [30, 78], [70, 78]],
};

// A unique id per PipHalf instance so multiple tiles' gradient defs don't
// collide in the same SVG namespace.
let pipGradientSeq = 0;

const PipHalf = memo(function PipHalf({
  pips,
  stops,
  ring,
}: {
  pips: number;
  stops: [string, string, string];
  ring: string;
}) {
  const positions = PIP_POSITIONS[pips] ?? [];
  // Stable per-instance id across re-renders.
  const gradId = useRef(`pip-${pipGradientSeq++}`).current;
  return (
    <Svg viewBox="0 0 100 100" width="100%" height="100%">
      <Defs>
        {/* Drilled-pip look: a dished well that's darkest just off-center
            (where a real drilled hole shadows) with a faint lit rim, so pips
            read as carved into the tile rather than printed on it. */}
        <RadialGradient id={gradId} cx="38%" cy="34%" r="75%">
          <Stop offset="0%" stopColor={stops[0]} />
          <Stop offset="45%" stopColor={stops[1]} />
          <Stop offset="100%" stopColor={stops[2]} />
        </RadialGradient>
      </Defs>
      {positions.map(([cx, cy], i) => (
        <G key={i}>
          {/* faint base ring under the well; the skin picks a dark or light
              ring so it shows on both ivory and black faces */}
          <Circle cx={cx} cy={cy} r={10} fill={ring} />
          <Circle cx={cx} cy={cy} r={9.2} fill={`url(#${gradId})`} />
        </G>
      ))}
    </Svg>
  );
});

function TileDisplay({
  tile,
  selected = false,
  onPress,
  small = false,
  faceDown = false,
  highlight = false,
  w,
  h,
}: Props) {
  const { skin } = useTileSkin();
  const isDouble = tile[0] === tile[1];
  const width = w !== undefined && h !== undefined ? w : small ? 36 : 44;
  const height = w !== undefined && h !== undefined ? h : small ? 72 : 88;
  const label = `${tile[0]} ${tile[1]}`;

  if (faceDown) {
    return (
      <View
        style={{
          // Same rounded footprint as the back so the Android elevation
          // outline and the iOS shadow shape match today's single-View back.
          borderRadius: 8,
          backgroundColor: skin.back.bg,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <TileBack skin={skin} width={width} height={height} />
      </View>
    );
  }

  // Border + face colors.
  const faceColor = isDouble ? skin.faceDouble : skin.face;
  const baseBorderWidth = isDouble ? 3 : 2;
  const baseBorderColor = isDouble ? skin.borderDouble : skin.border;

  let borderColor = baseBorderColor;
  const borderWidth = baseBorderWidth;
  let transform: ViewStyle["transform"];
  let shadow: ViewStyle = isDouble
    ? {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
        elevation: 3,
      }
    : {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 2,
      };

  if (selected) {
    borderColor = "#fbbf24"; // amber-400
    transform = [{ scale: 1.08 }, { translateY: -8 }];
    shadow = {
      shadowColor: "#f59e0b",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 8,
    };
  } else if (highlight) {
    borderColor = "#34d399"; // emerald-400
    transform = [{ translateY: -2 }];
    shadow = {
      shadowColor: "#34d399",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    };
  }

  // Divider and spinner dot scale with the tile so the compact board tile
  // (28 wide) and the hand tile (36) keep the same proportions as the 44.
  const dividerHeight = Math.max(1.5, width * 0.05);
  const dividerColor = isDouble ? skin.dividerDouble : skin.divider;
  const dot = Math.round(width * 0.18);

  const tileBody = (
    <View
      accessible={!onPress}
      accessibilityLabel={onPress ? undefined : label}
      style={{
        width,
        height,
        borderRadius: 8,
        backgroundColor: faceColor,
        borderWidth,
        borderColor,
        alignItems: "center",
        justifyContent: "center",
        ...(transform ? { transform } : {}),
        ...shadow,
      }}
    >
      <View style={{ flex: 1, width: "100%" }}>
        <PipHalf pips={tile[0]} stops={skin.pipTop} ring={skin.pipRing} />
      </View>

      <View
        style={{
          width: "70%",
          height: dividerHeight,
          backgroundColor: dividerColor,
        }}
      >
        {skin.spinner ? (
          <View
            style={{
              position: "absolute",
              top: (dividerHeight - dot) / 2,
              left: "50%",
              marginLeft: -dot / 2,
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: skin.spinner,
            }}
          />
        ) : null}
      </View>

      <View style={{ flex: 1, width: "100%" }}>
        <PipHalf pips={tile[1]} stops={skin.pipBottom} ring={skin.pipRing} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        {tileBody}
      </Pressable>
    );
  }

  return tileBody;
}

// Tiles arrive as fresh arrays on every game-state update, so compare pips,
// not references; everything else is a primitive or a stable handler.
export default memo(
  TileDisplay,
  (a, b) =>
    a.tile[0] === b.tile[0] &&
    a.tile[1] === b.tile[1] &&
    a.selected === b.selected &&
    a.onPress === b.onPress &&
    a.small === b.small &&
    a.faceDown === b.faceDown &&
    a.highlight === b.highlight &&
    a.w === b.w &&
    a.h === b.h
);
