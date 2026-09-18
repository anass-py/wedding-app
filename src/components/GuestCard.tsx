import { useEffect, useMemo, useState } from "react";
import { WEDDING } from "../config";
import { useI18n } from "../i18n";
import { topPhotos } from "../lib/ranking";
import { SOCIAL_KEYS, SOCIAL_META, socialLabel, socialUrl } from "../lib/socials";
import type { Api, Guest, Photo } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

interface Props {
  guest: Guest;
  photos: Photo[];
  api: Api;
  onClose: () => void;
}

/** Collectible-style guest card: number, name, socials, hearts, and what they posted. */
export function GuestCard({ guest, photos, api, onClose }: Props) {
  const { t } = useI18n();
  const [numbering, setNumbering] = useState<{ n: number; total: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listGuests()
      .then((all) => {
        if (cancelled) return;
        const idx = all.findIndex((g) => g.id === guest.id);
        setNumbering({ n: idx >= 0 ? idx + 1 : all.length, total: all.length });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, guest.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = useMemo(() => {
    const mine = photos.filter((p) => p.guest_id === guest.id);
    const top = new Set(topPhotos(photos, "all").map((p) => p.id));
    return {
      photos: mine.filter((p) => p.kind !== "video").length,
      videos: mine.filter((p) => p.kind === "video").length,
      hearts: mine.reduce((n, p) => n + p.hearts, 0),
      best: mine.reduce((m, p) => Math.max(m, p.score?.score ?? 0), 0),
      inTop: mine.some((p) => top.has(p.id)),
    };
  }, [photos, guest.id]);

  const socials = SOCIAL_KEYS.filter((k) => guest.socials?.[k]);
  const handle = SOCIAL_KEYS.filter((k) => k !== "website").map((k) => guest.socials?.[k]).find(Boolean) ?? null;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="gcard-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="gcard" onClick={(e) => e.stopPropagation()}>
        <div className="gcard__head">
          <span className="gcard__brand">{WEDDING.couple}</span>
          <span className="gcard__edition">{WEDDING.guestTitle}</span>
        </div>

        <div className="gcard__numrow">
          <div className="gcard__num">
            {numbering ? pad(numbering.n) : "··"}
            <span className="gcard__of"> / {numbering ? pad(numbering.total) : "··"}</span>
          </div>
          <Avatar guest={guest} urlFor={api.urlFor} size={64} />
        </div>

        <h2 className="gcard__name">{guest.name}</h2>
        {handle && <div className="gcard__handle">@{handle}</div>}

        {socials.length > 0 && (
          <div className="gcard__socials">
            {socials.map((k) => (
              <a key={k} className="gcard__social" href={socialUrl(k, guest.socials[k]!)} target="_blank" rel="noreferrer" aria-label={socialLabel(k, guest.socials[k]!)}>
                <Icon name={SOCIAL_META[k].icon} size={20} />
              </a>
            ))}
          </div>
        )}

        <hr className="gcard__rule" />

        <div className="gcard__bigrow">
          <div className="gcard__big">
            <span className="gcard__bignum">{stats.hearts}</span>
            <span className="gcard__biglabel">
              <Icon name="heart" size={14} fill /> {t("heartsReceived")}
            </span>
          </div>
          {stats.inTop ? (
            <span className="gcard__chip gcard__chip--gold">★ TOP 5</span>
          ) : (
            <span className="gcard__chip">{WEDDING.guestTitle.toUpperCase()}</span>
          )}
        </div>

        <hr className="gcard__rule" />

        <div className="gcard__stats">
          <div>
            <span className="gcard__k">{t("yourPhotos")}</span>
            <span className="gcard__v">{stats.photos}</span>
          </div>
          <div>
            <span className="gcard__k">{t("videosLabel")}</span>
            <span className="gcard__v">{stats.videos}</span>
          </div>
          <div>
            <span className="gcard__k">{t("bestScore")}</span>
            <span className={"gcard__v" + (stats.best ? " gcard__v--gold" : "")}>{stats.best ? `★ ${stats.best.toFixed(1)}` : "—"}</span>
          </div>
        </div>

        <button className="gcard__close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
      </div>
    </div>
  );
}
