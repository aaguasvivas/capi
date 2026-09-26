import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";
import { useI18n } from "../lib/i18n";
import { API_BASE, THEME } from "../theme";

// The app version rides in the user agent so a report can be matched to the
// build that produced it.
const APP_VERSION = Constants.expoConfig?.version ?? "unknown";

interface Props {
  gameId: string;
  playerId?: string;
  gameState: unknown;
  stateVersion: number;
  /** Outline and glyph color of the trigger, taken from the bar it sits on. */
  tint: string;
}

type Status = "idle" | "sending" | "sent" | "error";

export default function BugReportButton({
  gameId,
  playerId,
  gameState,
  stateVersion,
  tint,
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
          userAgent: `Capi Mobile ${APP_VERSION} (${Platform.OS} ${Platform.Version})`,
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
      {/* A small outline icon, unlike the filled chat button, so it does not
          read as a second way to talk to the table. */}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={s.reportBug}
        hitSlop={12}
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: tint,
          opacity: 0.6,
        }}
      >
        <Text style={{ fontSize: 10 }}>🐞</Text>
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
        {/* The input focuses on open, so the card is centered in the space
            above the keyboard; otherwise Send sits under it on SE and 6.1"
            phones. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
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
            {/* A tap on the card outside the input hides the keyboard. */}
            <Pressable
              onPress={Keyboard.dismiss}
              accessible={false}
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

              {/* Players reach for this form to talk to the table; point them
                  at the chat before they type. */}
              <View
                style={{
                  backgroundColor: "#fef3c7",
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    lineHeight: 18,
                    color: "#92400e",
                    fontWeight: "700",
                  }}
                >
                  {s.reportBugNotChat}
                </Text>
              </View>

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
                  // Capped so a long report scrolls inside the box instead
                  // of pushing Send back under the keyboard.
                  minHeight: 80,
                  maxHeight: 110,
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
                  accessibilityRole="button"
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
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
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: sendDisabled,
                    busy: status === "sending",
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
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
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
