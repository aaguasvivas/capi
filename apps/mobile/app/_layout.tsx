import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import { I18nProvider } from "../lib/i18n";
import { EntitlementsProvider } from "../lib/entitlements";
import { SkinProvider } from "../lib/tileSkins";

export default function RootLayout() {
  return (
    <I18nProvider>
      <EntitlementsProvider>
        <SkinProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </SkinProvider>
      </EntitlementsProvider>
    </I18nProvider>
  );
}
