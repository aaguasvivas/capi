import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";

interface QuickChatProps {
  onSend: (type: "quick_chat" | "emote", payload: string) => void;
}

// Same lists as the web QuickChat component.
const PHRASES_ES = [
  "¡Dale!", "¡Tranquilo!", "¡Aguanta!",
  "¡Eso e'!", "¡Vamo' allá!", "¡Qué lo qué!",
];

const PHRASES_EN = [
  "Let's go!", "Chill out!", "Hold up!",
  "That's crazy!", "We outside!", "Say less!",
];

const EMOTES = ["🔥", "😂", "😤", "💀", "👑"];

export default function QuickChat({ onSend }: QuickChatProps) {
  const { lang, s } = useI18n();
  const [open, setOpen] = useState(false);

  const phrases = lang === "en" ? PHRASES_EN : PHRASES_ES;

  function handleSend(type: "quick_chat" | "emote", value: string) {
    onSend(type, value);
    setOpen(false);
  }

  // The tray sits in normal flow above the button (the whole component is
  // bottom-anchored by the screen), not position:absolute, because RN drops touches
  // that land outside the parent's bounds, so an absolute tray would be
  // visible but untappable.
  return (
    <View style={{ alignItems: "flex-start" }}>
      {open ? (
        <View style={tray}>
          {/* Emote row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {EMOTES.map((e) => (
              <Pressable
                key={e}
                onPress={() => handleSend("emote", e)}
                accessibilityLabel={`Emote ${e}`}
                style={emoteButton}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />

          {/* Quick phrases */}
          <View style={{ gap: 6 }}>
            {phrases.map((p) => (
              <Pressable
                key={p}
                onPress={() => handleSend("quick_chat", p)}
                style={phraseRow}
              >
                <Text style={{ color: "#fde68a", fontSize: 14, fontWeight: "700" }}>
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityLabel={open ? s.closeTray : s.quickChat}
        style={{
          ...toggleButton,
          backgroundColor: open ? "#f59e0b" : "rgba(0,0,0,0.3)",
        }}
      >
        <Text style={{ fontSize: 15 }}>💬</Text>
      </Pressable>
    </View>
  );
}

const tray = {
  width: 220,
  borderRadius: 16,
  backgroundColor: "rgba(0,0,0,0.75)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.1)",
  padding: 12,
  gap: 12,
  marginBottom: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 6,
};

const emoteButton = {
  width: 36,
  height: 36,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const phraseRow = {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 12,
};

const toggleButton = {
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
