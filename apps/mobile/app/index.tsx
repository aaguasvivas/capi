import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useI18n } from "../lib/i18n";
import { saveSession } from "../lib/session";
import { API_BASE, THEME } from "../theme";

const AVATAR_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
];

export default function Index() {
  const { s } = useI18n();
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!nickname.trim() || loading) return;
    setLoading("create");
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          avatarColor,
          mode: "live",
          theme: "barberia",
          is2v2: false,
          targetScore: 100,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? s.failedCreate);
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId: data.gameId,
      });
      router.push(`/game/${data.gameId}`);
    } catch {
      setError(s.networkError);
    } finally {
      setLoading(null);
    }
  }

  async function handleJoin() {
    if (!nickname.trim() || inviteCode.trim().length !== 6 || loading) return;
    setLoading("join");
    setError("");
    try {
      const code = inviteCode.trim().toUpperCase();
      const lookupRes = await fetch(`${API_BASE}/api/games/by-code/${code}`);
      if (!lookupRes.ok) {
        setError(s.gameNotFound);
        return;
      }
      const { gameId } = await lookupRes.json();

      const joinRes = await fetch(`${API_BASE}/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim(), avatarColor }),
      });
      const data = await joinRes.json();
      if (!joinRes.ok) {
        setError(data.error ?? s.failedJoin);
        return;
      }
      await saveSession({
        playerId: data.playerId,
        seat: data.seat,
        gameId,
      });
      router.push(`/game/${gameId}`);
    } catch {
      setError(s.networkError);
    } finally {
      setLoading(null);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.pageBg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <Text
            style={{
              fontSize: 44,
              fontWeight: "900",
              color: THEME.scoreBg,
              letterSpacing: -1,
            }}
          >
            Capi
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: "#9ca3af",
              marginTop: 2,
            }}
          >
            {s.tagline}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: "#ffffff",
            borderRadius: 24,
            padding: 24,
            gap: 20,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 16,
            elevation: 4,
          }}
        >
          {/* Name */}
          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>{s.yourName}</Text>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              maxLength={20}
              placeholder={s.namePlaceholder}
              placeholderTextColor="#9ca3af"
              style={inputStyle}
            />
          </View>

          {/* Color picker */}
          <View style={{ gap: 8 }}>
            <Text style={labelStyle}>{s.yourColor}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {AVATAR_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setAvatarColor(c)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: c,
                    borderWidth: 3,
                    borderColor:
                      avatarColor === c ? THEME.scoreBg : "transparent",
                    transform:
                      avatarColor === c ? [{ scale: 1.1 }] : undefined,
                  }}
                />
              ))}
            </View>
          </View>

          {error ? (
            <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "500" }}>
              {error}
            </Text>
          ) : null}

          {/* Create */}
          <Pressable
            onPress={handleCreate}
            disabled={!nickname.trim() || loading !== null}
            style={({ pressed }) => ({
              backgroundColor: THEME.scoreBg,
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: "center",
              opacity: !nickname.trim() || loading !== null ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            {loading === "create" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                {s.createAction}
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
            <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "600" }}>
              ·
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: "#e5e7eb" }} />
          </View>

          {/* Join by code */}
          <View style={{ gap: 6 }}>
            <Text style={labelStyle}>{s.inviteCode}</Text>
            <TextInput
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              maxLength={6}
              autoCapitalize="characters"
              placeholder="XXXXXX"
              placeholderTextColor="#9ca3af"
              style={[
                inputStyle,
                {
                  textAlign: "center",
                  letterSpacing: 8,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                },
              ]}
            />
          </View>

          <Pressable
            onPress={handleJoin}
            disabled={
              !nickname.trim() || inviteCode.length !== 6 || loading !== null
            }
            style={({ pressed }) => ({
              borderWidth: 2,
              borderColor: THEME.scoreBg,
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: "center",
              opacity:
                !nickname.trim() || inviteCode.length !== 6 || loading !== null
                  ? 0.4
                  : pressed
                  ? 0.7
                  : 1,
            })}
          >
            {loading === "join" ? (
              <ActivityIndicator color={THEME.scoreBg} />
            ) : (
              <Text
                style={{ color: THEME.scoreBg, fontSize: 15, fontWeight: "700" }}
              >
                {s.joinAction}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const labelStyle = {
  fontSize: 11,
  fontWeight: "700" as const,
  color: "#6b7280",
  textTransform: "uppercase" as const,
  letterSpacing: 1,
};

const inputStyle = {
  borderWidth: 1,
  borderColor: "#e5e7eb",
  borderRadius: 12,
  paddingHorizontal: 16,
  paddingVertical: 12,
  fontSize: 15,
  color: "#111827",
  backgroundColor: "#f9fafb",
};
