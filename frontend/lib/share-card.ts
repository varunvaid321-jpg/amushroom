// Client-side share card: composes a branded PNG of an identification result
// on an offscreen canvas, entirely in the browser. The user's photo never
// leaves the device except through their own share sheet / download.
import type { Match } from "@/lib/api";
import { track } from "@/lib/track";

// Site design tokens (matches email templates and guide theme)
const BG = "#0e1a0e";
const CARD = "#1a2e1a";
const BORDER = "#3a5a3a";
const CREAM = "#f0e4cc";
const MUTED = "#c4b49a";
const COPPER = "#c8956c";

const W = 1080;
const H = 1350; // 4:5 — feed-friendly

function edibilityStyle(edible: string): { label: string; bg: string; fg: string } {
  const l = edible.toLowerCase();
  if (l.includes("deadly")) return { label: "DEADLY", bg: "#dc2626", fg: "#ffffff" };
  if (l.includes("poisonous") || l.includes("toxic")) return { label: "TOXIC", bg: "#dc2626", fg: "#ffffff" };
  if (l.includes("caution")) return { label: "EDIBLE WITH CAUTION", bg: "#d97706", fg: "#ffffff" };
  if (l.includes("edible") || l === "yes") return { label: "EDIBLE", bg: "#16a34a", fg: "#ffffff" };
  if (l.includes("inedible") || l === "no") return { label: "NOT EDIBLE", bg: "#3a5a3a", fg: "#f0e4cc" };
  return { label: "UNKNOWN EDIBILITY", bg: "#3a5a3a", fg: "#f0e4cc" };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw the user's photo cover-fit into the top region of the canvas. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export async function renderShareCard(match: Match, photoUrl: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Ensure the site fonts are available to the canvas
  await document.fonts.ready;

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Photo — top 62%
  const photoH = Math.round(H * 0.62);
  const img = await loadImage(photoUrl);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, photoH);
  ctx.clip();
  drawCover(ctx, img, W, photoH);
  ctx.restore();

  // Soft gradient from photo into panel
  const grad = ctx.createLinearGradient(0, photoH - 140, 0, photoH);
  grad.addColorStop(0, "rgba(14,26,14,0)");
  grad.addColorStop(1, BG);
  ctx.fillStyle = grad;
  ctx.fillRect(0, photoH - 140, W, 140);

  // Panel content
  let y = photoH + 72;
  const x = 64;

  // Common name
  ctx.fillStyle = CREAM;
  ctx.font = "800 64px Sora, system-ui, sans-serif";
  const name = match.commonName.length > 26 ? match.commonName.slice(0, 25).trimEnd() + "…" : match.commonName;
  ctx.fillText(name, x, y);

  // Scientific name
  y += 56;
  ctx.fillStyle = MUTED;
  ctx.font = "italic 400 38px Manrope, system-ui, sans-serif";
  ctx.fillText(match.scientificName, x, y);

  // Edibility pill
  y += 76;
  const ed = edibilityStyle(match.edible);
  ctx.font = "800 34px Sora, system-ui, sans-serif";
  const pillPadX = 28;
  const pillW = ctx.measureText(ed.label).width + pillPadX * 2;
  const pillH = 64;
  ctx.fillStyle = ed.bg;
  ctx.beginPath();
  ctx.roundRect(x, y - pillH + 14, pillW, pillH, 32);
  ctx.fill();
  ctx.fillStyle = ed.fg;
  ctx.fillText(ed.label, x + pillPadX, y);

  // Match confidence — right of pill
  ctx.fillStyle = MUTED;
  ctx.font = "600 34px Manrope, system-ui, sans-serif";
  ctx.fillText(`${Math.round(match.score)}% match`, x + pillW + 32, y);

  // Divider
  y += 56;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(W - x, y);
  ctx.stroke();

  // Footer branding
  y += 78;
  ctx.fillStyle = CREAM;
  ctx.font = "800 40px Sora, system-ui, sans-serif";
  ctx.fillText("Identified with Orangutany", x, y);
  ctx.fillStyle = COPPER;
  ctx.font = "700 36px Manrope, system-ui, sans-serif";
  ctx.fillText("orangutany.com", x, y + 52);

  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas export failed"))), "image/png");
  });
}

/** Share via the native share sheet when possible, otherwise download. */
export async function shareMatchCard(match: Match, photoUrl: string): Promise<"shared" | "downloaded"> {
  const blob = await renderShareCard(match, photoUrl);
  const file = new File([blob], `orangutany-${match.scientificName.toLowerCase().replace(/\s+/g, "-")}.png`, {
    type: "image/png",
  });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${match.commonName} — identified with Orangutany`,
        text: `I found ${match.commonName} (${match.scientificName}) — identified at orangutany.com`,
      });
      track("share_card", { method: "native", species: match.scientificName });
      return "shared";
    } catch {
      // user cancelled the share sheet — fall through to download? No: cancel means cancel.
      track("share_card", { method: "cancelled", species: match.scientificName });
      return "shared";
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
  track("share_card", { method: "download", species: match.scientificName });
  return "downloaded";
}
