import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { EMOTES, QUICK_PHRASES, type QuickChatKind } from "@capi/i18n";
import { useI18n } from "../lib/i18n";

interface QuickChatProps {
  // Quick chat is predefined end to end: a phrase leaves here as its id from
  // QUICK_PHRASES, and the screen's sender turns it into wire text.
  onSend: (type: QuickChatKind, payload: string) => void;
}

// Two phrase columns keep ten phrases within the height the old single
// column of seven used, so the tray still fits above the button on an SE.
// The width includes the border and padding, so both come off the columns.
// One spare point keeps pixel rounding from wrapping the pair.
const TRAY_WIDTH = 264;
const TRAY_BORDER = 1;
const TRAY_PADDING = 12;
const COLUMN_GAP = 6;
const PHRASE_WIDTH = Math.floor(
  (TRAY_WIDTH - 2 * (TRAY_BORDER + TRAY_PADDING) - COLUMN_GAP - 1) / 2
);

export default function QuickChat({ onSend }: QuickChatProps) {
  const { lang, s } = useI18n();
  const [open, setOpen] = useState(false);

  function handleSend(type: QuickChatKind, value: string) {
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
          {/* Emote row. The emoji itself is the accessible name. */}
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
                accessibilityRole="button"
                style={emoteButton}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />

          {/* Quick phrases, shown in the current language, sent by id */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: COLUMN_GAP,
            }}
          >
            {QUICK_PHRASES.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => handleSend("quick_chat", p.id)}
                accessibilityRole="button"
                style={phraseCell}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                  style={{ color: "#fde68a", fontSize: 13, fontWeight: "700" }}
                >
                  {p[lang]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => setOpen((prev) => !prev)}
        accessibilityRole="button"
        accessibilityLabel={open ? s.closeTray : s.quickChat}
        accessibilityState={{ expanded: open }}
        hitSlop={10}
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
  width: TRAY_WIDTH,
  borderRadius: 16,
  backgroundColor: "rgba(0,0,0,0.75)",
  borderWidth: TRAY_BORDER,
  borderColor: "rgba(255,255,255,0.1)",
  padding: TRAY_PADDING,
  gap: 12,
  marginBottom: 10,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 6,
};

const emoteButton = {
  width: 40,
  height: 40,
  borderRadius: 12,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const phraseCell = {
  width: PHRASE_WIDTH,
  minHeight: 40,
  paddingHorizontal: 8,
  borderRadius: 12,
  backgroundColor: "rgba(255,255,255,0.08)",
  justifyContent: "center" as const,
};

const toggleButton = {
  width: 30,
  height: 30,
  borderRadius: 15,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};
