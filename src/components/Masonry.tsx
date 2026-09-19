import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import type { Photo } from "../lib/types";
import { HeartRain } from "./HeartRain";
import { RoleBadge } from "./RoleBadge";
import { formatDuration } from "../lib/video";
import { buzz } from "../lib/haptics";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface Props {
  photos: Photo[];
  urlFor: (path: string) => string;
  onSelect: (photo: Photo) => void;
  /** Photo ids to mark with a gold star (the current top 5). */
  highlight?: Set<string>;
  /** Change this value to reveal held-back photos and scroll to the top. */
  resetKey?: number;
  /** A heart that just arrived from another guest; a ♥ floats up on that card. */
  pulse?: { key: number; photoId: string } | null;
  /** Double-tap on a card hearts it (never un-hearts). */
  onHeart?: (photo: Photo) => void;
  /** Rendered inside the scroll area above the columns (the guestbook strip on phones). */
  top?: ReactNode;
}

const DOUBLE_TAP_MS = 280;

const BATCH = 60;

const MIN_COLUMN_WIDTH = 180;
const MIN_RATIO = 0.65; // clamp very wide…
const MAX_RATIO = 1.5; // …and very tall photos so no card dominates the column

function ratio(p: Photo): number {
  const r = p.width && p.height ? p.height / p.width : 1;
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, r));
}

/** Greedy shortest-column packing, like Pinterest. Heights are in column-width units. */
function distribute(photos: Photo[], cols: number): Photo[][] {
  const columns: Photo[][] = Array.from({ length: cols }, () => []);
  const heights = new Array<number>(cols).fill(0);
  for (const p of photos) {
    let c = 0;
    for (let i = 1; i < cols; i++) if (heights[i] < heights[c] - 0.01) c = i;
    columns[c].push(p);
    heights[c] += ratio(p) + (p.caption ? 0.36 : 0.22);
  }
  return columns;
}

