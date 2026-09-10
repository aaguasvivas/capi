import * as Sentry from "@sentry/react-native";

// Error reporting for the app. Off until EXPO_PUBLIC_SENTRY_DSN is set for
// the build, and never on in development. Errors only: no tracing, no
// replays, no personal data beyond what the SDK needs to group a crash.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!DSN && !__DEV__;

Sentry.init({
  dsn: DSN,
  enabled: sentryEnabled,
  environment: __DEV__ ? "development" : "production",
  tracesSampleRate: 0,
  sendDefaultPii: false,
  // A network blip is already handled by the table's own retries.
  ignoreErrors: ["Network request failed"],
});

// Wraps the root layout: a React error boundary plus native crash capture.
export const withSentry = Sentry.wrap;
