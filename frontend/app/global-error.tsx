"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (error.name === "ChunkLoadError" || error.message?.includes("Loading chunk")) {
      window.location.reload();
    }
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, background: "#0f1a12", color: "#e8ede9", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "1rem", padding: "1rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Something went wrong</h2>
          <p style={{ fontSize: "0.875rem", color: "#9ca89d", maxWidth: "24rem" }}>
            {error.name === "ChunkLoadError" || error.message?.includes("Loading chunk")
              ? "Reloading to pick up the latest version…"
              : "An unexpected error occurred. Please try again."}
          </p>
          <button
            onClick={reset}
            style={{ background: "#4e7a52", color: "white", border: "none", borderRadius: "0.5rem", padding: "0.5rem 1rem", fontSize: "0.875rem", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
