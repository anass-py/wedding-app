/**
 * Instagram-Live-style hearts rising from the bottom of a liked photo and fading:
 * as many hearts as likes (2 likes → 2 hearts per cycle), spread over a 5-second cycle.
 */
export function HeartRain({ count, id }: { count: number; id: string }) {
  if (count <= 0) return null;
  // One rising heart per like (capped so a very popular photo stays smooth).
  const n = Math.min(count, 40);
  let seed = 0;
  for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const cycle = 5;
  return (
    <span className="rain" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const dur = cycle + (rnd() - 0.5) * 0.8;
        return (
          <span
            key={i}
            className="rain__heart"
            style={{
              ["--x" as string]: `${8 + rnd() * 78}%`,
              // evenly staggered so all n hearts are in flight over one cycle
              ["--d" as string]: `${(-(i / n) * cycle).toFixed(2)}s`,
              ["--dur" as string]: `${dur.toFixed(2)}s`,
              ["--sway" as string]: `${(rnd() * 28 - 14).toFixed(0)}px`,
              ["--s" as string]: (0.7 + rnd() * 0.6).toFixed(2),
            }}
          >
            ♥
          </span>
        );
      })}
    </span>
  );
}
