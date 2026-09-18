import type { Socials } from "./types";

export type SocialKey = keyof Socials;
export const SOCIAL_KEYS: SocialKey[] = ["instagram", "snapchat", "tiktok", "facebook", "x", "website"];
/** The networks offered on the join screen. */
export const JOIN_NETWORKS: SocialKey[] = ["instagram", "snapchat", "tiktok", "facebook"];

export const SOCIAL_META: Record<SocialKey, { label: string; icon: "instagram" | "snapchat" | "tiktok" | "facebook" | "x" | "globe"; color: string }> = {
  instagram: { label: "Instagram", icon: "instagram", color: "#e1306c" },
  snapchat: { label: "Snapchat", icon: "snapchat", color: "#fffc00" },
  tiktok: { label: "TikTok", icon: "tiktok", color: "#69c9d0" },
  facebook: { label: "Facebook", icon: "facebook", color: "#1877f2" },
  x: { label: "X", icon: "x", color: "#ffffff" },
  website: { label: "Site web", icon: "globe", color: "#d9b56d" },
};

/** Accepts "@handle", "handle" or a full URL; stores the bare handle (or the URL for websites). */
export function normalizeSocial(key: SocialKey, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (key === "website") return v.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const fromUrl = v.match(/(?:instagram\.com|snapchat\.com\/add|tiktok\.com|facebook\.com|x\.com|twitter\.com)\/@?([A-Za-z0-9_.-]+)/i);
  return (fromUrl ? fromUrl[1] : v).replace(/^@/, "").replace(/\/.*$/, "").replace(/\s+/g, "");
}

export function socialUrl(key: SocialKey, value: string): string {
  switch (key) {
    case "instagram":
      return `https://instagram.com/${value}`;
    case "snapchat":
      return `https://snapchat.com/add/${value}`;
    case "tiktok":
      return `https://tiktok.com/@${value}`;
    case "facebook":
      return `https://facebook.com/${value}`;
    case "x":
      return `https://x.com/${value}`;
    default:
      return `https://${value}`;
  }
}

export function socialLabel(key: SocialKey, value: string): string {
  return key === "website" ? value : `@${value}`;
}
