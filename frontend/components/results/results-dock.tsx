"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Microscope, Lock, ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import type { Match, UploadGuidance, ConsistencyCheck } from "@/lib/api";
import { ProfilePanel } from "./profile-panel";
import { MatchCard } from "./match-card";
import { AuthModal } from "@/components/auth/auth-modal";
import { Button } from "@/components/ui/button";

interface ResultsDockProps {
  state: "idle" | "loading" | "ready";
  matches: Match[];
  uploadGuidance: UploadGuidance | null;
  consistencyCheck: ConsistencyCheck | null;
  qualityNotice?: string;
  quotaExceeded?: boolean;
  quotaTier?: string;
  isSavedScan?: boolean;
  onBackToLibrary?: () => void;
  isLoggedIn?: boolean;
  uploadStory?: string | null;
  onSaveStory?: (story: string) => Promise<void>;
}

export function ResultsDock({
  state,
  matches,
  uploadGuidance,
  consistencyCheck,
  qualityNotice,
  quotaExceeded,
  quotaTier,
  isSavedScan,
  onBackToLibrary,
  isLoggedIn,
  uploadStory,
  onSaveStory,
}: ResultsDockProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [storyText, setStoryText] = useState("");
  const [storySaved, setStorySaved] = useState(false);
  const [storySaving, setStorySaving] = useState(false);
  const [storyDismissed, setStoryDismissed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (state === "idle") {
    return null;
  }

  if (state === "loading") {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
        <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {isSavedScan ? "Loading saved scan..." : "Analyzing your photos..."}
        </p>
      </div>
    );
  }

  // Filter: only show matches with >= 30% confidence
  const viableMatches = matches.filter((m) => m.score >= 30);

  if (viableMatches.length === 0) {
    return (
      <div className="space-y-3">
        {isSavedScan && onBackToLibrary && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackToLibrary}
            className="text-muted-foreground hover:text-foreground -ml-1"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Library
          </Button>
        )}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center">
          <Microscope className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No confident matches found. Try uploading clearer photos from multiple angles.
          </p>
        </div>
      </div>
    );
  }

  // Anonymous soft wall — show teaser with blur overlay
  if (quotaExceeded && quotaTier === "anonymous") {
    const top = viableMatches[0];
    return (
      <div className="space-y-4">
        <div className="relative rounded-xl border border-border bg-card overflow-hidden">
          {/* Teaser: name + confidence */}
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{top.commonName}</h2>
                <p className="text-sm italic text-muted-foreground">{top.scientificName}</p>
              </div>
              <div className="text-3xl font-bold tabular-nums text-primary">
                {top.score}%
              </div>
            </div>
            {/* Blurred placeholder for details */}
            <div className="select-none pointer-events-none" style={{ filter: "blur(8px)" }} aria-hidden="true">
              <div className="space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted/50" />
                <div className="h-4 w-1/2 rounded bg-muted/50" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 rounded-full bg-muted/50" />
                  <div className="h-6 w-20 rounded-full bg-muted/50" />
                </div>
                <div className="h-20 w-full rounded bg-muted/50" />
                <div className="h-4 w-2/3 rounded bg-muted/50" />
                <div className="h-4 w-1/2 rounded bg-muted/50" />
              </div>
            </div>
          </div>
          {/* CTA overlay */}
          <div className="border-t border-border bg-card/95 p-6 text-center">
            <Lock className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="mb-1 text-base font-semibold text-foreground">
              Full results are locked
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create a free account to unlock edibility info, traits, look-alikes, and get 5 IDs per day.
            </p>
            <Button onClick={() => setAuthOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Create Free Account
            </Button>
          </div>
        </div>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} defaultTab="register" />
      </div>
    );
  }

  const secondaryMatches = viableMatches.slice(1);
  const topConfidence = viableMatches[0]?.score ?? 0;
  const showStoryPrompt = isLoggedIn && !isSavedScan && !storyDismissed && !storySaved && topConfidence >= 70 && !!onSaveStory;

  const handleSaveStory = async () => {
    if (!storyText.trim() || !onSaveStory) return;
    setStorySaving(true);
    try {
      await onSaveStory(storyText.trim());
      setStorySaved(true);
    } finally {
      setStorySaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {isSavedScan && onBackToLibrary && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBackToLibrary}
          className="text-muted-foreground hover:text-foreground -ml-1"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Library
        </Button>
      )}
      {qualityNotice && (
        <div className="rounded-lg bg-yellow-400/10 p-3 text-sm text-yellow-200">
          {qualityNotice}
        </div>
      )}
      <ProfilePanel
        match={viableMatches[0]}
        uploadGuidance={uploadGuidance}
        consistencyCheck={consistencyCheck}
      />
      {secondaryMatches.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Similar Matches
          </h3>
          <div className="space-y-3">
            {secondaryMatches.map((m, i) => (
              <MatchCard key={i} match={m} rank={i + 2} />
            ))}
          </div>
        </div>
      )}

      {/* Story prompt — shown after new high-confidence scans for logged-in users */}
      {showStoryPrompt && (
        <div className="rounded-xl border border-border/60 bg-card/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary/70" />
            <span className="text-sm font-medium text-foreground">Add to your foraging journal</span>
            <button
              onClick={() => setStoryDismissed(true)}
              className="ml-auto text-xs text-muted-foreground/60 hover:text-muted-foreground"
            >
              Skip
            </button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Where did you find it? Anything interesting about the spot?
          </p>
          <textarea
            ref={textareaRef}
            value={storyText}
            onChange={(e) => setStoryText(e.target.value.slice(0, 500))}
            placeholder="e.g. Found a cluster at the base of an oak tree after last night's rain…"
            rows={3}
            className="w-full resize-none rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/50">{storyText.length}/500</span>
            <Button
              size="sm"
              disabled={!storyText.trim() || storySaving}
              onClick={handleSaveStory}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {storySaving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      {/* Saved confirmation */}
      {storySaved && (
        <div className="flex items-center gap-2 rounded-lg border border-green-800/40 bg-green-900/20 px-4 py-3 text-sm text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Saved to your journal.
        </div>
      )}

      {/* Show/edit story when viewing a saved scan */}
      {isSavedScan && (
        <SavedStoryEditor story={uploadStory ?? null} onSave={onSaveStory} />
      )}
    </div>
  );
}

function SavedStoryEditor({
  story,
  onSave,
}: {
  story: string | null;
  onSave?: (s: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!story);
  const [text, setText] = useState(story || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(story || "");
    setEditing(!story);
    setSaved(false);
  }, [story]);

  const hasChanges = text.trim() !== (story || "").trim();

  const handleSave = async () => {
    if (!text.trim() || !onSave || !hasChanges) return;
    setSaving(true);
    try {
      await onSave(text.trim());
      setSaved(true);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card/30 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary/60" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Journal Entry
          </span>
        </div>
        {!editing && (
          <button
            onClick={() => { setEditing(true); setSaved(false); }}
            className="text-xs text-primary/70 hover:text-primary transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value.slice(0, 500)); setSaved(false); }}
            placeholder="Where did you find it? Anything interesting about the spot?"
            rows={3}
            className="w-full resize-none rounded-lg border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
            autoFocus
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground/50">{text.length}/500</span>
            <div className="flex items-center gap-2">
              {story && (
                <button onClick={() => { setText(story); setEditing(false); setSaved(false); }} className="text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              )}
              <Button
                size="sm"
                disabled={!text.trim() || saving || !hasChanges}
                onClick={handleSave}
                className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{text}</p>
          {saved && (
            <div className="flex items-center gap-1.5 text-xs text-green-500">
              <CheckCircle2 className="h-3 w-3" /> Saved to your journal
            </div>
          )}
        </div>
      )}
    </div>
  );
}
