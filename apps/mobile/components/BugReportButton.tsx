import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useI18n } from "../lib/i18n";
import { API_BASE, THEME } from "../theme";

interface Props {
  gameId: string;
  playerId?: string;
  gameState: unknown;
  stateVersion: number;
}

type Status = "idle" | "sending" | "sent" | "error";

export default function BugReportButton({
  gameId,
  playerId,
  gameState,
  stateVersion,
}: Props) {
  const { s, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<TextInput>(null);

  // Reset when the modal closes so the next open starts fresh.
  useEffect(() => {
    if (!open) {
      setMessage("");
      setStatus("idle");
    }
  }, [open]);

  function requestClose() {
    if (status === "sending") return;
    setOpen(false);
  }

  async function handleSubmit() {
    const trimmed = message.trim();
    if (!trimmed || status === "sending") return;
    setStatus("sending");
    try {
      const { width, height } = Dimensions.get("window");
      const res = await fetch(`${API_BASE}/api/bug-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          playerId,
          message: trimmed,
          userAgent: `Capi Mobile (${Platform.OS} ${Platform.Version})`,
          url: `${API_BASE}/game/${gameId}`,
          viewportW: width,
          viewportH: height,
          language: lang,
          gameState,
          stateVersion,
        }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      setStatus("sent");
      setTimeout(() => setOpen(false), 1300);
    } catch {
      setStatus("error");
    }
  }

  const sendDisabled = !message.trim() || status === "sending" || status === "sent";

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={s.reportBug}
        hitSlop={10}
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.3)",
        }}
      >
        <Text style={{ fontSize: 15 }}>🐞</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={requestClose}
        onShow={() => {
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <Pressable
          onPress={requestClose}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 20,
              padding: 20,
              width: "100%",
              maxWidth: 360,
              gap: 14,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: "900",
                  color: "#111827",
                  flexShrink: 1,
                  paddingRight: 12,
                }}
              >
                🐞 {s.reportBugTitle}
              </Text>
              <Pressable
                onPress={requestClose}
                disabled={status === "sending"}
                accessibilityRole="button"
                accessibilityLabel={s.reportBugCancel}
                hitSlop={12}
                style={{ opacity: status === "sending" ? 0.5 : 1, marginTop: -2 }}
              >
                <Text style={{ color: "#9ca3af", fontSize: 18, lineHeight: 20 }}>
                  ✕
                </Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 13, color: "#6b7280", lineHeight: 18 }}>
              {s.reportBugPrompt}
            </Text>

            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
              editable={status !== "sending" && status !== "sent"}
              placeholder={s.reportBugPlaceholder}
              placeholderTextColor="#9ca3af"
              textAlignVertical="top"
              style={{
                borderWidth: 1,
                borderColor: "#d1d5db",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                color: "#111827",
                minHeight: 96,
                backgroundColor: status === "sending" ? "#f9fafb" : "#ffffff",
              }}
            />

            {status === "error" ? (
              <Text style={{ fontSize: 12, color: "#dc2626", fontWeight: "600" }}>
                {s.reportBugFailed}
              </Text>
            ) : null}

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 4,
              }}
            >
              <Pressable
                onPress={requestClose}
                disabled={status === "sending"}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  opacity: status === "sending" ? 0.5 : 1,
                }}
              >
                <Text style={{ fontSize: 14, color: "#6b7280", fontWeight: "600" }}>
                  {s.reportBugCancel}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSubmit}
                disabled={sendDisabled}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: THEME.scoreBg,
                  opacity: sendDisabled ? 0.5 : 1,
                }}
              >
                {status === "sending" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : null}
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                  {status === "sending"
                    ? s.reportBugSending
                    : status === "sent"
                      ? `✓ ${s.reportBugSent}`
                      : s.reportBugSend}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
