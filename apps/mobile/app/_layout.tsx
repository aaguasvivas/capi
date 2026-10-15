// First import on purpose: error reporting initializes before anything else
// can throw. It is a no-op without EXPO_PUBLIC_SENTRY_DSN and in dev builds.
import "../lib/sentry";
import { useEffect } from "react";
import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import { I18nProvider } from "../lib/i18n";
import { EntitlementsProvider, useEntitlements } from "../lib/entitlements";
import { writeSharedFile } from "../lib/sharedFile";
import { sharedFileContent } from "../lib/sharedPayload";
import { SkinProvider, useTileSkin } from "../lib/tileSkins";

// Keeps the iMessage extension's shared file current: once the cached
// entitlements load, and again whenever they or the picked design change.
function SharedFileSync() {
  const { ent, hydrated } = useEntitlements();
  const { skinId } = useTileSkin();
  useEffect(() => {
    if (hydrated) writeSharedFile(sharedFileContent(skinId, ent));
  }, [hydrated, ent, skinId]);
  return null;
}

function RootLayout() {
  return (
    <I18nProvider>
      <EntitlementsProvider>
        <SkinProvider>
          <SharedFileSync />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen
              name="rules"
              options={{ presentation: "modal", headerShown: false }}
            />
          </Stack>
        </SkinProvider>
      </EntitlementsProvider>
    </I18nProvider>
  );
}

export default RootLayout;
