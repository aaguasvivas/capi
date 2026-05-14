// Edge runtime Sentry init. Used by routes/handlers that run on Vercel
// Edge — currently the opengraph-image, icon, apple-icon endpoints.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: !!dsn,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? "development",
});
