"use client";

import { Hero } from "@/components/hero/hero";
import { PhotoSlots } from "@/components/upload/photo-slots";
import { UploadPanel } from "@/components/upload/upload-panel";
import { ResultsDock } from "@/components/results/results-dock";
import { PortfolioGrid } from "@/components/portfolio/portfolio-grid";
import { Container } from "@/components/layout/container";
import { useUploads } from "@/hooks/use-uploads";

export default function Home() {
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
    analyze,
    loadSavedUpload,
  } = useUploads();

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
                onAnalyze={analyze}
                onClear={clearAll}
                statusText={statusText}
              />
            </div>
            <div className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
              <ResultsDock
                state={resultsState}
                matches={matches}
                uploadGuidance={uploadGuidance}
                consistencyCheck={consistencyCheck}
                qualityNotice={qualityNotice}
              />
            </div>
          </div>
        </Container>
      </section>
      <PortfolioGrid onLoadUpload={loadSavedUpload} />
    </>
  );
}
