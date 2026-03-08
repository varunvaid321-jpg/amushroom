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
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { scrollToId } from "@/lib/scroll";
import { Sparkles, X } from "lucide-react";
import { LearnSection } from "@/components/hero/learn-section";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [viewingSavedScan, setViewingSavedScan] = useState(false);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);

  useEffect(() => { track("page_view", { page: "/" }); }, []);

  // Show success banner when returning from Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      setShowUpgradeBanner(true);
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const uploads = useUploads();
  const quota = useQuota();
  const { user } = useAuth();
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
    uploadStory,
    saveStory,
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
    // On mobile, scroll to results after analysis
    if (window.innerWidth < 1024) {
      scrollToId("results");
    }
  };

  const handleLoadUpload = (uploadId: string) => {
    setViewingSavedScan(true);
    loadSavedUpload(uploadId);
    const target = window.innerWidth < 1024 ? "results" : "upload";
    scrollToId(target);
  };

  const handleBackToLibrary = () => {
    setViewingSavedScan(false);
    clearAll();
    scrollToId("library");
  };

  return (
    <>
      <Hero />
      {showUpgradeBanner && (
        <div className="border-b border-primary/20 bg-primary/10">
          <Container>
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                Welcome to Pro! A confirmation email is on its way.
              </div>
              <button onClick={() => setShowUpgradeBanner(false)} className="text-primary/60 hover:text-primary">
                <X className="h-4 w-4" />
              </button>
            </div>
          </Container>
        </div>
      )}
      <section id="upload" className="scroll-mt-[72px] pt-4 pb-12">
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
                limit={quota.limit}
                tier={quota.tier}
                quotaBlocked={quotaBlocked}
              />
            </div>
            <div id="results" className="scroll-mt-[72px] lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <ResultsDock
                state={resultsState}
                matches={matches}
                uploadGuidance={uploadGuidance}
                consistencyCheck={consistencyCheck}
                qualityNotice={qualityNotice}
                quotaExceeded={quotaExceeded}
                quotaTier={quotaInfo?.tier}
                isSavedScan={viewingSavedScan}
                onBackToLibrary={handleBackToLibrary}
                isLoggedIn={!!user}
                uploadStory={uploadStory}
                onSaveStory={saveStory}
              />
            </div>
          </div>
        </Container>
      </section>
      <LearnSection />
      <div id="library" className="scroll-mt-[72px]">
        <HistoryTable onLoadUpload={handleLoadUpload} refreshKey={refreshKey} />
      </div>
    </>
  );
}
