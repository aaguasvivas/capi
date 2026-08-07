import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import "../global.css";
import { I18nProvider } from "../lib/i18n";
import { SkinProvider } from "../lib/tileSkins";

export default function RootLayout() {
  return (
    <I18nProvider>
      <SkinProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SkinProvider>
    </I18nProvider>
  );
}
