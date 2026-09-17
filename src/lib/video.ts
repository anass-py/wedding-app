import { MEDIA } from "../config";

/** Thrown for videos we refuse or cannot read; `code` maps to an i18n message. */
export class VideoError extends Error {
  constructor(public code: "too-large" | "too-long" | "unreadable") {
    super(code);
  }
}

export interface ProcessedVideo {
  poster: Blob;
  width: number;
  height: number;
  duration: number;
}

/** MediaRecorder's webm often reports duration = Infinity; the camera registers the real length here. */
const knownDurations = new WeakMap<File, number>();
export function registerDuration(file: File, seconds: number): void {
  knownDurations.set(file, seconds);
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") || /\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name);
}

function waitEvent(el: HTMLMediaElement, name: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new VideoError("unreadable")), ms);
    const done = () => {
      window.clearTimeout(t);
      resolve();
    };
    el.addEventListener(name, done, { once: true });
    el.addEventListener("error", () => reject(new VideoError("unreadable")), { once: true });
  });
}

/**
 * Reads the video in the browser to grab a poster frame and its duration.
 * The video itself is uploaded as-is (phones already compress on pick — iOS
 * re-encodes to H.264 when you choose a video from Photos).
 */
export async function processVideo(file: File): Promise<ProcessedVideo> {
  if (file.size > MEDIA.MAX_VIDEO_MB * 1024 * 1024) throw new VideoError("too-large");
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  try {
    await waitEvent(v, "loadedmetadata", 20_000);
    const duration = Number.isFinite(v.duration) ? v.duration : (knownDurations.get(file) ?? 0);
    if (duration > MEDIA.MAX_VIDEO_SECONDS) throw new VideoError("too-long");
    // iOS only paints frames to a canvas after play() has been called once.
    await v.play().catch(() => undefined);
    v.currentTime = Math.min(1, duration / 3);
    await waitEvent(v, "seeked", 10_000).catch(() => undefined);
    v.pause();
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) throw new VideoError("unreadable");
    const scale = Math.min(1, 720 / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    const ctx = c.getContext("2d");
    if (!ctx) throw new VideoError("unreadable");
    ctx.drawImage(v, 0, 0, c.width, c.height);
    const poster = await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new VideoError("unreadable"))), "image/jpeg", 0.8),
    );
    return { poster, width: w, height: h, duration };
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}

export function formatDuration(s: number | null | undefined): string {
  const total = Math.max(0, Math.round(s ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function videoExt(file: File): string {
  const m = file.name.match(/\.(mp4|mov|m4v|webm|3gp)$/i);
  if (m) return m[1].toLowerCase();
  if (file.type === "video/quicktime") return "mov";
  if (file.type === "video/webm") return "webm";
  return "mp4";
}
