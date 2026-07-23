import { useRef } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop, G } from "react-native-svg";
import type { Tile } from "@capi/engine";
import { THEME } from "../theme";

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

function PipHalf({ pips }: { pips: number }) {
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
          <Stop offset="0%" stopColor="#3a3a3a" />
          <Stop offset="45%" stopColor="#1c1c1c" />
          <Stop offset="100%" stopColor="#050505" />
        </RadialGradient>
      </Defs>
      {positions.map(([cx, cy], i) => (
        <G key={i}>
          {/* faint dark base ring under the well */}
          <Circle cx={cx} cy={cy} r={10} fill="#000" opacity={0.18} />
          <Circle cx={cx} cy={cy} r={9.2} fill={`url(#${gradId})`} />
        </G>
      ))}
    </Svg>
  );
}

export default function TileDisplay({
  tile,
  selected = false,
  onPress,
  small = false,
  faceDown = false,
  highlight = false,
  w,
  h,
}: Props) {
  const isDouble = tile[0] === tile[1];
  const explicitSize = w !== undefined && h !== undefined;
  const width = explicitSize ? w! : small ? 36 : 44;
  const height = explicitSize ? h! : small ? 72 : 88;

  if (faceDown) {
    return (
      <View
        style={{
          width,
          height,
          borderRadius: 8,
          backgroundColor: "#1e3a5f",
          borderWidth: 2,
          borderColor: "#0f1f35",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <View
          style={{
            width: small ? 20 : 28,
            height: small ? 48 : 64,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: "rgba(42,90,140,0.3)",
            backgroundColor: "rgba(42,90,140,0.2)",
          }}
        />
      </View>
    );
  }

  // Border + face colors.
  const faceColor = isDouble ? THEME.tileFaceDouble : THEME.tileFace;
  const baseBorderWidth = isDouble ? 3 : 2;
  const baseBorderColor = isDouble ? THEME.tileBorderDouble : THEME.tileBorder;

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

  // Divider between the two pip halves.
  const dividerHeight = isDouble ? 2.5 : small ? 1.5 : 2;
  const dividerColor = isDouble ? THEME.tileBorderDouble : "#b8a882";

  const tileBody = (
    <View
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
        <PipHalf pips={tile[0]} />
      </View>

      <View
        style={{
          width: "70%",
          height: dividerHeight,
          backgroundColor: dividerColor,
        }}
      />

      <View style={{ flex: 1, width: "100%" }}>
        <PipHalf pips={tile[1]} />
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {tileBody}
      </Pressable>
    );
  }

  return tileBody;
}
