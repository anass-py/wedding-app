import { useCallback, useEffect, useRef, useState } from "react";
import { describeError } from "../lib/errors";
import type { Api, Message } from "../lib/types";

/** Guestbook messages, live. Mirrors usePhotos; the two lists are merged into the wall. */
export function useMessages(api: Api, ready: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const myId = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    myId.current = api.guest?.id ?? null;
    let cancelled = false;
    const load = () =>
      api
        .listMessages()
        .then((list) => !cancelled && setMessages(list))
        .catch((e: unknown) => !cancelled && setError(describeError(e)));
    void load();
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    const unsubscribe = api.subscribe({
      onPhotoInsert: () => undefined,
      onPhotoDelete: () => undefined,
      onHeart: () => undefined,
      onScore: () => undefined,
      onMessageInsert: (m) => {
        if (m.guest_id === myId.current) return; // added by the app after the celebration
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
      },
      onMessageDelete: (id) => setMessages((prev) => prev.filter((m) => m.id !== id)),
      onMessageHeart: (messageId, guestId, delta) =>
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            if (guestId === myId.current) {
              if (delta > 0 && !m.hearted) return { ...m, hearted: true, hearts: m.hearts + 1 };
              if (delta < 0 && m.hearted) return { ...m, hearted: false, hearts: Math.max(0, m.hearts - 1) };
              return m;
            }
            return { ...m, hearts: Math.max(0, m.hearts + delta) };
          }),
        ),
    });
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [api, ready]);

  const addMessage = useCallback((m: Message) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev])), []);

  const toggleMessageHeart = useCallback(
    async (m: Message) => {
      const next = !m.hearted;
      const patch = (hearted: boolean, delta: number) =>
        setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, hearted, hearts: Math.max(0, x.hearts + delta) } : x)));
      patch(next, next ? 1 : -1);
      try {
        await api.setMessageHeart(m.id, next);
      } catch {
        patch(!next, next ? -1 : 1);
      }
    },
    [api],
  );

  const removeMessage = useCallback(
    async (m: Message) => {
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      try {
        await api.deleteMessage(m.id);
      } catch {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [m, ...prev]));
      }
    },
    [api],
  );

  return { messages, error, addMessage, toggleMessageHeart, removeMessage };
}
