"use client";

import { useState, useEffect } from "react";
import { Hero } from "@/components/hero/hero";
import { track } from "@/lib/track";
import { PhotoSlots } from "@/components/upload/photo-slots";
import { UploadPanel } from "@/components/upload/upload-panel";
import { ResultsDock } from "@/components/results/results-dock";
import { HistoryTable } from "@/components/portfolio/history-table";
import { Container } from "@/components/layout/container";
import { useUploads } from "@/hooks/use-uploads";
import { useQuota } from "@/hooks/use-quota";
import { ApiError } from "@/lib/api";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { track("page_view", { page: "/" }); }, []);

  const uploads = useUploads();
  const quota = useQuota();
  const {
    files,
    previews,
    photoCount,
    resultsState,
    matches,
    uploadGuidance,
    consistencyCheck,
    qualityNotice,
    statusText,
    addFile,
    removeSlot,
    clearAll,
    loadSavedUpload,
    quotaExceeded,
    quotaInfo,
  } = uploads;

  const quotaBlocked = quota.remaining !== null && quota.remaining <= 0;

  const handleAnalyze = async () => {
    track("button_click", { button: "analyze", photoCount: uploads.photoCount });
    try {
      await uploads.analyze();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.body?.quota_exceeded) {
        // Quota exceeded — refresh quota state to update UI
      }
    }
    await quota.refresh();
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <Hero />
      <section id="upload" className="py-12">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[1fr,420px]">
            <div className="space-y-6">
              <PhotoSlots
                files={files}
                previews={previews}
                onAddFile={addFile}
                onRemoveSlot={removeSlot}
                disabled={resultsState === "loading"}
              />
              <UploadPanel
                photoCount={photoCount}
                analyzing={resultsState === "loading"}
                onAnalyze={handleAnalyze}
                onClear={clearAll}
                statusText={statusText}
                remaining={quota.remaining}
                tier={quota.tier}
                quotaBlocked={quotaBlocked}
              />
            </div>
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <ResultsDock
                state={resultsState}
                matches={matches}
                uploadGuidance={uploadGuidance}
                consistencyCheck={consistencyCheck}
                qualityNotice={qualityNotice}
                quotaExceeded={quotaExceeded}
                quotaTier={quotaInfo?.tier}
              />
            </div>
          </div>
        </Container>
      </section>
      <HistoryTable onLoadUpload={loadSavedUpload} refreshKey={refreshKey} />
    </>
  );
}
