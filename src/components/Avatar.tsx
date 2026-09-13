import type { Guest } from "../lib/types";

interface Props {
  guest: Guest;
  urlFor: (path: string) => string;
  size?: number;
}

const HUES = [18, 42, 96, 160, 205, 260, 300, 340];

export function Avatar({ guest, urlFor, size = 36 }: Props) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (guest.avatar_path) {
    return <img className="avatar" style={style} src={urlFor(guest.avatar_path)} alt="" draggable={false} />;
  }
  let h = 0;
  for (const ch of guest.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = HUES[h % HUES.length];
  return (
    <div className="avatar avatar--initial" style={{ ...style, background: `hsl(${hue} 40% 38%)` }}>
      {guest.name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
