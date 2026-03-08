/**
 * Capacitor Camera Bridge
 *
 * Provides native camera/gallery access when running inside Capacitor.
 * Falls back to standard file input on web.
 *
 * All Capacitor imports are dynamic to avoid SSR crashes —
 * @capacitor/core and @capacitor/camera access `window` at import time.
 */

/** True when running inside a Capacitor native shell (iOS/Android) */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Check for Capacitor bridge without importing the module at top level
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).Capacitor;
  } catch {
    return false;
  }
}

/** Convert a base64 data URL to a File object for the existing upload flow */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

/**
 * Open native camera or gallery picker.
 * Returns a File object compatible with the existing addFile(file, slotIndex) flow.
 * Returns null if user cancels.
 */
export async function pickImageNative(
  source: 'camera' | 'gallery'
): Promise<File | null> {
  try {
    // Dynamic import to avoid SSR crash
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');

    const result = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      width: 2048,
      height: 2048,
      correctOrientation: true,
    });

    if (!result.dataUrl) return null;

    const ext = result.format || 'jpeg';
    const filename = `mushroom-${Date.now()}.${ext}`;
    return dataUrlToFile(result.dataUrl, filename);
  } catch {
    // User cancelled or permission denied
    return null;
  }
}
