import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import "../global.css";
import { I18nProvider } from "../lib/i18n";

export default function RootLayout() {
  return (
    <I18nProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </I18nProvider>
  );
}
