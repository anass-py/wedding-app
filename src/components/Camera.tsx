import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
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
const DOUBLE_TAP_MS = 320;
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
 * Snapchat-style camera.
 *  - tap the shutter: photo · hold it: video starts and keeps recording hands-free · tap again: stop
 *  - double-tap the viewfinder (or the flip button): switch camera, also while recording
 * The recorder reads an off-screen canvas painted from whichever camera is live and an audio
 * graph that the current microphone is plugged into, so a switch never interrupts the clip.
 */
export function Camera({ onCapture, onClose }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const camStream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const audioDest = useRef<MediaStreamAudioDestinationNode | null>(null);
  const micSource = useRef<MediaStreamAudioSourceNode | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const holdTimer = useRef(0);
  const ticker = useRef(0);
  const startedAt = useRef(0);
  const press = useRef<{ startedRecording: boolean; stopOnRelease: boolean } | null>(null);
  const drawing = useRef(false);
  const facingRef = useRef<Facing>("environment");
  const mirrorRef = useRef(false);
  const lastTap = useRef(0);
  const switching = useRef(false);

  const [ready, setReady] = useState(false);
  const [mirrored, setMirrored] = useState(false); // flips only once the new camera's frames arrive
  const [twoCameras, setTwoCameras] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ file: File; url: string; video: boolean } | null>(null);
  mirrorRef.current = mirrored;

  /** Plug the current microphone into one stable output track the recorder listens to. */
  const routeMic = (track: MediaStreamTrack | undefined) => {
    if (!track) return;
    try {
      const ac = (audioCtx.current ??= new AudioContext());
      audioDest.current ??= ac.createMediaStreamDestination();
      micSource.current?.disconnect();
      micSource.current = ac.createMediaStreamSource(new MediaStream([track]));
      micSource.current.connect(audioDest.current);
      if (ac.state === "suspended") void ac.resume();
    } catch {
      /* no WebAudio: the raw track is used instead (see startRecording) */
    }
  };

  const stopAll = useCallback(() => {
    camStream.current?.getTracks().forEach((tr) => tr.stop());
    camStream.current = null;
    micSource.current?.disconnect();
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    audioDest.current = null;
  }, []);

  /** Open (or switch to) a camera. Order matters on iOS: stop the old camera before asking for the next. */
  const openCamera = useCallback(
    async (mode: Facing) => {
      if (switching.current) return;
      switching.current = true;
      const old = camStream.current;
      old?.getVideoTracks().forEach((tr) => tr.stop());
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
        old?.getAudioTracks().forEach((tr) => tr.stop());
        camStream.current = s;
        facingRef.current = mode;
        routeMic(s.getAudioTracks()[0]);
        const v = videoRef.current;
        if (v) {
          v.srcObject = new MediaStream(s.getVideoTracks());
          await v.play().catch(() => undefined);
        }
        setMirrored(mode === "user");
        setReady(true);
        setError(null);
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

  const flip = () => {
    if (!ready || preview || !twoCameras || switching.current) return;
    buzz(6);
    void openCamera(facingRef.current === "user" ? "environment" : "user");
  };

  // Raw pointer-downs, not clicks: works with a second finger while the first holds the shutter.
  const onViewPointerDown = (e: RPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      flip();
    } else lastTap.current = now;
  };

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    drawCover(ctx, v, mirrorRef.current);
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
    buzz(10);
  }, []);

  const startRecording = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, RECORD_MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
    const c = canvas.current ?? (canvas.current = document.createElement("canvas"));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const audio = audioDest.current?.stream.getAudioTracks()[0] ?? camStream.current?.getAudioTracks()[0];
    const tracks = [...c.captureStream(30).getVideoTracks(), ...(audio ? [audio] : [])];
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
      if (seconds < 0.6 || file.size === 0) return;
      setPreview({ file, url: URL.createObjectURL(file), video: true });
    };
    recorder.current = rec;

    drawing.current = true;
    const paint = () => {
      if (!drawing.current) return;
      const live = videoRef.current;
      if (live && live.readyState >= 2) drawCover(ctx, live, mirrorRef.current);
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
    void audioCtx.current?.resume().catch(() => undefined);
    const isRecording = recorder.current?.state === "recording";
    press.current = { startedRecording: false, stopOnRelease: isRecording };
    if (!isRecording) {
      holdTimer.current = window.setTimeout(() => {
        if (press.current) {
          press.current.startedRecording = true;
          startRecording();
        }
      }, HOLD_MS);
    }
  };
  const onShutterUp = () => {
    const p = press.current;
    if (!p) return;
    press.current = null;
    window.clearTimeout(holdTimer.current);
    if (p.stopOnRelease) stopRecording(); // tap while recording = stop
    else if (!p.startedRecording && ready && !preview) takePhoto(); // short tap = photo
    // a hold that started the recording: lifting the finger keeps recording (hands-free)
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
      {/* The live view stays mounted (hidden under a preview) so the camera never has to restart. */}
      <video
        ref={videoRef}
        className={"cam__view" + (mirrored ? " cam__view--mirror" : "") + (preview ? " cam__view--hidden" : "")}
        autoPlay
        muted
        playsInline
        onPointerDown={onViewPointerDown}
      />
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
          <button className="cam__round" onPointerDown={flip} aria-label={t("flipCamera")}>
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
          <button
            className={"shutter" + (recording ? " shutter--rec" : "")}
            onPointerDown={onShutterDown}
            onPointerUp={onShutterUp}
            onPointerCancel={onShutterUp}
            onPointerLeave={onShutterUp}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={recording ? t("stop") : t("takePhoto")}
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
