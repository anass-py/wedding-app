import { useCallback, useEffect, useRef, useState } from "react";
import type { Api, Photo } from "../lib/types";

export function usePhotos(api: Api, ready: boolean, onRemoteHeart?: (photoId: string) => void) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const myId = useRef<string | null>(null);
  const remoteHeart = useRef(onRemoteHeart);
  remoteHeart.current = onRemoteHeart;

  useEffect(() => {
    if (!ready) return;
    myId.current = api.guest?.id ?? null;
    let cancelled = false;

    const load = () =>
      api
        .listPhotos()
        .then((list) => {
          if (!cancelled) {
            setPhotos(list);
            setError(null);
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    void load();

    // Phones drop the websocket in the background; catch up when we come back.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    const unsubscribe = api.subscribe({
      onPhotoInsert: (photo) => {
        // Our own uploads are added by the app after the celebration animation.
        if (photo.guest_id === myId.current) return;
        setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev]));
      },
      onPhotoDelete: (id) => setPhotos((prev) => prev.filter((p) => p.id !== id)),
      onHeart: (photoId, guestId, delta) => {
        // Our own hearts were already applied optimistically.
        if (guestId === myId.current) return;
        if (delta > 0) remoteHeart.current?.(photoId);
        setPhotos((prev) =>
          prev.map((p) => (p.id === photoId ? { ...p, hearts: Math.max(0, p.hearts + delta) } : p)),
        );
      },
      onScore: (photoId, score) =>
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, score } : p))),
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [api, ready]);

  const addPhoto = useCallback((photo: Photo) => {
    setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev]));
  }, []);

  const toggleHeart = useCallback(
    async (photo: Photo) => {
      const next = !photo.hearted;
      const patch = (hearted: boolean, delta: number) =>
        setPhotos((prev) =>
          prev.map((p) => (p.id === photo.id ? { ...p, hearted, hearts: Math.max(0, p.hearts + delta) } : p)),
        );
      patch(next, next ? 1 : -1);
      try {
        await api.setHeart(photo.id, next);
      } catch {
        patch(!next, next ? -1 : 1);
      }
    },
    [api],
  );

  const removePhoto = useCallback(
    async (photo: Photo) => {
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      try {
        await api.deletePhoto(photo);
      } catch {
        setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev]));
        throw new Error("delete failed");
      }
    },
    [api],
  );

  return { photos, loading, error, addPhoto, toggleHeart, removePhoto };
}
