export type TrendProvider = "instagram" | "tiktok" | "youtube" | "other";

export interface ParsedTrend {
  provider: TrendProvider;
  external_id: string | null;
  url: string;
}

/** Recognise Instagram reels/posts, TikTok videos and YouTube (Shorts) links. */
export function parseTrendUrl(raw: string): ParsedTrend | null {
  const v = raw.trim();
  if (!/^https?:\/\//i.test(v)) return null;
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "instagram.com" || host.endsWith(".instagram.com")) {
    const m = u.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
    return { provider: "instagram", external_id: m?.[1] ?? null, url: m ? `https://www.instagram.com/reel/${m[1]}/` : v };
  }
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    const m = u.pathname.match(/\/video\/(\d+)/);
    return { provider: "tiktok", external_id: m?.[1] ?? null, url: v.split("?")[0] };
  }
  if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
    const id = host === "youtu.be" ? u.pathname.slice(1).split("/")[0] : (u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/)?.[1] ?? u.searchParams.get("v"));
    return { provider: "youtube", external_id: id || null, url: id ? `https://www.youtube.com/shorts/${id}` : v };
  }
  return { provider: "other", external_id: null, url: v };
}

/** The provider's own player, for a card that hasn't been fetched by the worker. */
export function embedUrl(t: { provider: TrendProvider; external_id: string | null }): string | null {
  if (!t.external_id) return null;
  switch (t.provider) {
    case "instagram":
      return `https://www.instagram.com/reel/${t.external_id}/embed/`;
    case "tiktok":
      return `https://www.tiktok.com/embed/v2/${t.external_id}`;
    case "youtube":
      return `https://www.youtube.com/embed/${t.external_id}?playsinline=1&rel=0&modestbranding=1`;
    default:
      return null;
  }
}

export const PROVIDER_LABEL: Record<TrendProvider, string> = { instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", other: "Lien" };
