"use client";

import { Button } from "@/components/ui/button";
import { Search, RotateCcw, Loader2 } from "lucide-react";

interface UploadPanelProps {
  photoCount: number;
  analyzing: boolean;
  onAnalyze: () => void;
  onClear: () => void;
  statusText?: string;
}

export function UploadPanel({
  photoCount,
  analyzing,
  onAnalyze,
  onClear,
  statusText,
}: UploadPanelProps) {
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <Button
        size="lg"
        disabled={photoCount === 0 || analyzing}
        onClick={onAnalyze}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {analyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Analyze {photoCount > 0 ? `${photoCount} Photo${photoCount > 1 ? "s" : ""}` : "Photos"}
          </>
        )}
      </Button>
      {photoCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={analyzing}
          className="text-muted-foreground"
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          New Scan
        </Button>
      )}
      {statusText && (
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {statusText}
        </p>
      )}
    </div>
  );
}
