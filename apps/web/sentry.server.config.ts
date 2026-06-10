// Node.js runtime Sentry init. Errors from API routes and server
// components surface here.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
});
