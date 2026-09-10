// First import on purpose: error reporting initializes before anything else
// can throw. It is a no-op without EXPO_PUBLIC_SENTRY_DSN and in dev builds.
import "../lib/sentry";
import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import { I18nProvider } from "../lib/i18n";
import { EntitlementsProvider } from "../lib/entitlements";
import { SkinProvider } from "../lib/tileSkins";

function RootLayout() {
  return (
    <I18nProvider>
      <EntitlementsProvider>
        <SkinProvider>
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
