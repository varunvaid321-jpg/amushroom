"use client";

import { useCallback, useEffect, useState } from "react";
import { identify, getUploadDetail, saveStory as apiSaveStory, type Match, type UploadGuidance, type ConsistencyCheck, type ImageMeta, type QuotaInfo } from "@/lib/api";
import { prepareImageForUpload } from "@/lib/image-utils";
import { SLOT_ROLES } from "@/components/upload/photo-slots";

export type ResultsState = "idle" | "loading" | "ready";

export function useUploads() {
  const [files, setFiles] = useState<(File | null)[]>(Array(5).fill(null));
  const [previews, setPreviews] = useState<(string | null)[]>(Array(5).fill(null));
  const [resultsState, setResultsState] = useState<ResultsState>("idle");
  const [matches, setMatches] = useState<Match[]>([]);
  const [uploadGuidance, setUploadGuidance] = useState<UploadGuidance | null>(null);
  const [consistencyCheck, setConsistencyCheck] = useState<ConsistencyCheck | null>(null);
  const [qualityNotice, setQualityNotice] = useState<string>("");
  const [statusText, setStatusText] = useState("");
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [uploadStory, setUploadStory] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

  const photoCount = files.reduce((count, file, i) => count + (file || previews[i] ? 1 : 0), 0);

  const addFile = useCallback((file: File, slotIndex: number) => {
    setFiles((prev) => {
      const next = [...prev];
      next[slotIndex] = file;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      next[slotIndex] = URL.createObjectURL(file);
      return next;
    });
    // Clear results when new photos added
    setResultsState("idle");
    setMatches([]);
    setStatusText("");
  }, []);

  const removeSlot = useCallback((index: number) => {
    setFiles((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setPreviews((prev) => {
      const next = [...prev];
      if (next[index]) URL.revokeObjectURL(next[index]!);
      next[index] = null;
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    previews.forEach((p) => p && URL.revokeObjectURL(p));
    setFiles(Array(5).fill(null));
    setPreviews(Array(5).fill(null));
    setResultsState("idle");
    setMatches([]);
    setUploadGuidance(null);
    setConsistencyCheck(null);
    setQualityNotice("");
    setStatusText("");
    setCurrentUploadId(null);
    setUploadStory(null);
    setQuotaExceeded(false);
    setQuotaInfo(null);
    // Clear URL param
    const url = new URL(window.location.href);
    url.searchParams.delete("uploadId");
    window.history.replaceState({}, "", url.toString());
  }, [previews]);

  const analyze = useCallback(async () => {
    const slotEntries = files
      .map((f, i) => (f ? { file: f, index: i } : null))
      .filter((e): e is { file: File; index: number } => e !== null);

    if (slotEntries.length === 0) return;

    setResultsState("loading");
    setStatusText("Preparing images...");

    try {
      const prepared = await Promise.all(
        slotEntries.map((e) => prepareImageForUpload(e.file)),
      );

      const images = prepared.map((p) => {
        const raw = p.base64;
        const commaIdx = raw.indexOf(",");
        return commaIdx >= 0 ? raw.slice(commaIdx + 1) : raw;
      });
      const photoRoles = slotEntries.map((e) => SLOT_ROLES[e.index]);
      const imageMeta: ImageMeta[] = slotEntries.map((e, i) => ({
        filename: e.file.name,
        mimeType: prepared[i].mimeType,
        size: prepared[i].size,
      }));

      // Check for blank images
      const blankCount = prepared.filter((p) => p.quality.blankLike).length;
      const lowDetailCount = prepared.filter((p) => p.quality.lowDetail).length;
      if (blankCount === prepared.length) {
        throw new Error(
          "All photos appear blank or extremely low detail. Please upload clear mushroom photos.",
        );
      }

      let notice = "";
      if (blankCount > 0) {
        notice = `${blankCount} photo(s) appear blank and may not contribute to identification.`;
      } else if (lowDetailCount > 0) {
        notice = `${lowDetailCount} photo(s) are low detail — clearer images may improve results.`;
      }

      setStatusText("Identifying...");
      const result = await identify(images, photoRoles, imageMeta);

      setMatches(result.matches);
      setUploadGuidance(result.uploadGuidance);
      setConsistencyCheck(result.consistencyCheck);
      setQualityNotice(notice);
      setCurrentUploadId(result.uploadId);
      setQuotaExceeded(result.quota_exceeded || false);
      setQuotaInfo(result.quota || null);
      setResultsState("ready");
      setStatusText("");

      // Update URL with uploadId
      if (result.uploadId) {
        const url = new URL(window.location.href);
        url.searchParams.set("uploadId", result.uploadId);
        window.history.replaceState({}, "", url.toString());
      }
    } catch (err) {
      setResultsState("idle");
      setStatusText(err instanceof Error ? err.message : "Identification failed.");
    }
  }, [files]);

  const loadSavedUpload = useCallback(async (uploadId: string) => {
    setResultsState("loading");
    setStatusText("Loading saved scan...");
    try {
      const detail = await getUploadDetail(uploadId);
      // Show saved images as previews
      const newPreviews: (string | null)[] = Array(5).fill(null);
      detail.images.forEach((img) => {
        const idx = SLOT_ROLES.indexOf(img.role);
        if (idx >= 0) newPreviews[idx] = img.previewUrl;
      });
      setPreviews(newPreviews);
      setFiles(Array(5).fill(null)); // No File objects for saved uploads

      setMatches(detail.matches);
      setConsistencyCheck(detail.consistencyCheck || null);
      setUploadGuidance(detail.uploadGuidance || null);
      setCurrentUploadId(uploadId);
      setUploadStory(detail.userStory ?? null);
      setResultsState("ready");
      setStatusText("");

      const url = new URL(window.location.href);
      url.searchParams.set("uploadId", uploadId);
      window.history.replaceState({}, "", url.toString());
    } catch {
      setResultsState("idle");
      setStatusText("Failed to load saved scan.");
    }
  }, []);

  // Load from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("uploadId");
      if (id) loadSavedUpload(id);
    } catch {
      // ignore — URL parse can fail in some environments
    }
  }, [loadSavedUpload]);

  const saveStory = useCallback(async (story: string) => {
    if (!currentUploadId) return;
    await apiSaveStory(currentUploadId, story);
    setUploadStory(story);
  }, [currentUploadId]);

  // Handle popstate
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("uploadId");
      if (id) loadSavedUpload(id);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [loadSavedUpload]);

  return {
    files,
    previews,
    photoCount,
    resultsState,
    matches,
    uploadGuidance,
    consistencyCheck,
    qualityNotice,
    statusText,
    currentUploadId,
    uploadStory,
    quotaExceeded,
    quotaInfo,
    addFile,
    removeSlot,
    clearAll,
    analyze,
    loadSavedUpload,
    saveStory,
  };
}
