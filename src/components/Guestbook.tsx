import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { Message } from "../lib/types";
import { NoteCard } from "./NoteCard";

interface Props {
  messages: Message[];
  urlFor: (path: string) => string;
  meId?: string | null;
  onHeart: (m: Message) => void;
  onDelete: (m: Message) => void;
  onOpenGuest: (guest: Message["guest"]) => void;
  /** "column" on wide screens, "strip" (horizontal, swipeable) on phones. */
  layout: "column" | "strip";
}

/** The livre d'or: every message to the couple, newest first, in its own space. */
export function Guestbook({ messages, urlFor, meId, onHeart, onDelete, onOpenGuest, layout }: Props) {
  const { t } = useI18n();
  const known = useRef<Set<string> | null>(null);
  const firstPaint = known.current === null;
  const isNew = (id: string) => firstPaint || !known.current!.has(id);
  useEffect(() => {
    known.current = new Set(messages.map((m) => m.id));
  });
  if (messages.length === 0 && layout === "strip") return null;
  return (
    <section className={`guestbook guestbook--${layout}`} aria-label={t("guestbook")}>
      <header className="guestbook__head">
        <span className="eyebrow">{t("guestbook")}</span>
        <span className="guestbook__count">{messages.length === 1 ? t("messageOne") : t("messagesCount", { n: messages.length })}</span>
      </header>
      <div className="guestbook__list">
        {messages.map((m, i) => (
          <NoteCard
            key={m.id}
            message={m}
            urlFor={urlFor}
            meId={meId}
            onHeart={onHeart}
            onDelete={onDelete}
            onOpenGuest={onOpenGuest}
            className={isNew(m.id) ? "card--new" : ""}
            style={firstPaint ? { animationDelay: `${Math.min(i, 8) * 70}ms` } : undefined}
          />
        ))}
        {messages.length === 0 && <p className="guestbook__empty muted">{t("guestbookEmpty")}</p>}
      </div>
      {layout === "strip" && (
        <div className="ornament guestbook__rule" aria-hidden="true">
          <span>✦</span>
        </div>
      )}
    </section>
  );
}
