// Next.js instrumentation hook — runs once at server startup BEFORE any
// request handler. We use it to wire up Sentry for both the Node.js
// runtime (API routes, RSCs) and the Edge runtime (OG image, icons).

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward request errors to Sentry. Wired up automatically by @sentry/nextjs
// but exporting the hook makes it explicit. Required for App Router error
// boundaries to be captured.
export { captureRequestError as onRequestError } from "@sentry/nextjs";
