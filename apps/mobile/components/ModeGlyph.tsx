import Svg, { Circle, Ellipse, G, Text as SvgText } from "react-native-svg";

// Team palettes echo the in-game avatar colors; pairs overlap exactly like
// the 2v2 team score bar, so the create card teaches the in-game language.
const TEAM_A = ["#6366f1", "#3b82f6"];
const TEAM_B = ["#e74c3c", "#f39c12"];
const VS = "#9ca3af";

/**
 * Mode-card glyph: player avatars facing off. 1v1 is one bust vs one bust;
 * 2v2 is an overlapped pair vs an overlapped pair (con tu frente). The white
 * ring separates overlapped teammates just like the score bar's avatar stack.
 * Mirror of the web ModeGlyph in apps/web CreateGameForm.
 */
function Person({
  cx,
  cy,
  r,
  color,
}: {
  cx: number;
  cy: number;
  r: number;
  color: string;
}) {
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill={color} stroke="#ffffff" strokeWidth={1.6} />
      <Circle cx={cx} cy={cy - r * 0.22} r={r * 0.32} fill="#ffffff" />
      <Ellipse cx={cx} cy={cy + r * 0.5} rx={r * 0.5} ry={r * 0.3} fill="#ffffff" />
    </G>
  );
}

export default function ModeGlyph({ mode }: { mode: "1v1" | "2v2" }) {
  return (
    <Svg width={58} height={40} viewBox="0 0 64 44">
      {mode === "1v1" ? (
        <>
          <Person cx={17} cy={22} r={9.5} color={TEAM_A[0]} />
          <Person cx={47} cy={22} r={9.5} color={TEAM_B[0]} />
        </>
      ) : (
        <>
          <Person cx={10} cy={22} r={7.2} color={TEAM_A[1]} />
          <Person cx={19.5} cy={22} r={7.2} color={TEAM_A[0]} />
          <Person cx={54} cy={22} r={7.2} color={TEAM_B[1]} />
          <Person cx={44.5} cy={22} r={7.2} color={TEAM_B[0]} />
        </>
      )}
      <SvgText
        x={32}
        y={24.5}
        textAnchor="middle"
        fontSize={mode === "1v1" ? 8.5 : 7}
        fontWeight="bold"
        fontStyle="italic"
        fill={VS}
      >
        vs
      </SvgText>
    </Svg>
  );
}
