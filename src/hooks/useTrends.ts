import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "../lib/errors";
import type { Api, Trend } from "../lib/types";

export function useTrends(api: Api, ready: boolean) {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const myId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    myId.current = api.guest?.id ?? null;
    let cancelled = false;
    const load = () =>
      api
        .listTrends()
        .then((list) => !cancelled && setTrends(list))
        .catch((e: unknown) => !cancelled && setError(describeError(e)));
    void load();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    const unsubscribe = api.subscribe({
      onPhotoInsert: () => undefined,
      onPhotoDelete: () => undefined,
      onHeart: () => undefined,
      onScore: () => undefined,
      onTrendInsert: (t) => setTrends((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev])),
      onTrendUpdate: (t) => setTrends((prev) => prev.map((x) => (x.id === t.id ? { ...t, hearted: x.hearted } : x))),
      onTrendDelete: (id) => setTrends((prev) => prev.filter((t) => t.id !== id)),
      onTrendHeart: (trendId, guestId, delta) =>
        setTrends((prev) =>
          prev.map((t) => {
            if (t.id !== trendId) return t;
            if (guestId === myId.current) {
              if (delta > 0 && !t.hearted) return { ...t, hearted: true, hearts: t.hearts + 1 };
              if (delta < 0 && t.hearted) return { ...t, hearted: false, hearts: Math.max(0, t.hearts - 1) };
              return t;
            }
            return { ...t, hearts: Math.max(0, t.hearts + delta) };
          }),
        ),
    });
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [api, ready]);

  const addTrend = useCallback((t: Trend) => setTrends((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev])), []);

  const toggleTrendHeart = useCallback(
    async (t: Trend) => {
      const next = !t.hearted;
      const patch = (hearted: boolean, delta: number) =>
        setTrends((prev) => prev.map((x) => (x.id === t.id ? { ...x, hearted, hearts: Math.max(0, x.hearts + delta) } : x)));
      patch(next, next ? 1 : -1);
      try {
        await api.setTrendHeart(t.id, next);
      } catch {
        patch(!next, next ? -1 : 1);
      }
    },
    [api],
  );

  const removeTrend = useCallback(
    async (t: Trend) => {
      setTrends((prev) => prev.filter((x) => x.id !== t.id));
      try {
        await api.deleteTrend(t.id);
      } catch {
        setTrends((prev) => (prev.some((x) => x.id === t.id) ? prev : [t, ...prev]));
      }
    },
    [api],
  );

  return { trends, error, addTrend, toggleTrendHeart, removeTrend };
}
