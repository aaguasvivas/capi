import Svg, { Circle, G, Line, Rect } from "react-native-svg";

const SEAT_DARK = "#1f2937";
const SEAT_LIGHT = "#9ca3af";

/**
 * Bird's-eye table glyph for the mode cards: a felt table with a blank
 * tilted domino on it and seat dots around it. 1v1 seats face each other;
 * 2v2 shades the two teams differently (N-S dark vs E-W light), which
 * quietly explains "con tu frente" — your partner sits across from you.
 * Port of the web ModeGlyph (apps/web CreateGameForm) to react-native-svg.
 */
export default function ModeGlyph({ mode }: { mode: "1v1" | "2v2" }) {
  return (
    <Svg width={58} height={40} viewBox="0 0 64 44">
      {/* table */}
      <Rect
        x={14}
        y={9}
        width={36}
        height={26}
        rx={6}
        fill="#2e8a4e"
        stroke="#1a5c2e"
        strokeWidth={1.5}
      />
      {/* a domino lying casually on the felt — at this render size a clean
          blank tile with its divider reads as a domino; pips would read as
          eyes. The slight tilt keeps it from looking like a face. */}
      <G rotation={-14} origin="32, 22">
        <Rect
          x={23.5}
          y={18.5}
          width={17}
          height={7.5}
          rx={1.6}
          fill="#FBF8ED"
          stroke="#b8a882"
          strokeWidth={0.9}
        />
        <Line
          x1={32}
          y1={19.3}
          x2={32}
          y2={25.2}
          stroke="#b8a882"
          strokeWidth={0.9}
        />
      </G>
      {/* seats */}
      <Circle cx={32} cy={4.5} r={3.6} fill={SEAT_DARK} />
      <Circle cx={32} cy={39.5} r={3.6} fill={SEAT_DARK} />
      {mode === "2v2" && (
        <>
          <Circle cx={7.5} cy={22} r={3.6} fill={SEAT_LIGHT} />
          <Circle cx={56.5} cy={22} r={3.6} fill={SEAT_LIGHT} />
        </>
      )}
    </Svg>
  );
}
