"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ChunkLoadError happens after a deploy when the browser has cached old
    // JS chunk URLs that no longer exist. Auto-reload once to fetch fresh chunks.
    // sessionStorage flag prevents an infinite reload loop if the error persists.
    const isChunkError = error.name === "ChunkLoadError" || error.message?.includes("Loading chunk");
    if (isChunkError && !sessionStorage.getItem("chunk_reload_attempted")) {
      sessionStorage.setItem("chunk_reload_attempted", "1");
      window.location.reload();
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-sm">
        {error.name === "ChunkLoadError" || error.message?.includes("Loading chunk")
          ? "Reloading to pick up the latest version…"
          : "An unexpected error occurred. Please try again."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
