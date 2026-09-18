import type { Guest } from "../lib/types";

interface Props {
  guest: Guest;
  urlFor: (path: string) => string;
  size?: number;
}

/** Stable hue per guest so their orb looks the same on every phone. */
function hueOf(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 360;
}

/** Selfie if they added one; otherwise a small gold-ringed gradient orb unique to them. */
export function Avatar({ guest, urlFor, size = 36 }: Props) {
  if (guest.avatar_path) {
    return <img className="avatar" style={{ width: size, height: size }} src={urlFor(guest.avatar_path)} alt="" draggable={false} />;
  }
  const h = hueOf(guest.id);
  const h2 = (h + 40) % 360;
  return (
    <span
      className="avatar avatar--orb"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 28%, hsl(${h} 70% 74%) 0%, hsl(${h} 58% 52%) 38%, hsl(${h2} 55% 26%) 100%)`,
      }}
      aria-hidden="true"
    />
  );
}
