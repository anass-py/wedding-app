import { useEffect, useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from "react";
import { WEDDING } from "../config";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import type { Api, Photo } from "../lib/types";
import { formatDuration } from "../lib/video";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface Props {
  photo: Photo;
  /** The list to swipe through (the photo must be in it). */
  photos: Photo[];
  api: Api;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onHeart: (photo: Photo) => void;
  onDelete: (photo: Photo) => Promise<void>;
}

const SWIPE_PX = 70;
const CLOSE_PX = 110;

export function PhotoDetail({ photo, photos, api, onClose, onNavigate, onHeart, onDelete }: Props) {
  const { t, themeName } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [burst, setBurst] = useState<{ photoId: string; n: number } | null>(null);
  const [flash, setFlash] = useState<{ photoId: string; n: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const lastTap = useRef(0);
  const slideRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const index = photos.findIndex((p) => p.id === photo.id);
  const prev = index > 0 ? photos[index - 1] : null;
  const next = index >= 0 && index < photos.length - 1 ? photos[index + 1] : null;
  const mine = api.guest?.id === photo.guest_id;
  const fullUrl = api.urlFor(photo.path);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const go = (target: Photo | null, d: "left" | "right") => {
    if (!target) return;
    setDir(d);
    onNavigate(target.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(next, "left");
      if (e.key === "ArrowLeft") go(prev, "right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Preload neighbours so swiping feels instant.
  useEffect(() => {
    [prev, next].forEach((p) => {
      if (p) new Image().src = api.urlFor(p.path);
    });
  }, [prev, next, api]);

  const heart = () => {
    if (!photo.hearted) {
      setBurst((b) => ({ photoId: photo.id, n: (b?.n ?? 0) + 1 }));
      buzz();
    }
    onHeart(photo);
  };

  // Double-tap the photo to heart it (never un-hearts).
  const onImageClick = (e: RMouseEvent) => {
    e.stopPropagation();
    if (suppressClick.current || photo.kind === "video") return;
    const now = performance.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      setFlash((f) => ({ photoId: photo.id, n: (f?.n ?? 0) + 1 }));
      if (!photo.hearted) heart();
    } else {
      lastTap.current = now;
    }
  };

  const onPointerDown = (e: RPointerEvent) => {
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    if (slideRef.current) slideRef.current.style.transition = "none";
  };
  const onPointerMove = (e: RPointerEvent) => {
    const d = drag.current;
    const el = slideRef.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 8) d.moved = true;
    if (!d.moved) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      const resist = (dx < 0 && !next) || (dx > 0 && !prev) ? 0.35 : 0.95;
      el.style.transform = `translateX(${dx * resist}px)`;
      el.style.opacity = "1";
    } else if (dy > 0) {
      el.style.transform = `translateY(${dy}px) scale(${1 - Math.min(0.15, dy / 900)})`;
      el.style.opacity = String(1 - Math.min(0.5, dy / 500));
    }
  };
  const onPointerUp = (e: RPointerEvent) => {
    const d = drag.current;
    const el = slideRef.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved || !el) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 350);
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -SWIPE_PX && next) return go(next, "left");
      if (dx > SWIPE_PX && prev) return go(prev, "right");
    } else if (dy > CLOSE_PX) {
      return onClose();
    }
    el.style.transition = "transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.28s";
    el.style.transform = "";
    el.style.opacity = "";
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const blob = await (await fetch(fullUrl)).blob();
      const ext = photo.kind === "video" ? (photo.path.match(/\.(\w+)$/)?.[1] ?? "mp4") : "jpg";
      const name = `${WEDDING.couple.replace(/[^\p{L}\p{N}]+/gu, "-")}-${photo.id.slice(0, 8)}.${ext}`;
      const file = new File([blob], name, { type: blob.type || (photo.kind === "video" ? "video/mp4" : "image/jpeg") });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: WEDDING.couple });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
      }
    } catch {
      /* cancelled or blocked */
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: WEDDING.couple, text: `${photo.guest.name} · ${WEDDING.couple}`, url: fullUrl });
    } catch {
      /* cancelled */
    }
  };

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

  return (
    <div className="detail" role="dialog" aria-modal="true">
      <div className="detail__topbar">
        <span className="detail__counter">{index >= 0 ? `${index + 1} / ${photos.length}` : ""}</span>
        <button className="detail__close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div
        className="detail__stage"
        onClick={onClose}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={slideRef} key={photo.id} className={"detail__slide" + (dir ? ` detail__slide--${dir}` : "")}>
          {photo.kind === "video" ? (
            <video
              src={fullUrl}
              poster={api.urlFor(photo.thumb_path)}
              controls
              playsInline
              preload="metadata"
              onClick={(e) => e.stopPropagation()}
              style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
            />
          ) : (
            <img
              src={fullUrl}
              alt={photo.caption ?? ""}
              onClick={onImageClick}
              draggable={false}
              style={photo.width && photo.height ? { aspectRatio: `${photo.width} / ${photo.height}` } : undefined}
            />
          )}
          {flash?.photoId === photo.id && (
            <span key={flash.n} className="bigheart" aria-hidden="true">
              ♥
            </span>
          )}
        </div>
        {prev && <span className="detail__edge detail__edge--l" aria-hidden="true" />}
        {next && <span className="detail__edge detail__edge--r" aria-hidden="true" />}
      </div>
      <div className="detail__panel">
        <div className="detail__author">
          <Avatar guest={photo.guest} urlFor={api.urlFor} size={44} />
          <div className="detail__meta">
            <div className="detail__name">
              <span className="muted">{t("by")} </span>
              {photo.guest.name}
            </div>
            <div className="muted small">
              {relativeTime(photo.created_at, t)}
              {photo.kind === "video" && ` · ▶ ${formatDuration(photo.duration)}`}
            </div>
          </div>
          <button className={"heart" + (photo.hearted ? " heart--on" : "")} onClick={heart} aria-pressed={photo.hearted}>
            <span className="heart__icon">
              <Icon name="heart" size={22} fill={photo.hearted} strokeWidth={1.8} />
            </span>
            <span className="heart__count">{photo.hearts}</span>
            {burst?.photoId === photo.id && (
              <span key={burst.n} className="heart__burst" aria-hidden="true">
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
          {canShare && (
            <button className="pill" onClick={share}>
              <Icon name="share" size={16} /> {t("share")}
            </button>
          )}
          <button className="pill" onClick={save} disabled={saving}>
            <Icon name="download" size={16} /> {t("openFull")}
          </button>
          {mine && (
            <button className="pill pill--danger" onClick={remove} disabled={deleting}>
              <Icon name="trash" size={16} /> {t("delete")}
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
