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
    typeof MediaRecorder !== "undefined"
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
const MAX_MS = MEDIA.MAX_RECORD_SECONDS * 1000;

/**
 * Snapchat-style in-app camera: tap the shutter for a photo, hold it to record
 * a video (ring shows the time), flip between front/back, preview, then use.
 */
export function Camera({ onCapture, onClose }: Props) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const holdTimer = useRef(0);
  const ticker = useRef(0);
  const startedAt = useRef(0);
  const pressed = useRef(false);

  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [twoCameras, setTwoCameras] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState<{ file: File; url: string; video: boolean } | null>(null);

  const stopStream = useCallback(() => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
  }, []);

  // (Re)open the camera whenever the facing mode changes.
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    (async () => {
      stopStream();
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
        if (cancelled) {
          s.getTracks().forEach((tr) => tr.stop());
          return;
        }
        stream.current = s;
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        setReady(true);
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setTwoCameras(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (e) {
        setError(e instanceof DOMException && e.name === "NotAllowedError" ? t("cameraDenied") : t("cameraUnavailable"));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing, stopStream, t]);

  useEffect(
    () => () => {
      stopStream();
      window.clearTimeout(holdTimer.current);
      window.clearInterval(ticker.current);
      if (preview) URL.revokeObjectURL(preview.url);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const mirrored = facing === "user";

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    if (mirrored) {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
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
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
    setRecording(false);
  }, []);

  const startRecording = () => {
    const s = stream.current;
    if (!s) return;
    const mimeType = pickMimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(s, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);
    } catch {
      rec = new MediaRecorder(s);
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
    stopStream();
    onCapture(preview.file);
  };

  const progress = Math.min(1, elapsed / MAX_MS);
  const R = 34;
  const C = 2 * Math.PI * R;

  return (
    <div className="cam" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
      {!preview && (
        <video ref={videoRef} className={"cam__view" + (mirrored ? " cam__view--mirror" : "")} autoPlay muted playsInline />
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
        {!preview && twoCameras && !recording && (
          <button className="cam__round" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} aria-label={t("flipCamera")}>
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
