const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const UPLOAD_OPTIMIZE_MIN_BYTES = 350 * 1024;
const UPLOAD_MAX_DIMENSION_PX = 1800;
const UPLOAD_MIN_DIMENSION_PX = 1280;
const UPLOAD_JPEG_QUALITY = 0.84;
const UPLOAD_MIN_JPEG_QUALITY = 0.68;
const UPLOAD_TARGET_BYTES = 5 * 1024 * 1024;
const IMAGE_DETAIL_CHECK_MAX_DIMENSION_PX = 96;

export interface ImageQuality {
  lowDetail: boolean;
  blankLike: boolean;
  dynamicRange: number;
  variance: number;
  edgeMean: number;
}

export interface PreparedImage {
  base64: string;
  mimeType: string;
  size: number;
  optimized: boolean;
  quality: ImageQuality;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function assessImageVisualQuality(image: HTMLImageElement): ImageQuality {
  const canvas = document.createElement("canvas");
  const maxDim = IMAGE_DETAIL_CHECK_MAX_DIMENSION_PX;
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const pixels = width * height;
  const lum = new Float32Array(pixels);
  let minL = 255, maxL = 0, sumL = 0;

  for (let i = 0; i < pixels; i++) {
    const off = i * 4;
    const l = 0.2126 * data[off] + 0.7152 * data[off + 1] + 0.0722 * data[off + 2];
    lum[i] = l;
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
    sumL += l;
  }

  const meanL = sumL / pixels;
  let varianceSum = 0;
  for (let i = 0; i < pixels; i++) {
    const d = lum[i] - meanL;
    varianceSum += d * d;
  }
  const variance = varianceSum / pixels;

  let edgeSum = 0, edgeCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx = Math.abs(lum[idx + 1] - lum[idx - 1]);
      const gy = Math.abs(lum[idx + width] - lum[idx - width]);
      edgeSum += (gx + gy) / 2;
      edgeCount++;
    }
  }
  const edgeMean = edgeCount > 0 ? edgeSum / edgeCount : 0;
  const dynamicRange = maxL - minL;

  const blankLike = dynamicRange < 10 && variance < 20 && edgeMean < 2.2;
  const lowDetail = blankLike || (dynamicRange < 22 && variance < 110 && edgeMean < 4.8);

  return { lowDetail, blankLike, dynamicRange, variance, edgeMean };
}

export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const dataUrl = await fileToDataUrl(file);

  if (!COMPRESSIBLE_IMAGE_TYPES.has(file.type) || file.size < UPLOAD_OPTIMIZE_MIN_BYTES) {
    const img = await loadImage(dataUrl);
    const quality = assessImageVisualQuality(img);
    return {
      base64: dataUrl,
      mimeType: file.type || "image/jpeg",
      size: file.size,
      optimized: false,
      quality,
    };
  }

  const img = await loadImage(dataUrl);
  const quality = assessImageVisualQuality(img);

  let bestResult: { base64: string; size: number } | null = null;
  const maxAttempts = 6;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const scaleFactor = Math.pow(0.88, attempt);
    const jpegQuality = Math.max(
      UPLOAD_MIN_JPEG_QUALITY,
      UPLOAD_JPEG_QUALITY - attempt * 0.06,
    );

    const maxDim = Math.max(
      UPLOAD_MIN_DIMENSION_PX,
      Math.round(UPLOAD_MAX_DIMENSION_PX * scaleFactor),
    );
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);

    const compressed = canvas.toDataURL("image/jpeg", jpegQuality);
    const sizeEstimate = Math.round((compressed.length - 23) * 0.75);

    if (!bestResult || sizeEstimate < bestResult.size) {
      bestResult = { base64: compressed, size: sizeEstimate };
    }

    if (sizeEstimate <= UPLOAD_TARGET_BYTES) break;
  }

  if (!bestResult) {
    return {
      base64: dataUrl,
      mimeType: file.type,
      size: file.size,
      optimized: false,
      quality,
    };
  }

  return {
    base64: bestResult.base64,
    mimeType: "image/jpeg",
    size: bestResult.size,
    optimized: true,
    quality,
  };
}
