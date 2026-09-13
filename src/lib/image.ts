/**
 * Client-side image processing: everything is resized in the browser before
 * upload so a 12 MP phone photo becomes ~300 KB, uploads fast on venue WiFi,
 * and storage stays within the free tier.
 */
export interface Processed {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

const FULL_MAX_SIDE = 1920;
const THUMB_MAX_SIDE = 720;
const AVATAR_SIDE = 320;

export async function processImage(file: File): Promise<Processed> {
  const img = await loadImage(file);
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) throw new Error("Could not decode image");

    const scale = Math.min(1, FULL_MAX_SIDE / Math.max(w, h));
    const fw = Math.round(w * scale);
    const fh = Math.round(h * scale);
    const full = await toBlob(draw(img, 0, 0, w, h, fw, fh), 0.86);

    // Thumbnail keeps the real proportions (masonry grid); bubbles crop it with object-fit.
    const ts = Math.min(1, THUMB_MAX_SIDE / Math.max(w, h));
    const thumb = await toBlob(draw(img, 0, 0, w, h, Math.round(w * ts), Math.round(h * ts)), 0.8);

    return { full, thumb, width: fw, height: fh };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/** Square centre-cropped avatar for the profile. */
export async function processAvatar(file: File): Promise<Blob> {
  const img = await loadImage(file);
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const side = Math.min(w, h);
    const sx = Math.round((w - side) / 2);
    const sy = Math.round((h - side) / 2);
    return await toBlob(draw(img, sx, sy, side, side, AVATAR_SIDE, AVATAR_SIDE), 0.82);
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unsupported image format"));
    };
    img.src = url;
  });
}

function draw(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  // Modern browsers apply EXIF orientation when decoding into <img>, so the
  // canvas output is already upright.
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), "image/jpeg", quality);
  });
}
