import { RANKING, TOP_N, type Theme } from "../config";
import type { Photo } from "./types";

/**
 * Blend the AI aesthetic score with guest hearts. Photos not yet scored by the
 * AI still rank by hearts, so the Top tab works before/without the ranker.
 */
export function finalScore(p: Photo): number {
  const heartsNorm = (Math.min(p.hearts, RANKING.HEART_SATURATION) / RANKING.HEART_SATURATION) * 10;
  const ai = p.score?.score ?? 0;
  return RANKING.AI_WEIGHT * ai + RANKING.HEART_WEIGHT * heartsNorm;
}

export function topPhotos(photos: Photo[], theme: Theme | "all", n = TOP_N): Photo[] {
  const pool = theme === "all" ? photos : photos.filter((p) => p.score?.theme === theme);
  return pool
    .filter((p) => p.score || p.hearts > 0)
    .sort((a, b) => finalScore(b) - finalScore(a) || b.created_at.localeCompare(a.created_at))
    .slice(0, n);
}
