import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { Api, Photo } from "../lib/types";

interface Props {
  api: Api;
  onClose: () => void;
  onUploaded: (photo: Photo) => void;
  onError: (msg: string) => void;
  onDone: (count: number) => void;
}

interface Picked {
  file: File;
  url: string;
}

export function UploadSheet({ api, onClose, onUploaded, onError, onDone }: Props) {
  const { t } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<{ i: number; n: number } | null>(null);

  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked]);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const next = Array.from(list)
      .filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name))
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPicked((prev) => [...prev, ...next]);
  };

  const removeAt = (i: number) => setPicked((prev) => prev.filter((_, j) => j !== i));

  const post = async () => {
    if (picked.length === 0 || progress) return;
    let ok = 0;
    for (let i = 0; i < picked.length; i++) {
      setProgress({ i: i + 1, n: picked.length });
      try {
        const photo = await api.uploadPhoto(picked[i].file, i === 0 ? caption : undefined);
        onUploaded(photo);
        ok++;
      } catch (e) {
        console.error(e);
        onError(t("uploadFailed"));
      }
    }
    setProgress(null);
    if (ok > 0) {
      onDone(ok);
      onClose();
    }
  };

  const postLabel = picked.length === 1 ? t("postOne") : t("postMany", { n: picked.length });

  return (
    <div className="sheet-backdrop" onClick={progress ? undefined : onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {picked.length === 0 ? (
          <div className="sheet__choices">
            <button className="bigbtn" onClick={() => cameraRef.current?.click()}>
              <span className="bigbtn__icon">📷</span>
              {t("takePhoto")}
            </button>
            <button className="bigbtn" onClick={() => galleryRef.current?.click()}>
              <span className="bigbtn__icon">🖼️</span>
              {t("fromGallery")}
            </button>
          </div>
        ) : (
          <>
            <div className="picked">
              {picked.map((p, i) => (
                <div key={p.url} className="picked__item">
                  <img src={p.url} alt="" />
                  {!progress && (
                    <button className="picked__remove" onClick={() => removeAt(i)} aria-label="Remove">
                      ✕
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
            <div className="sheet__actions">
              <button className="btn btn--ghost" onClick={onClose} disabled={!!progress}>
                {t("cancel")}
              </button>
              <button className="btn btn--primary" onClick={post} disabled={!!progress}>
                {progress ? t("posting", progress) : postLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
