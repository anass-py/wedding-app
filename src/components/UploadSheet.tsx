import { useEffect, useRef, useState } from "react";
import { MEDIA } from "../config";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import { ImageError } from "../lib/image";
import type { Api, Photo } from "../lib/types";
import { VideoError, isVideoFile } from "../lib/video";
import { Icon } from "./Icon";

interface Props {
  api: Api;
  onClose: () => void;
  onError: (msg: string) => void;
  /** Called once with every photo/video that made it. */
  onDone: (photos: Photo[]) => void;
}

interface Picked {
  file: File;
  url: string;
  video: boolean;
}

/** Supabase throws plain objects ({ message, statusCode… }), not Error instances. */
function describe(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export function UploadSheet({ api, onClose, onError, onDone }: Props) {
  const { t } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<{ i: number; n: number; p: number } | null>(null);

  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/") || isVideoFile(f) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))
      .map((file) => ({ file, url: URL.createObjectURL(file), video: isVideoFile(file) }));
    setPicked((prev) => [...prev, ...next]);
  };

  const removeAt = (i: number) => setPicked((prev) => prev.filter((_, j) => j !== i));

  const explain = (e: unknown): string => {
    if (e instanceof ImageError) return t("unsupportedImage");
    if (e instanceof VideoError) {
      if (e.code === "too-large") return t("videoTooLarge", { mb: MEDIA.MAX_VIDEO_MB });
      if (e.code === "too-long") return t("videoTooLong", { s: MEDIA.MAX_VIDEO_SECONDS });
      return t("unsupportedVideo");
    }
    return `${t("uploadFailed")} (${describe(e)})`;
  };

  const post = async () => {
    if (picked.length === 0 || progress) return;
    const done: Photo[] = [];
    for (let i = 0; i < picked.length; i++) {
      setProgress({ i: i + 1, n: picked.length, p: 0 });
      try {
        done.push(
          await api.uploadMedia(picked[i].file, i === 0 ? caption : undefined, (f) =>
            setProgress({ i: i + 1, n: picked.length, p: f }),
          ),
        );
      } catch (e) {
        console.error(e);
        onError(explain(e));
      }
    }
    setProgress(null);
    if (done.length > 0) {
      buzz([10, 40, 20]);
      onDone(done);
      onClose();
    }
  };

  const postLabel = picked.length === 1 ? t("postOne") : t("postMany", { n: picked.length });
  const overall = progress ? (progress.i - 1 + progress.p) / progress.n : 0;

  return (
    <div className="sheet-backdrop" onClick={progress ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={videoRef} type="file" accept="video/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <input ref={galleryRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />

        {picked.length === 0 ? (
          <div className="sheet__choices">
            <button className="bigbtn" onClick={() => cameraRef.current?.click()}>
              <span className="bigbtn__icon">
                <Icon name="camera" size={24} />
              </span>
              {t("takePhoto")}
            </button>
            <button className="bigbtn" onClick={() => videoRef.current?.click()}>
              <span className="bigbtn__icon">
                <Icon name="video" size={24} />
              </span>
              <span className="bigbtn__text">
                {t("recordVideo")}
                <span className="bigbtn__hint">{t("videoHint", { s: MEDIA.MAX_VIDEO_SECONDS, mb: MEDIA.MAX_VIDEO_MB })}</span>
              </span>
            </button>
            <button className="bigbtn" onClick={() => galleryRef.current?.click()}>
              <span className="bigbtn__icon">
                <Icon name="image" size={24} />
              </span>
              {t("fromGallery")}
            </button>
          </div>
        ) : (
          <>
            <div className="picked">
              {picked.map((p, i) => (
                <div key={p.url} className="picked__item">
                  {p.video ? (
                    <>
                      <video src={`${p.url}#t=0.1`} muted playsInline preload="metadata" />
                      <span className="picked__play">
                        <Icon name="play" size={14} fill strokeWidth={0} />
                      </span>
                    </>
                  ) : (
                    <img src={p.url} alt="" />
                  )}
                  {!progress && (
                    <button className="picked__remove" onClick={() => removeAt(i)} aria-label="Remove">
                      <Icon name="close" size={12} strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              ))}
              {!progress && (
                <button className="picked__add" onClick={() => galleryRef.current?.click()}>
                  + {t("addMore")}
                </button>
              )}
            </div>
            <input
              className="input"
              placeholder={`${t("caption")} (${t("optional")})`}
              value={caption}
              maxLength={200}
              onChange={(e) => setCaption(e.target.value)}
              disabled={!!progress}
            />
            {progress && (
              <div className="progress" aria-hidden="true">
                <span style={{ width: `${Math.max(3, overall * 100)}%` }} />
              </div>
            )}
            <div className="sheet__actions">
              <button className="btn btn--ghost" onClick={onClose} disabled={!!progress}>
                {t("cancel")}
              </button>
              <button className="btn btn--primary" onClick={post} disabled={!!progress}>
                {progress ? t("posting", { i: progress.i, n: progress.n, p: Math.round(progress.p * 100) }) : postLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
