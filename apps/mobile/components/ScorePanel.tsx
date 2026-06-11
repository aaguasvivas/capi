import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { THEME } from "../theme";

interface Props {
  scores: [number, number];
  targetScore: number;
  players: Array<{ seat: string; nickname: string; avatar_color: string }>;
  currentTurn: string;
  mySeat: string;
  is2v2?: boolean;
}

/**
 * Score number that pops when its value changes — makes mid-round bonuses
 * (VEINTICINCO +25) visible even if the banner is missed.
 */
function ScoreValue({ score, align }: { score: number; align?: "left" | "right" }) {
  const prevRef = useRef(score);
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (score !== prevRef.current) {
      prevRef.current = score;
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 4,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [score, scale]);

  return (
    <Animated.Text
      style={{
        fontSize: 20,
        fontWeight: "900",
        color: THEME.scoreText,
        textAlign: align === "right" ? "right" : "left",
        transform: [{ scale }],
      }}
    >
      {score}
    </Animated.Text>
  );
}

export default function ScorePanel({
  scores,
  targetScore,
  players,
  currentTurn,
  mySeat,
  is2v2 = false,
}: Props) {
  const { s } = useI18n();

  if (is2v2) {
    // TODO 2v2 — M2 fully styles avatars/turn dots for teams. Minimal version
    // for now: two team scores + target, mirroring the 1v1 layout.
    const team0Seats = ["n", "s"];
    const team1Seats = ["e", "w"];
    const team0Players = team0Seats
      .map((seat) => players.find((p) => p.seat === seat))
      .filter(Boolean) as Array<{ nickname: string; avatar_color: string }>;
    const team1Players = team1Seats
      .map((seat) => players.find((p) => p.seat === seat))
      .filter(Boolean) as Array<{ nickname: string; avatar_color: string }>;
    const myTeam = mySeat === "n" || mySeat === "s" ? 0 : 1;
    const team0Active = team0Seats.includes(currentTurn);
    const team1Active = team1Seats.includes(currentTurn);

    return (
      <View style={panelStyle}>
        <TeamScore
          teamPlayers={team0Players}
          score={scores[0]}
          isActive={team0Active}
          isMyTeam={myTeam === 0}
          youTag={s.youTag}
        />
        <TargetLabel firstTo={s.firstTo} targetScore={targetScore} />
        <TeamScore
          teamPlayers={team1Players}
          score={scores[1]}
          isActive={team1Active}
          isMyTeam={myTeam === 1}
          youTag={s.youTag}
          align="right"
        />
      </View>
    );
  }

  const north = players.find((p) => p.seat === "n");
  const south = players.find((p) => p.seat === "s");

  return (
    <View style={panelStyle}>
      <PlayerScore
        player={north}
        score={scores[0]}
        isActive={currentTurn === "n"}
        isMe={mySeat === "n"}
        youTag={s.youTag}
      />
      <TargetLabel firstTo={s.firstTo} targetScore={targetScore} />
      <PlayerScore
        player={south}
        score={scores[1]}
        isActive={currentTurn === "s"}
        isMe={mySeat === "s"}
        youTag={s.youTag}
        align="right"
      />
    </View>
  );
}

const panelStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "space-between" as const,
  paddingHorizontal: 16,
  paddingVertical: 12,
  backgroundColor: THEME.scoreBg,
};

function TargetLabel({
  firstTo,
  targetScore,
}: {
  firstTo: string;
  targetScore: number;
}) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 2,
          opacity: 0.5,
          color: THEME.scoreText,
        }}
      >
        {firstTo}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: "900", color: THEME.scoreText }}>
        {targetScore}
      </Text>
    </View>
  );
}

function ActiveDot() {
  return (
    <View
      style={{
        position: "absolute",
        top: -2,
        right: -2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#4ade80",
        borderWidth: 2,
        borderColor: THEME.scoreBg,
      }}
    />
  );
}

function Avatar({
  color,
  initial,
  size = 32,
}: {
  color?: string;
  initial: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color ?? "#999",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
        {initial}
      </Text>
    </View>
  );
}

function PlayerScore({
  player,
  score,
  isActive,
  isMe,
  youTag,
  align = "left",
}: {
  player?: { nickname: string; avatar_color: string };
  score: number;
  isActive: boolean;
  isMe: boolean;
  youTag: string;
  align?: "left" | "right";
}) {
  const initial = player?.nickname?.[0]?.toUpperCase() ?? "?";
  return (
    <View
      style={{
        flexDirection: align === "right" ? "row-reverse" : "row",
        alignItems: "center",
        gap: 8,
        opacity: isActive ? 1 : 0.5,
      }}
    >
      <View>
        <Avatar color={player?.avatar_color} initial={initial} />
        {isActive && <ActiveDot />}
      </View>

      <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
        <Text style={{ fontSize: 12, fontWeight: "500", color: THEME.scoreText }}>
          {player?.nickname ?? "…"}
          {isMe ? (
            <Text style={{ opacity: 0.4, fontSize: 10 }}> {youTag}</Text>
          ) : null}
        </Text>
        <ScoreValue score={score} align={align} />
      </View>
    </View>
  );
}

function TeamScore({
  teamPlayers,
  score,
  isActive,
  isMyTeam,
  youTag,
  align = "left",
}: {
  teamPlayers: Array<{ nickname: string; avatar_color: string }>;
  score: number;
  isActive: boolean;
  isMyTeam: boolean;
  youTag: string;
  align?: "left" | "right";
}) {
  return (
    <View
      style={{
        flexDirection: align === "right" ? "row-reverse" : "row",
        alignItems: "center",
        gap: 8,
        opacity: isActive ? 1 : 0.5,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {teamPlayers.map((p, i) => (
          <View key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}>
            <Avatar
              color={p.avatar_color}
              initial={p.nickname?.[0]?.toUpperCase() ?? "?"}
              size={28}
            />
          </View>
        ))}
      </View>

      <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
        <Text style={{ fontSize: 10, fontWeight: "500", color: THEME.scoreText }}>
          {teamPlayers.map((p) => p.nickname).join(" & ")}
          {isMyTeam ? (
            <Text style={{ opacity: 0.4, fontSize: 9 }}> {youTag}</Text>
          ) : null}
        </Text>
        <ScoreValue score={score} align={align} />
      </View>
    </View>
  );
}
