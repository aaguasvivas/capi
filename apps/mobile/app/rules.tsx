import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { RULES } from "@capi/i18n";
import { useI18n } from "../lib/i18n";
import { THEME } from "../theme";

// How-to-play modal: the rules exactly as packages/engine plays them, in the
// player's language. Same header and card look as the store sheet.
export default function RulesScreen() {
  const { lang, s } = useI18n();
  const rules = RULES[lang];

  return (
    // iOS modals sit below the status bar already (top inset 0); Android
    // shows the screen full height, so the header needs the inset.
    <SafeAreaView
      edges={["top"]}
      style={{ flex: 1, backgroundColor: THEME.pageBg }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 10,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: "900", color: "#111827" }}>
          {rules.title}
        </Text>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={s.back}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.06)",
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#6b7280" }}>
            ✕
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          gap: 10,
        }}
      >
        <Text
          style={{
            fontSize: 13,
            lineHeight: 19,
            color: "#6b7280",
            marginBottom: 2,
          }}
        >
          {rules.intro}
        </Text>

        {rules.sections.map((section) => (
          <View
            key={section.title}
            style={{
              backgroundColor: "#ffffff",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#e5e7eb",
              paddingHorizontal: 14,
              paddingVertical: 12,
              gap: 6,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>
              {section.title}
            </Text>
            {section.items.map((item) => (
              <View key={item} style={{ flexDirection: "row", gap: 8 }}>
                <Text style={{ fontSize: 13, lineHeight: 19, color: "#9ca3af" }}>
                  •
                </Text>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 13,
                    lineHeight: 19,
                    color: "#4b5563",
                  }}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
