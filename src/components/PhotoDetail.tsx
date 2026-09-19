import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { WEDDING } from "../config";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import type { Api, Photo } from "../lib/types";
import { formatDuration } from "../lib/video";
import { Avatar } from "./Avatar";
import { RoleBadge } from "./RoleBadge";
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
  onOpenGuest: (guest: Photo["guest"]) => void;
  onToast?: (msg: string) => void;
}

const SWIPE_PX = 70;
const CLOSE_PX = 120;
const TAP_SLOP = 8;
const DOUBLE_TAP_MS = 320;

interface Pt {
  x: number;
  y: number;
}

/**
 * Full-screen immersive viewer: media edge to edge over a blurred backdrop, info
 * overlaid. Swipe ←/→ between items, swipe ↓ to close, tap = play/pause (video) or
 * hide/show the overlay (photo), double-tap = ❤️, pinch = zoom (photo).
 */
export function PhotoDetail({ photo, photos, api, onClose, onNavigate, onHeart, onDelete, onOpenGuest, onToast }: Props) {
  const { t } = useI18n();
  const [deleting, setDeleting] = useState(false);
  const [likeAnim, setLikeAnim] = useState<{ photoId: string; n: number } | null>(null);
  const [flash, setFlash] = useState<{ photoId: string; n: number } | null>(null);
  const [playFlash, setPlayFlash] = useState<{ n: number; playing: boolean } | null>(null);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [soundHint, setSoundHint] = useState(false);
  const [fill, setFill] = useState(true); // portrait media fills the screen; ⤢ shows the whole frame

  const slideRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ x: number; y: number; moved: boolean; pinched: boolean } | null>(null);
  const pinch = useRef<{ d0: number; mid: Pt } | null>(null);
  const lastTap = useRef(0);
  const singleTap = useRef(0);

  const index = photos.findIndex((p) => p.id === photo.id);
  const prev = index > 0 ? photos[index - 1] : null;
  const next = index >= 0 && index < photos.length - 1 ? photos[index + 1] : null;
  const mine = api.guest?.id === photo.guest_id;
  const isVideo = photo.kind === "video";
  const portrait = photo.width && photo.height ? photo.height / photo.width >= 1.15 : true;
  const cover = portrait && fill;
  const fullUrl = api.urlFor(photo.path);
  const thumbUrl = api.urlFor(photo.thumb_path);

  const go = useCallback(
    (target: Photo | null, d: "left" | "right") => {
      if (!target) return;
      setDir(d);
      onNavigate(target.id);
    },
    [onNavigate],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(next, "left");
      if (e.key === "ArrowLeft") go(prev, "right");
      if (e.key === " " && isVideo) {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Preload neighbours so swiping feels instant.
  useEffect(() => {
    [prev, next].forEach((p) => {
      if (p && p.kind === "photo") new Image().src = api.urlFor(p.path);
    });
  }, [prev, next, api]);

  // Videos start right away with sound — synchronously after the tap so iOS still counts the gesture;
  // if the browser refuses, fall back to muted + a hint.
  useLayoutEffect(() => {
    setPaused(false);
    setProgress(0);
    const v = videoRef.current;
    if (!v || !isVideo) return;
    v.muted = muted;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      setSoundHint(true);
      v.play().catch(() => setPaused(true));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo.id, isVideo]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
      setPlayFlash({ n: performance.now(), playing: true });
    } else {
      v.pause();
      setPaused(true);
      setPlayFlash({ n: performance.now(), playing: false });
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    const m = !muted;
    setMuted(m);
    setSoundHint(false);
    if (v) {
      v.muted = m;
      if (!m && v.paused) void v.play();
    }
  };

  const heart = () => {
    if (!photo.hearted) {
      setLikeAnim((a) => ({ photoId: photo.id, n: (a?.n ?? 0) + 1 }));
      buzz();
    }
    onHeart(photo);
  };

  const onDoubleTap = () => {
    setFlash((f) => ({ photoId: photo.id, n: (f?.n ?? 0) + 1 }));
    if (!photo.hearted) heart();
  };
  const onSingleTap = () => {
    if (isVideo) togglePlay();
    else setImmersive((i) => !i);
  };

  // ── Gestures: swipe, pinch, tap / double-tap ──────────────────────────────
  const setMediaTransform = (s: string, animate: boolean) => {
    const el = mediaRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)" : "none";
    el.style.transform = s;
  };

  const onPointerDown = (e: RPointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-captured pointer */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && !isVideo) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      if (gesture.current) gesture.current.pinched = true;
      if (slideRef.current) {
        slideRef.current.style.transform = "";
        slideRef.current.style.opacity = "";
      }
      return;
    }
    if (pointers.current.size === 1) {
      gesture.current = { x: e.clientX, y: e.clientY, moved: false, pinched: false };
      if (slideRef.current) slideRef.current.style.transition = "none";
    }
  };

  const onPointerMove = (e: RPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = Math.min(4, Math.max(1, d / pinch.current.d0));
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const rect = mediaRef.current?.getBoundingClientRect();
      const ox = rect ? pinch.current.mid.x - (rect.left + rect.width / 2) : 0;
      const oy = rect ? pinch.current.mid.y - (rect.top + rect.height / 2) : 0;
      const tx = mid.x - pinch.current.mid.x - ox * (scale - 1);
      const ty = mid.y - pinch.current.mid.y - oy * (scale - 1);
      setMediaTransform(`translate(${tx}px, ${ty}px) scale(${scale})`, false);
      return;
    }
    const g = gesture.current;
    const el = slideRef.current;
    if (!g || !el || g.pinched) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;
    if (!g.moved) return;
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
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    if (pinch.current && pointers.current.size < 2) {
      pinch.current = null;
      setMediaTransform("", true);
    }
    if (pointers.current.size > 0) return;
    const g = gesture.current;
    gesture.current = null;
    const el = slideRef.current;
    if (!g || !el) return;
    if (g.pinched) return;
    if (!g.moved) {
      const now = performance.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        window.clearTimeout(singleTap.current);
        onDoubleTap();
      } else {
        lastTap.current = now;
        window.clearTimeout(singleTap.current);
        singleTap.current = window.setTimeout(onSingleTap, DOUBLE_TAP_MS);
      }
      return;
    }
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
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

  useEffect(() => () => window.clearTimeout(singleTap.current), []);

  // ── Actions ───────────────────────────────────────────────────────────────
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
    <div className={"viewer" + (immersive ? " viewer--immersive" : "")} role="dialog" aria-modal="true">
      <div key={"bg" + photo.id} className="viewer__bg" style={{ backgroundImage: `url(${thumbUrl})` }} />

      <div
        className="viewer__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div ref={slideRef} key={photo.id} className={"viewer__slide" + (dir ? ` viewer__slide--${dir}` : "")}>
          <div ref={mediaRef} className={"viewer__media" + (cover ? " viewer__media--cover" : "")}>
            {isVideo ? (
              <video
                ref={videoRef}
                src={fullUrl}
                poster={thumbUrl}
                autoPlay
                loop
                playsInline
                muted={muted}
                preload="auto"
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress(v.currentTime / v.duration);
                }}
                onPlay={() => setPaused(false)}
                onPause={() => setPaused(true)}
              />
            ) : (
              <img src={fullUrl} alt={photo.caption ?? ""} draggable={false} />
            )}
          </div>
          {flash?.photoId === photo.id && (
            <span key={flash.n} className="bigheart" aria-hidden="true">
              ♥
            </span>
          )}
          {playFlash && (
            <span key={playFlash.n} className="playflash" aria-hidden="true">
              <Icon name={playFlash.playing ? "play" : "pause"} size={36} fill strokeWidth={0} />
            </span>
          )}
          {isVideo && paused && !playFlash && (
            <span className="viewer__paused" aria-hidden="true">
              <Icon name="play" size={36} fill strokeWidth={0} />
            </span>
          )}
        </div>
      </div>

      <div className="viewer__top">
        <span className="viewer__counter">{index >= 0 ? `${index + 1} / ${photos.length}` : ""}</span>
        <button className="viewer__round" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
      </div>

      <button
        className={"like" + (photo.hearted ? " like--on" : "") + (likeAnim?.photoId === photo.id ? " like--pop" : "")}
        onClick={heart}
        aria-pressed={photo.hearted}
        aria-label={t("hearts")}
      >
        <span key={likeAnim?.n ?? 0} className="like__icon">
          <Icon name="heart" size={32} fill={photo.hearted} strokeWidth={1.6} />
        </span>
        <span className="like__count">{photo.hearts > 0 ? photo.hearts : ""}</span>
      </button>

      <div className="viewer__bar">
        <div className="viewer__author">
          <button className="viewer__who" onClick={() => onOpenGuest(photo.guest)} aria-label={photo.guest.name}>
            <Avatar guest={photo.guest} urlFor={api.urlFor} size={40} />
            <span className="viewer__meta">
              <span className="viewer__name">
                {photo.guest.name}
                <RoleBadge name={photo.guest.name} size={16} />
              </span>
              <span className="viewer__time">
                {relativeTime(photo.created_at, t)}
                {isVideo && ` · ${formatDuration(photo.duration)}`}
                {photo.score && ` · ★ ${photo.score.score.toFixed(1)}`}
              </span>
            </span>
          </button>
          <div className="viewer__tools">
            {isVideo && (
              <button className="tool" onClick={toggleMute} aria-label={muted ? t("unmute") : t("mute")}>
                <Icon name={muted ? "muted" : "sound"} size={22} />
              </button>
            )}
            {portrait && (
              <button className={"tool" + (fill ? "" : " tool--on")} onClick={() => setFill((f) => !f)} aria-label={t("fit")}>
                <Icon name={fill ? "fit" : "fill"} size={20} />
              </button>
            )}
            {mine && (
              <button className="tool tool--danger" onClick={remove} disabled={deleting} aria-label={t("delete")}>
                <Icon name="trash" size={21} />
              </button>
            )}
          </div>
        </div>
        {photo.caption && <p className="viewer__caption">{photo.caption}</p>}
        {soundHint && !immersive && <div className="viewer__hint">{t("tapForSound")}</div>}
      </div>

      {isVideo && (
        <div className="viewer__progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {prev && <span className="viewer__edge viewer__edge--l" aria-hidden="true" />}
      {next && <span className="viewer__edge viewer__edge--r" aria-hidden="true" />}
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
