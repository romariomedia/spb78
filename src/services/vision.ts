/**
 * Detects whether a portrait photo contains a clearly visible face / body.
 * Only such photos receive the "living photo" animation — if the silhouette is
 * unclear or the face is hidden, the image stays completely static.
 */

export type PhotoMotion = 'portrait' | 'body' | 'static';

export interface PhotoAnalysis {
  motion: PhotoMotion;
  confidence: number;
  focusX: number; // 0..1 — animation anchor point
  focusY: number;
}

const STATIC_RESULT: PhotoAnalysis = { motion: 'static', confidence: 0, focusX: 0.5, focusY: 0.5 };
const cache = new Map<string, PhotoAnalysis>();

/** Native FaceDetector (Chromium / Android WebView) */
async function detectWithNativeApi(img: HTMLImageElement): Promise<PhotoAnalysis | null> {
  const FaceDetectorCtor = (window as any).FaceDetector;
  if (!FaceDetectorCtor) return null;

  try {
    const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 3 });
    const faces = await detector.detect(img);
    if (!faces || faces.length === 0) return null;

    const face = faces[0];
    const box = face.boundingBox;
    const areaRatio = (box.width * box.height) / (img.naturalWidth * img.naturalHeight);

    // Face must be reasonably large to be considered "clearly visible"
    if (areaRatio < 0.015) return null;

    return {
      motion: areaRatio > 0.09 ? 'portrait' : 'body',
      confidence: Math.min(1, areaRatio * 6),
      focusX: (box.x + box.width / 2) / img.naturalWidth,
      focusY: (box.y + box.height / 2) / img.naturalHeight
    };
  } catch {
    return null;
  }
}

/**
 * Canvas fallback: skin-tone clustering + contrast analysis.
 * Determines if a distinguishable person is present in the frame.
 */
function analyzePixels(img: HTMLImageElement): PhotoAnalysis {
  try {
    const W = 64;
    const H = 64;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return STATIC_RESULT;

    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);

    let skinCount = 0;
    let sumX = 0;
    let sumY = 0;
    let luminanceSum = 0;
    let luminanceSqSum = 0;
    let topSkin = 0; // skin pixels in the upper third → face region

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        luminanceSum += lum;
        luminanceSqSum += lum * lum;

        // Classic RGB skin-tone rule (Kovac et al.)
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const isSkin =
          r > 95 && g > 40 && b > 20 &&
          max - min > 15 &&
          Math.abs(r - g) > 15 &&
          r > g && r > b;

        if (isSkin) {
          skinCount++;
          sumX += x;
          sumY += y;
          if (y < H / 3) topSkin++;
        }
      }
    }

    const total = W * H;
    const skinRatio = skinCount / total;
    const meanLum = luminanceSum / total;
    const variance = luminanceSqSum / total - meanLum * meanLum;
    const contrast = Math.sqrt(Math.max(0, variance));

    // Too dark, too flat or almost no skin → silhouette is unclear, keep static
    if (skinRatio < 0.035 || contrast < 18 || meanLum < 28) {
      return STATIC_RESULT;
    }

    const focusX = skinCount > 0 ? sumX / skinCount / W : 0.5;
    const focusY = skinCount > 0 ? sumY / skinCount / H : 0.4;
    const faceDominant = topSkin / Math.max(1, skinCount) > 0.35 || skinRatio > 0.16;

    return {
      motion: faceDominant ? 'portrait' : 'body',
      confidence: Math.min(1, skinRatio * 4),
      focusX: Math.min(0.85, Math.max(0.15, focusX)),
      focusY: Math.min(0.8, Math.max(0.15, focusY))
    };
  } catch {
    return STATIC_RESULT;
  }
}

export async function analyzePhoto(src: string): Promise<PhotoAnalysis> {
  const cached = cache.get(src);
  if (cached) return cached;

  return new Promise<PhotoAnalysis>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const finish = (result: PhotoAnalysis) => {
      cache.set(src, result);
      resolve(result);
    };

    const timeout = setTimeout(() => finish(STATIC_RESULT), 4000);

    img.onload = async () => {
      clearTimeout(timeout);
      const native = await detectWithNativeApi(img);
      finish(native ?? analyzePixels(img));
    };

    img.onerror = () => {
      clearTimeout(timeout);
      finish(STATIC_RESULT);
    };

    img.src = src;
  });
}
