/**
 * Instagram-Live-style hearts rising from the bottom of a liked photo and fading.
 * Density follows the like count (1 → a heart every few seconds, 10+ → a steady trickle).
 */
export function HeartRain({ count, id }: { count: number; id: string }) {
  if (count <= 0) return null;
  const n = Math.min(4, 1 + Math.floor(count / 3));
  // Deterministic per photo so the pattern doesn't jump on re-render.
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return (
    <span className="rain" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="rain__heart"
          style={{
            ["--x" as string]: `${12 + rnd() * 70}%`,
            ["--d" as string]: `${-(rnd() * 6).toFixed(2)}s`,
            ["--dur" as string]: `${(4.5 + rnd() * 2.5).toFixed(2)}s`,
            ["--sway" as string]: `${(rnd() * 24 - 12).toFixed(0)}px`,
            ["--s" as string]: (0.75 + rnd() * 0.5).toFixed(2),
          }}
        >
          ♥
        </span>
      ))}
    </span>
  );
}
