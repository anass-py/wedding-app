import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import type { Photo } from "../lib/types";
import { formatDuration } from "../lib/video";
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
}

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

export function Masonry({ photos, urlFor, onSelect, highlight, resetKey, pulse }: Props) {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(2);

  // Photos arriving while the guest is scrolled down are held back behind a
  // "N new" pill, so the grid never jumps under their thumb.
  const [shownIds, setShownIds] = useState<Set<string> | null>(null);
  const shown = useMemo(() => (shownIds ? photos.filter((p) => shownIds.has(p.id)) : photos), [photos, shownIds]);
  const pending = photos.length - shown.length;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCols(Math.max(2, Math.floor(el.clientWidth / MIN_COLUMN_WIDTH))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Freeze the visible set as soon as the user scrolls away from the top.
    const onScroll = () => {
      if (el.scrollTop > 120) setShownIds((s) => s ?? new Set(photos.map((p) => p.id)));
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
    const id = window.setTimeout(() => setFloats((f) => f.filter((x) => x.key !== pulse.key)), 1400);
    return () => window.clearTimeout(id);
  }, [pulse]);

  const columns = useMemo(() => distribute(visible, cols), [visible, cols]);

  return (
    <div className="masonry-wrap">
      {pending > 0 && (
        <button className="newpill" onClick={reveal}>
          ↑ {t("newPhotos", { n: pending })}
        </button>
      )}
      <div ref={scrollRef} className="masonry">
        {columns.map((col, i) => (
          <div key={i} className="masonry__col">
            {col.map((p, j) => (
              <button
                key={p.id}
                className={"card" + (isNew(p.id) ? " card--new" : "")}
                style={firstPaint ? { animationDelay: `${Math.min(j, 8) * 70 + i * 35}ms` } : undefined}
                onClick={() => onSelect(p)}
              >
                <span className="card__img" style={{ aspectRatio: `1 / ${ratio(p)}` }}>
                  <FadeImg src={urlFor(p.thumb_path)} alt={p.caption ?? ""} />
                  {p.kind === "video" && (
                    <span className="card__video">
                      <Icon name="play" size={11} fill strokeWidth={0} /> {formatDuration(p.duration)}
                    </span>
                  )}
                  {highlight?.has(p.id) && (
                    <span className="card__star">
                      <Icon name="star" size={13} fill strokeWidth={0} />
                    </span>
                  )}
                  {floats
                    .filter((f) => f.photoId === p.id)
                    .map((f) => (
                      <span key={f.key} className="floatheart" aria-hidden="true">
                        ♥
                      </span>
                    ))}
                </span>
                {p.caption && <span className="card__caption">{p.caption}</span>}
                <span className="card__foot">
                  <Avatar guest={p.guest} urlFor={urlFor} size={20} />
                  <span className="card__name">{p.guest.name}</span>
                  {p.hearts > 0 && (
                    <span className={"card__hearts" + (p.hearted ? " card__hearts--on" : "")}>
                      <Icon name="heart" size={12} fill={p.hearted} /> {p.hearts}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        ))}
        <div ref={sentinelRef} className="masonry__sentinel" />
      </div>
    </div>
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
