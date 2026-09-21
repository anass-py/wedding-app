import { useEffect, useRef, useState } from "react";
import { MEDIA } from "../config";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import { describeError } from "../lib/errors";
import { ImageError } from "../lib/image";
import { parseTrendUrl } from "../lib/trends";
import type { Api, Message, Photo, Trend } from "../lib/types";
import { VideoError, isVideoFile } from "../lib/video";
import { Camera, isCameraSupported } from "./Camera";
import { Icon } from "./Icon";

interface Props {
  api: Api;
  onClose: () => void;
  onError: (msg: string) => void;
  /** Called once with every photo/video that made it. */
  onDone: (photos: Photo[]) => void;
  onMessage: (message: Message) => void;
  onTrend: (trend: Trend) => void;
}

interface Picked {
  file: File;
  url: string;
  video: boolean;
}

export function UploadSheet({ api, onClose, onError, onDone, onMessage, onTrend }: Props) {
  const { t } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<{ i: number; n: number; p: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [trending, setTrending] = useState(false);
  const [trendUrl, setTrendUrl] = useState("");
  const [trendNote, setTrendNote] = useState("");
  const parsedTrend = parseTrendUrl(trendUrl);

  const sendTrend = async () => {
    if (!parsedTrend || sendingMsg) return;
    setSendingMsg(true);
    try {
      const tr = await api.postTrend({ ...parsedTrend, note: trendNote });
      buzz([10, 40, 20]);
      onTrend(tr);
      onClose();
    } catch (e) {
      onError(explain(e));
      setSendingMsg(false);
    }
  };

  const sendMessage = async () => {
    if (!text.trim() || sendingMsg) return;
    setSendingMsg(true);
    try {
      const m = await api.postMessage(text);
      buzz([10, 40, 20]);
      onMessage(m);
      onClose();
    } catch (e) {
      onError(explain(e));
      setSendingMsg(false);
    }
  };
  const inAppCamera = isCameraSupported();

  // Revoke preview URLs only when the sheet goes away (or an item is removed), never on every change.
  const urls = useRef<Set<string>>(new Set());
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/") || isVideoFile(f) || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))
      .map((file) => ({ file, url: URL.createObjectURL(file), video: isVideoFile(file) }));
    next.forEach((p) => urls.current.add(p.url));
    setPicked((prev) => [...prev, ...next]);
  };

  const removeAt = (i: number) =>
    setPicked((prev) => {
      const gone = prev[i];
      if (gone) {
        URL.revokeObjectURL(gone.url);
        urls.current.delete(gone.url);
      }
      return prev.filter((_, j) => j !== i);
    });

  const explain = (e: unknown): string => {
    if (e instanceof ImageError) return t("unsupportedImage");
    if (e instanceof VideoError) {
      if (e.code === "too-large") return t("videoTooLarge", { mb: MEDIA.MAX_VIDEO_MB });
      if (e.code === "too-long") return t("videoTooLong", { s: MEDIA.MAX_VIDEO_SECONDS });
      return t("unsupportedVideo");
    }
    return `${t("uploadFailed")} (${describeError(e)})`;
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

        {trending ? (
          <div className="compose">
            <p className="compose__to">{t("addTrend")}</p>
            <input
              className="input"
              value={trendUrl}
              placeholder={t("trendUrlPlaceholder")}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              onChange={(e) => setTrendUrl(e.target.value)}
            />
            {trendUrl.trim() && !parsedTrend && <p className="error" style={{ margin: 0, fontSize: 13 }}>{t("trendInvalidUrl")}</p>}
            <input className="input" value={trendNote} placeholder={t("trendNotePlaceholder")} maxLength={200} onChange={(e) => setTrendNote(e.target.value)} />
            <div className="sheet__actions">
              <button className="btn btn--ghost" onClick={() => setTrending(false)} disabled={sendingMsg}>
                {t("cancel")}
              </button>
              <button className="btn btn--primary" onClick={sendTrend} disabled={!parsedTrend || sendingMsg}>
                {sendingMsg ? t("sending") : t("send")}
              </button>
            </div>
          </div>
        ) : writing ? (
          <div className="compose">
            <p className="compose__to">{t("composeTitle")}</p>
            <textarea
              className="input compose__text"
              value={text}
              placeholder={t("messagePlaceholder")}
              maxLength={280}
              rows={4}
              autoFocus
              onChange={(e) => setText(e.target.value)}
            />
            <div className="compose__meta muted small">{text.length} / 280</div>
            <div className="sheet__actions">
              <button className="btn btn--ghost" onClick={() => setWriting(false)} disabled={sendingMsg}>
                {t("cancel")}
              </button>
              <button className="btn btn--primary" onClick={sendMessage} disabled={!text.trim() || sendingMsg}>
                {sendingMsg ? t("sending") : t("send")}
              </button>
            </div>
          </div>
        ) : picked.length === 0 ? (
          <div className="sheet__choices">
            {inAppCamera ? (
              <button className="bigbtn" onClick={() => setCameraOpen(true)}>
                <span className="bigbtn__icon">
                  <Icon name="camera" size={24} />
                </span>
                {t("camera")}
              </button>
            ) : (
              <>
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
              </>
            )}
            <button className="bigbtn" onClick={() => galleryRef.current?.click()}>
              <span className="bigbtn__icon">
                <Icon name="image" size={24} />
              </span>
              {t("fromGallery")}
            </button>
            <button className="bigbtn" onClick={() => setWriting(true)}>
              <span className="bigbtn__icon">
                <Icon name="quill" size={24} />
              </span>
              {t("writeMessage")}
            </button>
            <button className="bigbtn" onClick={() => setTrending(true)}>
              <span className="bigbtn__icon">
                <Icon name="reel" size={24} />
              </span>
              {t("addTrend")}
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
                <button className="picked__add" onClick={() => (inAppCamera ? setCameraOpen(true) : galleryRef.current?.click())}>
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
      {cameraOpen && (
        <Camera
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            const url = URL.createObjectURL(file);
            urls.current.add(url);
            setPicked((prev) => [...prev, { file, url, video: isVideoFile(file) }]);
            setCameraOpen(false);
          }}
        />
      )}
    </div>
  );
}
