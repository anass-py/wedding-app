import type { Socials } from "./types";

export type SocialKey = keyof Socials;
export const SOCIAL_KEYS: SocialKey[] = ["instagram", "x", "tiktok", "website"];

/** Accepts "@handle", "handle" or a full URL; stores the bare handle (or the URL for websites). */
export function normalizeSocial(key: SocialKey, raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  if (key === "website") return v.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  const fromUrl = v.match(/(?:instagram\.com|x\.com|twitter\.com|tiktok\.com)\/@?([A-Za-z0-9_.]+)/i);
  return (fromUrl ? fromUrl[1] : v).replace(/^@/, "").replace(/\/.*$/, "");
}

export function socialUrl(key: SocialKey, value: string): string {
  switch (key) {
    case "instagram":
      return `https://instagram.com/${value}`;
    case "x":
      return `https://x.com/${value}`;
    case "tiktok":
      return `https://tiktok.com/@${value}`;
    default:
      return `https://${value}`;
  }
}

export function socialLabel(key: SocialKey, value: string): string {
  return key === "website" ? value : `@${value}`;
}
