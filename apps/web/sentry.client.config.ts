// Browser-side Sentry init. Loaded automatically by @sentry/nextjs on
// pages that include client components. Errors thrown in React components,
// event handlers, useEffect hooks, etc. surface here.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,

  // Skip entirely if no DSN is configured (e.g. local dev without Sentry).
  // Prevents noisy logs and accidental quota usage in personal envs.
  enabled: !!dsn,

  // Errors only — no performance tracing, no session replay.
  // Both eat the free-tier quota fast and aren't needed for v1.
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Drop noisy errors that aren't actionable: extension warnings,
  // network blips, dev-only HMR errors. Add to this list as we see them.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
    "Network request failed",
  ],

  // Tag every event with the deploy environment for easy filtering.
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
});
