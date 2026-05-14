/** @type {import('next').NextConfig} */
const nextConfig = {};

const { withSentryConfig } = require("@sentry/nextjs");

// Wrap with Sentry only if a DSN is configured. Locally, when SENTRY_DSN
// is unset, this no-ops cleanly so dev doesn't need Sentry installed/auth.
const isSentryEnabled =
  !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;

module.exports = isSentryEnabled
  ? withSentryConfig(nextConfig, {
      // Vercel's Sentry integration auto-populates these from the connected
      // Sentry project. Falls back to undefined for plain Vercel deploys.
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Silence the CLI's stdout chatter during builds.
      silent: !process.env.CI,

      // Upload source maps from .next/static + serverless bundles so stack
      // traces in the dashboard show original TS lines instead of minified.
      widenClientFileUpload: true,

      // Don't ship source maps to the browser — they're only uploaded to
      // Sentry and stripped from the public build.
      hideSourceMaps: true,

      // Strip Sentry's verbose logger from the client bundle.
      disableLogger: true,

      // Skip auto-creating Vercel cron monitors — we don't have any yet.
      automaticVercelMonitors: false,
    })
  : nextConfig;
