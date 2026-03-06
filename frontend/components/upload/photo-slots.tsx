"use client";

import { useRef } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const SLOT_LABELS = [
  "Top of cap",
  "Bottom / gills",
  "Stalk",
  "Environment",
  "Extra detail",
];

export const SLOT_ROLES = ["top", "gills", "stalk", "environment", "extra"];

interface PhotoSlotsProps {
  files: (File | null)[];
  previews: (string | null)[];
  onAddFile: (file: File, slotIndex: number) => void;
  onRemoveSlot: (slotIndex: number) => void;
  disabled?: boolean;
}

export function PhotoSlots({
  files,
  previews,
  onAddFile,
  onRemoveSlot,
  disabled,
}: PhotoSlotsProps) {
  return (
    <div>
      <p className="mb-3 text-center text-xs text-muted-foreground">
        One photo is enough — more angles improve confidence.
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Slot
            key={i}
            index={i}
            label={SLOT_LABELS[i]}
            file={files[i]}
            preview={previews[i]}
            onAddFile={onAddFile}
            onRemove={() => onRemoveSlot(i)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

function Slot({
  index,
  label,
  file,
  preview,
  onAddFile,
  onRemove,
  disabled,
}: {
  index: number;
  label: string;
  file: File | null;
  preview: string | null;
  onAddFile: (file: File, slotIndex: number) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const hasImage = !!file || !!preview;
  const displayPreview = preview || (file ? URL.createObjectURL(file) : null);

  return (
    <div
      className={cn(
        "group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
        hasImage
          ? "border-primary/30 bg-muted/30"
          : "border-border hover:border-primary/50 hover:bg-muted/20",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      {hasImage && displayPreview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayPreview}
            alt={label}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <button
            onClick={onRemove}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 px-2 py-1">
            <span className="text-xs font-medium text-white/90">{label}</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-3 text-center">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className="flex gap-3">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-xl bg-muted/50 p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Select photo for ${label}`}
            >
              <ImagePlus className="h-7 w-7" />
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="rounded-xl bg-muted/50 p-3 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={`Take photo for ${label}`}
            >
              <Camera className="h-7 w-7" />
            </button>
          </div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAddFile(f, index);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAddFile(f, index);
          e.target.value = "";
        }}
      />
    </div>
  );
}
