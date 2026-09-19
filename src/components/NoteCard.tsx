import { useRef, useState } from "react";
import { buzz } from "../lib/haptics";
import type { Message } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { RoleBadge } from "./RoleBadge";

interface Props {
  message: Message;
  urlFor: (path: string) => string;
  meId?: string | null;
  onHeart?: (m: Message) => void;
  onDelete?: (m: Message) => void;
  onOpenGuest?: (guest: Message["guest"]) => void;
  className?: string;
  style?: React.CSSProperties;
}

const DOUBLE_TAP_MS = 320;

/** A guestbook message: gold quotation mark, italic serif, author. Double-tap to ❤️. */
export function NoteCard({ message: m, urlFor, meId, onHeart, onDelete, onOpenGuest, className = "", style }: Props) {
  const lastTap = useRef(0);
  const [flash, setFlash] = useState(0);
  const onClick = () => {
    const now = performance.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      setFlash(now);
      if (!m.hearted) {
        onHeart?.(m);
        buzz();
      }
    } else lastTap.current = now;
  };
  return (
    <div className={"note " + className} style={style} onClick={onClick} role="article">
      <span className="note__quote" aria-hidden="true">
        “
      </span>
      <p className="note__text">{m.text}</p>
      <span className="note__foot">
        <button
          className="note__author"
          onClick={(e) => {
            e.stopPropagation();
            onOpenGuest?.(m.guest);
          }}
        >
          <Avatar guest={m.guest} urlFor={urlFor} size={20} />
          <span className="card__name">
            {m.guest.name}
            <RoleBadge name={m.guest.name} size={12} />
          </span>
        </button>
        {m.hearts > 0 && (
          <span className={"card__hearts" + (m.hearted ? " card__hearts--on" : "")}>
            <Icon name="heart" size={12} fill={m.hearted} /> {m.hearts}
          </span>
        )}
        {meId && m.guest_id === meId && onDelete && (
          <button
            className="note__delete"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(m);
            }}
          >
            <Icon name="trash" size={13} />
          </button>
        )}
      </span>
      {flash > 0 && (
        <span key={flash} className="bigheart bigheart--card" aria-hidden="true">
          ♥
        </span>
      )}
    </div>
  );
}
