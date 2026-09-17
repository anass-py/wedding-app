import { useCallback, useEffect, useRef, useState } from "react";
import { MEDIA } from "../config";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import { registerDuration } from "../lib/video";
import { Icon } from "./Icon";

interface Props {
  onCapture: (file: File) => void;
  onClose: () => void;
}

type Facing = "user" | "environment";

export function isCameraSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

function pickMimeType(): string | undefined {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

const HOLD_MS = 220;
const DOUBLE_TAP_MS = 300;
const MAX_MS = MEDIA.MAX_RECORD_SECONDS * 1000;
const RECORD_MAX_SIDE = 1280;

/** Draw the live camera into the canvas, cropped to fill (and mirrored for the selfie camera). */
function drawCover(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, mirror: boolean) {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const vw = v.videoWidth;
  const vh = v.videoHeight;
  if (!vw || !vh) return;
  let sx = 0;
  let sy = 0;
  let sw = vw;
  let sh = vh;
  if (vw / vh > cw / ch) {
    sw = Math.round(vh * (cw / ch));
    sx = Math.round((vw - sw) / 2);
  } else {
    sh = Math.round(vw * (ch / cw));
    sy = Math.round((vh - sh) / 2);
  }
  ctx.save();
  if (mirror) {
    ctx.translate(cw, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(v, sx, sy, sw, sh, 0, 0, cw, ch);
  ctx.restore();
}

/**
 * Snapchat-style camera: tap the shutter for a photo, hold to record, double-tap
 * the view (or the flip button) to switch cameras — also while recording. The
 * recorder reads an off-screen canvas fed by whichever camera is live, so a
 * switch never interrupts it; the microphone track is kept across switches.
 */
export function Camera({ onCapture, onClose }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const audioTrack = useRef<MediaStreamTrack | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const holdTimer = useRef(0);
  const ticker = useRef(0);
  const startedAt = useRef(0);
  const pressed = useRef(false);
  const drawing = useRef(false);
  const facingRef = useRef<Facing>("environment");
  const lastTap = useRef(0);
  const switching = useRef(false);

  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [twoCameras, setTwoCameras] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ file: File; url: string; video: boolean } | null>(null);
  facingRef.current = facing;

  const stopAll = useCallback(() => {
    camStream.current?.getTracks().forEach((tr) => tr.stop());
    camStream.current = null;
    audioTrack.current?.stop();
    audioTrack.current = null;
  }, []);

  /** Open (or switch to) a camera. The mic is requested once and kept. */
  const openCamera = useCallback(
    async (mode: Facing) => {
      if (switching.current) return;
      switching.current = true;
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: !audioTrack.current,
        });
        const audio = s.getAudioTracks()[0];
        if (audio && !audioTrack.current) audioTrack.current = audio;
        camStream.current?.getVideoTracks().forEach((tr) => tr.stop());
        camStream.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = new MediaStream(s.getVideoTracks());
          await v.play().catch(() => undefined);
        }
        setReady(true);
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setTwoCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? t("cameraDenied") : t("cameraUnavailable"));
      } finally {
        switching.current = false;
      }
    },
    [t],
  );

  useEffect(() => {
    void openCamera("environment");
    return () => {
      stopAll();
      window.clearTimeout(holdTimer.current);
      window.clearInterval(ticker.current);
      drawing.current = false;
    };
  }, [openCamera, stopAll]);

  // Re-attach the preview after a photo/video preview is dismissed (the <video> remounts).
  useEffect(() => {
    const v = videoRef.current;
    if (!preview && v && camStream.current && !v.srcObject) {
      v.srcObject = new MediaStream(camStream.current.getVideoTracks());
      void v.play().catch(() => undefined);
    }
  }, [preview]);

  const flip = () => {
    if (!ready || preview || !twoCameras) return;
    const next: Facing = facingRef.current === "user" ? "environment" : "user";
    setFacing(next);
    buzz(6);
    void openCamera(next);
  };

  const onViewTap = () => {
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      flip();
    } else lastTap.current = now;
  };

  const mirrored = facing === "user";

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawCover(ctx, v, mirrored);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
        setPreview({ file, url: URL.createObjectURL(file), video: false });
        buzz(8);
      },
      "image/jpeg",
      0.92,
    );
  };

  const stopRecording = useCallback(() => {
    window.clearInterval(ticker.current);
    drawing.current = false;
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }, []);

  const startRecording = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    // Off-screen canvas fed by the live camera → survives camera switches.
    const scale = Math.min(1, RECORD_MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const c = canvas.current ?? (canvas.current = document.createElement("canvas"));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const canvasStream = c.captureStream(30);
    const tracks = [...canvasStream.getVideoTracks(), ...(audioTrack.current ? [audioTrack.current] : [])];
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(new MediaStream(tracks), mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined);
    } catch {
      rec = new MediaRecorder(new MediaStream(tracks));
    }
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.onstop = () => {
      const seconds = (performance.now() - startedAt.current) / 1000;
      const type = (rec.mimeType || mimeType || "video/webm").split(";")[0];
      const ext = type.includes("mp4") ? "mp4" : "webm";
      const file = new File(chunks.current, `clip-${Date.now()}.${ext}`, { type });
      registerDuration(file, seconds);
      if (seconds < 0.6 || file.size === 0) return; // an accidental long-ish press
      setPreview({ file, url: URL.createObjectURL(file), video: true });
    };
    recorder.current = rec;

    // Paint frames as they arrive (or every animation frame where rVFC is missing).
    drawing.current = true;
    const paint = () => {
      if (!drawing.current) return;
      const live = videoRef.current;
      if (live && live.readyState >= 2) drawCover(ctx, live, facingRef.current === "user");
      const rvfc = live as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }) | null;
      if (rvfc?.requestVideoFrameCallback) rvfc.requestVideoFrameCallback(paint);
      else requestAnimationFrame(paint);
    };
    paint();

    rec.start(250);
    startedAt.current = performance.now();
    setElapsed(0);
    setRecording(true);
    buzz(15);
    ticker.current = window.setInterval(() => {
      const ms = performance.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_MS) stopRecording();
    }, 100);
  };

  const onShutterDown = () => {
    if (!ready || preview) return;
    pressed.current = true;
    holdTimer.current = window.setTimeout(() => {
      if (pressed.current) startRecording();
    }, HOLD_MS);
  };
  const onShutterUp = () => {
    if (!pressed.current) return;
    pressed.current = false;
    window.clearTimeout(holdTimer.current);
    if (recorder.current && recorder.current.state === "recording") stopRecording();
    else if (ready && !preview) takePhoto();
  };

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const use = () => {
    if (!preview) return;
    stopAll();
    onCapture(preview.file);
  };

  const progress = Math.min(1, elapsed / MAX_MS);
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="cam" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      {!preview && (
        <video
          ref={videoRef}
          className={"cam__view" + (mirrored ? " cam__view--mirror" : "")}
          autoPlay
          muted
          playsInline
          onClick={onViewTap}
        />
      )}
      {preview &&
        (preview.video ? (
          <video className="cam__view" src={preview.url} autoPlay loop muted playsInline />
        ) : (
          <img className="cam__view" src={preview.url} alt="" />
        ))}

      <div className="cam__top">
        <button className="cam__round" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
        {!preview && recording && (
          <span className="cam__timer">
            <span className="cam__dot" /> {Math.floor(elapsed / 1000)}s
          </span>
        )}
        {!preview && twoCameras && (
          <button className="cam__round" onClick={flip} aria-label={t("flipCamera")}>
            <Icon name="flip" size={22} />
          </button>
        )}
      </div>

      {error && (
        <div className="cam__error">
          <p>{error}</p>
          <button className="btn btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
        </div>
      )}

      {!preview && !error && (
        <div className="cam__bottom">
          <p className="cam__hint">{recording ? t("releaseToStop") : t("shutterHint")}</p>
          <button
            className={"shutter" + (recording ? " shutter--rec" : "")}
            onPointerDown={onShutterDown}
            onPointerUp={onShutterUp}
            onPointerCancel={onShutterUp}
            onPointerLeave={onShutterUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={t("takePhoto")}
            disabled={!ready}
          >
            <svg className="shutter__ring" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r={R} className="shutter__track" />
              <circle cx="40" cy="40" r={R} className="shutter__progress" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
            </svg>
            <span className="shutter__core" />
          </button>
        </div>
      )}

      {preview && (
        <div className="cam__bottom cam__bottom--preview">
          <button className="btn btn--ghost" onClick={retake}>
            {t("retake")}
          </button>
          <button className="btn btn--primary" onClick={use}>
            {t("useThis")} →
          </button>
        </div>
      )}
    </div>
  );
}
