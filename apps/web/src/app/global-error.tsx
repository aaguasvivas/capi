"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Last-resort boundary for the App Router: a render error anywhere in the
// tree lands here, gets reported, and the player can reload instead of
// staring at a blank page. Copy is bilingual on purpose: the i18n provider
// may be the thing that crashed.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f0e8",
          color: "#1f2937",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          padding: 24,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 360 }}>
          <p style={{ fontSize: 40, margin: 0 }}>🁢</p>
          <h1 style={{ fontSize: 22, margin: "12px 0 6px" }}>
            Algo salió mal / Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 18px" }}>
            La partida sigue en el servidor. Recarga para volver a la mesa. /
            The game is safe on the server. Reload to get back to the table.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#c0392b",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "12px 20px",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Recargar / Reload
          </button>
        </div>
      </body>
    </html>
  );
}
