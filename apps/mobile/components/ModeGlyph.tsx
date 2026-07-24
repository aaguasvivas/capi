import Svg, { Circle, G, Line, Rect } from "react-native-svg";

const SEAT_DARK = "#1f2937";
const SEAT_LIGHT = "#9ca3af";
const TILE_FACE = "#FBF8ED";
const INK = "#0a0a0a";

/**
 * Mode-card glyph: one big, properly drawn domino (the table IS the game)
 * with seat dots around it. 1v1 seats face each other across the tile; 2v2
 * shades the two teams differently (N-S dark vs E-W light), which quietly
 * explains "con tu frente" — your partner sits across from you.
 * The tile is drawn straight and large so the pips stay crisp at card size
 * (the old tiny tilted blank tile read as a smudge, not a domino).
 * Mirror of the web ModeGlyph in apps/web CreateGameForm.
 */
function ThreePips({ cx }: { cx: number }) {
  return (
    <>
      <Circle cx={cx - 5} cy={17} r={1.9} fill={INK} />
      <Circle cx={cx} cy={22} r={1.9} fill={INK} />
      <Circle cx={cx + 5} cy={27} r={1.9} fill={INK} />
    </>
  );
}

export default function ModeGlyph({ mode }: { mode: "1v1" | "2v2" }) {
  return (
    <Svg width={58} height={40} viewBox="0 0 64 44">
      {/* the domino */}
      <G>
        <Rect
          x={12}
          y={12.5}
          width={40}
          height={19}
          rx={3.5}
          fill={TILE_FACE}
          stroke={INK}
          strokeWidth={1.6}
        />
        <Line x1={32} y1={14.5} x2={32} y2={29.5} stroke={INK} strokeWidth={1.4} />
        <ThreePips cx={22} />
        <ThreePips cx={42} />
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
