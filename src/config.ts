// ─── EDIT ME ──────────────────────────────────────────────────────────────────
// Everything guest-facing that is specific to *your* wedding lives here.
export const WEDDING = {
  /** Shown on the welcome screen and in the header. */
  couple: "Anass & Boutaina",
  /** ISO date, used for the small subtitle. */
  date: "2026-10-17",
  /** Optional hashtag shown under the title (leave "" to hide). */
  hashtag: "#AnassEtBoutaina",
  /**
   * "midnight" — dark, photos glow, best for an evening party.
   * "ivory"    — cream paper & ink, invitation-card feel, best for daytime.
   * This is the default; guests can switch in their profile sheet.
   */
  theme: "midnight" as "midnight" | "ivory",
  /**
   * What a guest who posts is called on their card, e.g. "Complice n° 07".
   * Ideas: "Complice", "Témoin", "Paparazzi", "Conteur".
   */
  guestTitle: "Complice",
};

/** Themes used by the AI ranking. Keep in sync with scripts/rank.ts THEMES. */
export const THEMES = [
  "couple",
  "ceremony",
  "decoration",
  "guests",
  "dance",
  "food",
  "details",
  "venue",
  "other",
] as const;
export type Theme = (typeof THEMES)[number];

/** Video limits enforced in the browser before upload. Supabase's free tier caps files at 50 MB. */
export const MEDIA = { MAX_VIDEO_MB: 50, MAX_VIDEO_SECONDS: 90, MAX_RECORD_SECONDS: 60 };

/** How many photos the "Top" tab shows per theme. */
export const TOP_N = 5;

/**
 * Final ranking = AI_WEIGHT * ai_score(0-10) + HEART_WEIGHT * hearts_norm(0-10).
 * hearts_norm saturates at HEART_SATURATION hearts.
 */
export const RANKING = { AI_WEIGHT: 0.65, HEART_WEIGHT: 0.35, HEART_SATURATION: 15 };
