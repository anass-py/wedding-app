import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type PointerEvent as RPointerEvent, type WheelEvent as RWheelEvent } from "react";
import type { Photo } from "../lib/types";

interface Props {
  photos: Photo[];
  urlFor: (path: string) => string;
  onSelect: (photo: Photo) => void;
  /** Photo ids to draw with a gold ring (e.g. the current top 5). */
  highlight?: Set<string>;
}

interface Cell {
  x: number;
  y: number;
}

/**
 * Hex spiral: index 0 in the centre, then ring 1 (6 cells), ring 2 (12), …
 * Returns positions in "pitch units" (distance between neighbouring centres = 1).
 */
function spiral(n: number): Cell[] {
  const cells: Cell[] = [];
  if (n === 0) return cells;
  const toXY = (q: number, r: number): Cell => ({ x: q + r / 2, y: (Math.sqrt(3) / 2) * r });
  cells.push(toXY(0, 0));
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [0, -1],
    [1, -1],
  ];
  for (let k = 1; cells.length < n; k++) {
    let q = 0;
    let r = -k; // start at dirs[4] * k
    for (let side = 0; side < 6 && cells.length < n; side++) {
      for (let step = 0; step < k && cells.length < n; step++) {
        cells.push(toXY(q, r));
        q += dirs[side][0];
        r += dirs[side][1];
      }
    }
  }
  return cells;
}

const TAP_SLOP = 8;
const TAP_MS = 450;
const FRICTION = 0.93;
const MAX_VELOCITY = 2.5; // px per ms

export function Honeycomb({ photos, urlFor, onSelect, highlight }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bubbles = useRef(new Map<string, HTMLDivElement>());
  const pan = useRef({ x: 0, y: 0 });
  const vel = useRef({ x: 0, y: 0 });
  const raf = useRef(0);
  const inertia = useRef(0);
  const drag = useRef<{
    id: number;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    lastT: number;
    startT: number;
    moved: boolean;
    target: Photo | null;
  } | null>(null);

  const cells = useMemo(() => spiral(photos.length), [photos.length]);
  const rings = useMemo(() => {
    // radius of the outermost ring, for pan clamping
    let k = 0;
    let cap = 1;
    while (cap < photos.length) cap += 6 * ++k;
    return k;
  }, [photos.length]);

  const bubbleSize = useBubbleSize();
  const pitch = bubbleSize + 6;

  const apply = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const vw = root.clientWidth;
    const vh = root.clientHeight;
    const R = Math.hypot(vw, vh) / 2;
    const { x: px, y: py } = pan.current;
    for (let i = 0; i < photos.length; i++) {
      const el = bubbles.current.get(photos[i].id);
      if (!el) continue;
      const c = cells[i];
      const dx = c.x * pitch + px;
      const dy = c.y * pitch + py;
      const t = Math.min(1, Math.hypot(dx, dy) / R);
      // Full size near the middle, then a smooth fall-off toward the edges.
      const s = t < 0.22 ? 1 : Math.max(0.15, 1 - Math.pow((t - 0.22) / 0.78, 1.35) * 0.92);
      // Fisheye pull: small bubbles cluster toward the centre like on the watch.
      const pull = (1 - s) * 0.35;
      const x = dx - dx * pull;
      const y = dy - dy * pull;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      el.style.opacity = s < 0.22 ? "0" : "1";
      el.style.zIndex = String(Math.round(s * 100));
    }
  }, [photos, cells, pitch]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(apply);
  }, [apply]);

  // Radial clamp: you can bring the outermost ring to the centre, never further.
  const clampPan = useCallback(() => {
    const limit = rings * pitch + pitch * 0.5;
    const d = Math.hypot(pan.current.x, pan.current.y);
    if (d > limit) {
      pan.current.x *= limit / d;
      pan.current.y *= limit / d;
      vel.current = { x: 0, y: 0 };
    }
  }, [rings, pitch]);

  // Layout on mount / data change, with a short settle animation.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.classList.add("settling");
    clampPan();
    apply();
    const id = window.setTimeout(() => root.classList.remove("settling"), 500);
    return () => window.clearTimeout(id);
  }, [apply, clampPan]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    return () => ro.disconnect();
  }, [schedule]);

  useEffect(() => () => cancelAnimationFrame(inertia.current), []);

  const stopInertia = () => cancelAnimationFrame(inertia.current);

  const startInertia = useCallback(() => {
    stopInertia();
    const tick = () => {
      pan.current.x += vel.current.x * 16;
      pan.current.y += vel.current.y * 16;
      vel.current.x *= FRICTION;
      vel.current.y *= FRICTION;
      clampPan();
      apply();
      if (Math.hypot(vel.current.x, vel.current.y) > 0.02) inertia.current = requestAnimationFrame(tick);
    };
    inertia.current = requestAnimationFrame(tick);
  }, [apply, clampPan]);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    if (drag.current) return;
    stopInertia();
    rootRef.current?.classList.remove("settling");
    const el = (e.target as Element).closest<HTMLElement>("[data-id]");
    const target = el ? (photos.find((p) => p.id === el.dataset.id) ?? null) : null;
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: e.timeStamp,
      startT: e.timeStamp,
      moved: false,
      target,
    };
    vel.current = { x: 0, y: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > TAP_SLOP) d.moved = true;
    pan.current.x += dx;
    pan.current.y += dy;
    // Low-pass filter the velocity so a jittery finger doesn't fling the wall.
    vel.current.x = clamp(vel.current.x * 0.6 + (dx / dt) * 0.4, MAX_VELOCITY);
    vel.current.y = clamp(vel.current.y * 0.6 + (dy / dt) * 0.4, MAX_VELOCITY);
    clampPan();
    schedule();
  };

  const onPointerUp = (e: RPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const isTap = !d.moved && e.timeStamp - d.startT < TAP_MS;
    if (isTap && d.target) {
      onSelect(d.target);
      return;
    }
    if (e.timeStamp - d.lastT > 80) vel.current = { x: 0, y: 0 };
    startInertia();
  };

  const onWheel = (e: RWheelEvent<HTMLDivElement>) => {
    stopInertia();
    pan.current.x -= e.deltaX;
    pan.current.y -= e.deltaY;
    clampPan();
    schedule();
  };

  return (
    <div
      ref={rootRef}
      className="honeycomb"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{ ["--bubble" as string]: `${bubbleSize}px` }}
    >
      {photos.map((p) => (
        <div
          key={p.id}
          data-id={p.id}
          className={"bubble" + (highlight?.has(p.id) ? " bubble--top" : "")}
          ref={(el) => {
            if (el) bubbles.current.set(p.id, el);
            else bubbles.current.delete(p.id);
          }}
        >
          <img src={urlFor(p.thumb_path)} alt="" loading="lazy" decoding="async" draggable={false} />
        </div>
      ))}
    </div>
  );
}

function clamp(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}

function useBubbleSize(): number {
  // Bigger bubbles on tablets/desktops; ~4 across on a phone.
  const w = typeof window === "undefined" ? 400 : window.innerWidth;
  return w < 480 ? 88 : w < 900 ? 104 : 120;
}
