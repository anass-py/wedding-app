import { useEffect, useRef, useState, type MouseEvent as RMouseEvent } from "react";
import { buzz } from "../lib/haptics";
import { useI18n } from "../i18n";
import type { Api, Photo } from "../lib/types";
import { Avatar } from "./Avatar";

interface Props {
  photo: Photo;
  api: Api;
  onClose: () => void;
  onHeart: (photo: Photo) => void;
  onDelete: (photo: Photo) => Promise<void>;
}

export function PhotoDetail({ photo, api, onClose, onHeart, onDelete }: Props) {
  const { t, themeName } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [burst, setBurst] = useState(0);
  const [flash, setFlash] = useState(0);
  const lastTap = useRef(0);
  const mine = api.guest?.id === photo.guest_id;

  const heart = () => {
    if (!photo.hearted) {
      setBurst((b) => b + 1);
      buzz();
    }
    onHeart(photo);
  };

  // Double-tap the photo to heart it (never un-hearts).
  const onImageClick = (e: RMouseEvent) => {
    e.stopPropagation();
    const now = performance.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setFlash((f) => f + 1);
      if (!photo.hearted) heart();
    } else {
      lastTap.current = now;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const remove = async () => {
    if (!window.confirm(t("confirmDelete"))) return;
    setDeleting(true);
    try {
      await onDelete(photo);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const fullUrl = api.urlFor(photo.path);

  return (
    <div className="detail" role="dialog" aria-modal="true">
      <button className="detail__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
      <div className="detail__stage" onClick={onClose}>
        <img
          src={fullUrl}
          alt={photo.caption ?? ""}
          onClick={onImageClick}
          draggable={false}
          style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
        />
        {flash > 0 && (
          <span key={flash} className="bigheart" aria-hidden="true">
            ♥
          </span>
        )}
      </div>
      <div className="detail__panel">
        <div className="detail__author">
          <Avatar guest={photo.guest} urlFor={api.urlFor} size={44} />
          <div className="detail__meta">
            <div className="detail__name">
              <span className="muted">{t("by")} </span>
              {photo.guest.name}
            </div>
            <div className="muted small">{relativeTime(photo.created_at, t)}</div>
          </div>
          <button className={"heart" + (photo.hearted ? " heart--on" : "")} onClick={heart} aria-pressed={photo.hearted}>
            <span className="heart__icon">{photo.hearted ? "♥" : "♡"}</span>
            <span className="heart__count">{photo.hearts}</span>
            {burst > 0 && (
              <span key={burst} className="heart__burst" aria-hidden="true">
                {Array.from({ length: 7 }, (_, i) => (
                  <i key={i} style={{ ["--a" as string]: `${-100 + i * 33}deg` }}>
                    ♥
                  </i>
                ))}
              </span>
            )}
          </button>
        </div>
        {photo.caption && <p className="detail__caption">{photo.caption}</p>}
        {photo.score && (
          <div className="chips">
            <span className="chip chip--gold">
              ★ {photo.score.score.toFixed(1)} · {themeName(photo.score.theme)}
            </span>
            {photo.score.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="detail__actions">
          <a className="link" href={fullUrl} target="_blank" rel="noreferrer">
            {t("openFull")} ↗
          </a>
          {mine && (
            <button className="link link--danger" onClick={remove} disabled={deleting}>
              {t("delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function relativeTime(iso: string, t: ReturnType<typeof useI18n>["t"]): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return t("justNow");
  if (min < 60) return t("minutesAgo", { n: min });
  const h = Math.round(min / 60);
  if (h < 24) return t("hoursAgo", { n: h });
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
