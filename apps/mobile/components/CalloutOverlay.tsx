import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";

interface CalloutOverlayProps {
  callout: string;
  payload: Record<string, unknown> | null;
  onDismiss: () => void;
}

// The callout words are the game's own vocabulary: players shout exactly
// these at the table whether they speak Spanish or English, so they are
// deliberately not in the i18n dictionaries. Defined once here, used by the
// overlay cards and the mid-round banner.
const CALLOUT_DOMINO = "¡DOMINÓ!";
const CALLOUT_TRANCAO = "¡TRANCAO!";
const CALLOUT_CAPICUA = "¡CAPICÚA!";
const CALLOUT_VEINTICINCO = "¡VEINTICINCO!";

const CALLOUT_CONFIG: Record<
  string,
  {
    label: string;
    emoji: string;
    cardBg: string;
    borderColor: string;
    textColor: string;
    subTextColor: string;
  }
> = {
  domino: {
    label: CALLOUT_DOMINO,
    emoji: "🎯",
    cardBg: "#facc15", // yellow-400
    borderColor: "#fcd34d", // amber-300
    textColor: "#451a03", // amber-950
    subTextColor: "rgba(120,53,15,0.85)", // amber-900/80
  },
  trancao: {
    label: CALLOUT_TRANCAO,
    emoji: "🔒",
    cardBg: "#dc2626", // red-600
    borderColor: "#f87171", // red-400
    textColor: "#ffffff",
    subTextColor: "rgba(254,226,226,0.85)", // red-100/80
  },
  capicua: {
    label: CALLOUT_CAPICUA,
    emoji: "🔥",
    cardBg: "#f59e0b", // amber-500
    borderColor: "#fdba74", // orange-300
    textColor: "#431407", // orange-950
    subTextColor: "rgba(124,45,18,0.85)", // orange-900/80
  },
  veinticinco: {
    label: CALLOUT_VEINTICINCO,
    emoji: "💥",
    cardBg: "#4f46e5", // indigo-600
    borderColor: "#c084fc", // purple-400
    textColor: "#ffffff",
    subTextColor: "rgba(237,233,254,0.85)", // purple-100/80
  },
};

export function CalloutOverlay({
  callout,
  payload,
  onDismiss,
}: CalloutOverlayProps) {
  const { s } = useI18n();

  const config = CALLOUT_CONFIG[callout];
  if (!config) return null;

  // Award lines, shared by the card and the screen-reader label so both say
  // the same thing.
  const lines: string[] = [];
  if (payload) {
    if (typeof payload.pipsAwarded === "number" && payload.pipsAwarded > 0) {
      lines.push(`+${payload.pipsAwarded} ${s.points}`);
    }
    if (typeof payload.capicuaBonus === "number") {
      lines.push(`+${payload.capicuaBonus} ${s.capicuaBonus}`);
    }
    if (typeof payload.veinticincoBonus === "number") {
      lines.push(`+${payload.veinticincoBonus} ${s.bonus}`);
    }
    if (typeof payload.pts === "number" && payload.pts > 0) {
      lines.push(`+${payload.pts} ${s.points}`);
    }
  }

  return (
    <Pressable
      onPress={onDismiss}
      accessibilityViewIsModal
      accessibilityRole="button"
      accessibilityLabel={[config.label, ...lines, s.tapToContinue].join(", ")}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.75)",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <View
        style={{
          backgroundColor: config.cardBg,
          borderRadius: 24,
          paddingVertical: 40,
          paddingHorizontal: 32,
          alignItems: "center",
          maxWidth: 384,
          width: "100%",
          marginHorizontal: 24,
          borderWidth: 2,
          borderColor: config.borderColor,
        }}
      >
        <Text style={{ fontSize: 72, marginBottom: 12 }}>{config.emoji}</Text>

        <Text
          style={{
            fontSize: 44,
            fontWeight: "900",
            letterSpacing: -1,
            color: config.textColor,
          }}
        >
          {config.label}
        </Text>

        {lines.length > 0 && (
          <View style={{ marginTop: 20, gap: 6, alignItems: "center" }}>
            {lines.map((line, i) => (
              <Text
                key={i}
                style={{ fontSize: 16, fontWeight: "600", color: config.subTextColor }}
              >
                {line}
              </Text>
            ))}
          </View>
        )}

        <Text style={{ marginTop: 32, fontSize: 14, color: config.subTextColor }}>
          {s.tapToContinue}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── Mid-round VEINTICINCO banner ────────────────────────────────────────────
// Non-blocking, auto-dismissing. The round continues underneath; the forcer
// needs the board free to play their next tile.

export function VeinticincoBanner({
  teamName,
  onDone,
}: {
  teamName: string | null;
  onDone: () => void;
}) {
  useEffect(() => {
    const doneTimer = setTimeout(onDone, 2300);
    return () => clearTimeout(doneTimer);
  }, [onDone]);

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        alignItems: "center",
        zIndex: 50,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 16,
          backgroundColor: "#4f46e5", // indigo-600
          borderWidth: 1,
          borderColor: "rgba(192,132,252,0.7)", // purple-400/70
        }}
      >
        <Text style={{ fontSize: 24 }}>💥</Text>
        <View>
          <Text
            style={{
              color: "#ffffff",
              fontWeight: "900",
              letterSpacing: -0.5,
            }}
          >
            {CALLOUT_VEINTICINCO}
          </Text>
          <Text
            style={{
              fontSize: 12,
              color: "rgba(237,233,254,0.9)", // purple-100/90
              fontWeight: "600",
            }}
          >
            +25{teamName ? ` · ${teamName}` : ""}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default CalloutOverlay;
