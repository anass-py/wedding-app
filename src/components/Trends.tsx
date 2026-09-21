import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import { PROVIDER_LABEL, embedUrl } from "../lib/trends";
import type { Api, Trend } from "../lib/types";
import { Avatar } from "./Avatar";
import { HeartRain } from "./HeartRain";
import { Icon } from "./Icon";
import { RoleBadge } from "./RoleBadge";

interface Props {
  trends: Trend[];
  api: Api;
  meId: string | null;
  onHeart: (t: Trend) => void;
  onDelete: (t: Trend) => void;
  onOpenGuest: (guest: Trend["guest"]) => void;
}

/** Reels to reproduce on the day: the provider's player (or our copy once the worker fetched it), likes, notes. */
export function Trends({ trends, api, meId, onHeart, onDelete, onOpenGuest }: Props) {
  const { t } = useI18n();
  return (
    <div className="trends">
      <header className="top__head">
        <p className="eyebrow">{t("trendsEyebrow")}</p>
        <h2 className="top__title">{t("trends")}</h2>
        <p className="top__sub">{t("trendsSub")}</p>
      </header>
      {trends.length === 0 && <p className="top__empty muted">{t("trendsEmpty")}</p>}
      <div className="trends__list">
        {trends.map((tr) => (
          <TrendCard key={tr.id} trend={tr} api={api} mine={tr.guest_id === meId} onHeart={onHeart} onDelete={onDelete} onOpenGuest={onOpenGuest} />
        ))}
      </div>
    </div>
  );
}

function TrendCard({ trend: tr, api, mine, onHeart, onDelete, onOpenGuest }: { trend: Trend; api: Api; mine: boolean; onHeart: (t: Trend) => void; onDelete: (t: Trend) => void; onOpenGuest: (g: Trend["guest"]) => void }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [pop, setPop] = useState(0);
  const embed = embedUrl(tr);
  const heart = () => {
    if (!tr.hearted) {
      setPop((n) => n + 1);
      buzz();
    }
    onHeart(tr);
  };
  return (
    <article className="trend">
      <div className={"trend__media" + (tr.video_path ? " trend__media--native" : "")}>
        {tr.video_path ? (
          <TrendVideo src={api.urlFor(tr.video_path)} poster={tr.thumb_path ? api.urlFor(tr.thumb_path) : undefined} />
        ) : playing && embed ? (
          <iframe src={embed} title={PROVIDER_LABEL[tr.provider]} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
        ) : (
          <button className="trend__cover" onClick={() => (embed ? setPlaying(true) : window.open(tr.url, "_blank", "noopener"))}>
            <span className={`trend__logo trend__logo--${tr.provider}`}>
              <Icon name={tr.provider === "instagram" ? "instagram" : tr.provider === "tiktok" ? "tiktok" : tr.provider === "youtube" ? "play" : "globe"} size={30} fill={tr.provider === "youtube"} strokeWidth={tr.provider === "youtube" ? 0 : 1.6} />
            </span>
            <span className="trend__play">
              <Icon name="play" size={22} fill strokeWidth={0} />
            </span>
            <span className="trend__provider">{PROVIDER_LABEL[tr.provider]}</span>
          </button>
        )}
        <HeartRain count={tr.hearts} id={tr.id} />
      </div>
      <div className="trend__body">
        <button className={"like like--inline" + (tr.hearted ? " like--on" : "") + (pop ? " like--pop" : "")} onClick={heart} aria-pressed={tr.hearted}>
          <span key={pop} className="like__icon">
            <Icon name="heart" size={26} fill={tr.hearted} strokeWidth={1.6} />
          </span>
          <span className="like__count">{tr.hearts > 0 ? tr.hearts : ""}</span>
        </button>
        <div className="trend__text">
          {tr.note && <p className="trend__note">{tr.note}</p>}
          <button className="note__author" onClick={() => onOpenGuest(tr.guest)}>
            <Avatar guest={tr.guest} urlFor={api.urlFor} size={20} />
            <span className="card__name">
              {tr.guest.name}
              <RoleBadge name={tr.guest.name} size={12} />
            </span>
          </button>
        </div>
        <div className="trend__tools">
          <a className="tool" href={tr.url} target="_blank" rel="noreferrer" aria-label={PROVIDER_LABEL[tr.provider]}>
            <Icon name="share" size={18} />
          </a>
          {mine && (
            <button className="tool tool--danger" onClick={() => onDelete(tr)} aria-label={t("delete")}>
              <Icon name="trash" size={18} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/** Stored trend: plays muted while on screen, tap toggles sound (like Reels). */
function TrendVideo({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: [0, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      el.pause();
    };
  }, []);
  return (
    <>
      <video ref={ref} src={src} poster={poster} muted={muted} loop playsInline preload="metadata" onClick={() => setMuted((m) => !m)} />
      <button className="trend__sound" onClick={() => setMuted((m) => !m)} aria-label={muted ? "unmute" : "mute"}>
        <Icon name={muted ? "muted" : "sound"} size={18} />
      </button>
    </>
  );
}
