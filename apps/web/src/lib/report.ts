import * as Sentry from "@sentry/nextjs";

// One place for server-side failures: the log line keeps working without a
// DSN, and Sentry gets the same error with the route name as a tag when one
// is configured (see sentry.server.config.ts).
export function reportError(err: unknown, where: string): void {
  console.error(`${where} error:`, err);
  Sentry.captureException(err, { tags: { where } });
}