export function Masonry({
  photos,
  urlFor,
  onSelect,
  highlight,
  resetKey,
  pulse,
  onHeart,
  top,
}: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);

  // Photos arriving while the guest is scrolled down are held back behind a
  // "N new" pill, so the grid never jumps under their thumb.
  const [shownIds, setShownIds] = useState<Set<string> | null>(null);
  const shown = useMemo(
    () => (shownIds ? photos.filter((p) => shownIds.has(p.id)) : photos),
    [photos, shownIds],
  );
  const pending = photos.length - shown.length;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setCols(Math.max(2, Math.floor(el.clientWidth / MIN_COLUMN_WIDTH))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Freeze the visible set as soon as the user scrolls away from the top.
    const onScroll = () => {
      if (el.scrollTop > 120)
        setShownIds((s) => s ?? new Set(photos.map((p) => p.id)));
      else setShownIds(null);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [photos]);

  const reveal = () => {
    setShownIds(null);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (resetKey !== undefined) reveal();
  }, [resetKey]);

  // Cards that weren't on screen last render get an entrance animation; the
  // very first paint staggers them in.
  const known = useRef<Set<string> | null>(null);
  const firstPaint = known.current === null;
  const isNew = (id: string) => firstPaint || !known.current!.has(id);
  useEffect(() => {
    known.current = new Set(shown.map((p) => p.id));
  });

  // Render in batches: a sentinel at the bottom asks for more as you scroll.
  const [limit, setLimit] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver(
      (entries) => entries[0].isIntersecting && setLimit((l) => l + BATCH),
      { root, rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const visible = useMemo(() => shown.slice(0, limit), [shown, limit]);

  // Floating hearts from other guests' reactions.
  const [floats, setFloats] = useState<{ key: number; photoId: string }[]>([]);
  useEffect(() => {
    if (!pulse) return;
    setFloats((f) => [...f, pulse]);
    const id = window.setTimeout(
      () => setFloats((f) => f.filter((x) => x.key !== pulse.key)),
      1400,
    );
    return () => window.clearTimeout(id);
  }, [pulse]);

  // Single tap opens (after a short wait), double tap hearts with a big ♥ on the card.
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const pendingOpen = useRef(0);
  const [likeFlash, setLikeFlash] = useState<{
    photoId: string;
    key: number;
  } | null>(null);
  const onCardClick = (p: Photo) => {
    const now = performance.now();
    if (
      onHeart &&
      lastTap.current?.id === p.id &&
      now - lastTap.current.t < DOUBLE_TAP_MS
    ) {
      window.clearTimeout(pendingOpen.current);
      lastTap.current = null;
      setLikeFlash({ photoId: p.id, key: now });
      if (!p.hearted) {
        onHeart(p);
        buzz();
      }
      return;
    }
    lastTap.current = { id: p.id, t: now };
    window.clearTimeout(pendingOpen.current);
    pendingOpen.current = window.setTimeout(
      () => onSelect(p),
      onHeart ? DOUBLE_TAP_MS : 0,
    );
  };
  useEffect(() => () => window.clearTimeout(pendingOpen.current), []);

  const columns = useMemo(() => distribute(visible, cols), [visible, cols]);

  return (
    <div className="masonry-wrap">
      {pending > 0 && (
        <button className="newpill" onClick={reveal}>
          ↑ {t("newPhotos", { n: pending })}
        </button>
      )}
      <div ref={scrollRef} className="masonry">
        {top}
        <div className="masonry__cols">
          {columns.map((col, i) => (
            <div key={i} className="masonry__col">
              {col.map((it, j) => (
                <button
                  key={it.id}
                  className={"card" + (isNew(it.id) ? " card--new" : "")}
                  style={
                    firstPaint
                      ? { animationDelay: `${Math.min(j, 8) * 70 + i * 35}ms` }
                      : undefined
                  }
                  onClick={() => onCardClick(it)}
                >
                  <span
                    className="card__img"
                    style={{ aspectRatio: `1 / ${ratio(it)}` }}
                  >
                    {it.kind === "video" ? (
                      <AutoVideo
                        src={urlFor(it.path)}
                        poster={urlFor(it.thumb_path)}
                      />
                    ) : (
                      <FadeImg
                        src={urlFor(it.thumb_path)}
                        alt={it.caption ?? ""}
                      />
                    )}
                    {it.kind === "video" && (
                      <span className="card__video">
                        <Icon name="play" size={11} fill strokeWidth={0} />{" "}
                        {formatDuration(it.duration)}
                      </span>
                    )}
                    <HeartRain count={it.hearts} id={it.id} />
                    {highlight?.has(it.id) && (
                      <span className="card__star">
                        <Icon name="star" size={13} fill strokeWidth={0} />
                      </span>
                    )}
                    {floats
                      .filter((f) => f.photoId === it.id)
                      .map((f) => (
                        <span
                          key={f.key}
                          className="floatheart"
                          aria-hidden="true"
                        >
                          ♥
                        </span>
                      ))}
                    {likeFlash?.photoId === it.id && (
                      <span
                        key={likeFlash.key}
                        className="bigheart bigheart--card"
                        aria-hidden="true"
                      >
                        ♥
                      </span>
                    )}
                  </span>
                  {it.caption && (
                    <span className="card__caption">{it.caption}</span>
                  )}
                  <span className="card__foot">
                    <Avatar guest={it.guest} urlFor={urlFor} size={20} />
                    <span className="card__name">
                      {it.guest.name}
                      <RoleBadge name={it.guest.name} size={12} />
                    </span>
                    {it.hearts > 0 && (
                      <span
                        className={
                          "card__hearts" +
                          (it.hearted ? " card__hearts--on" : "")
                        }
                      >
                        <Icon name="heart" size={12} fill={it.hearted} />{" "}
                        {it.hearts}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div ref={sentinelRef} className="masonry__sentinel" />
      </div>
    </div>
  );
}

/** Muted, looping video that plays only while mostly on screen — like Shorts/Reels in a feed. */
function AutoVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6)
          el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.pause();
    };
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      playsInline
      loop
      preload="metadata"
      className="loaded"
    />
  );
}

/** Image that fades in once decoded (also when it comes straight from cache). */
export function FadeImg({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={loaded ? "loaded" : undefined}
      onLoad={() => setLoaded(true)}
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0) setLoaded(true);
      }}
    />
  );
}
