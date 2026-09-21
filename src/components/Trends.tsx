import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { buzz } from "../lib/haptics";
import { PROVIDER_LABEL } from "../lib/trends";
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
  onComments: (t: Trend) => void;
}

/** TikTok-style feed: one reel per screen, snap scrolling, autoplay, sound on tap. */
export function Trends({ trends, api, meId, onHeart, onDelete, onOpenGuest, onComments }: Props) {
  const { t } = useI18n();
  const [sound, setSound] = useState(false); // once the guest asks for sound, keep it on for the next reels
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem("wedding.reels.hint");
    } catch {
      return true;
    }
  });
  const dismissHint = () => {
    if (!hint) return;
    setHint(false);
    try {
      localStorage.setItem("wedding.reels.hint", "1");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(dismissHint, 6000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hint]);
  if (trends.length === 0) {
    return (
      <div className="trends trends--empty">
        <p className="eyebrow">{t("trendsEyebrow")}</p>
        <h2 className="top__title">{t("trends")}</h2>
        <p className="top__empty muted">{t("trendsEmpty")}</p>
      </div>
    );
  }
  return (
    <div className="reels" onScroll={dismissHint}>
      {hint && trends.length > 1 && (
        <div className="reels__hint" aria-hidden="true">
          <span className="reels__chevrons">
            <Icon name="chevronUp" size={22} strokeWidth={2} />
            <Icon name="chevronUp" size={22} strokeWidth={2} />
          </span>
          <span className="reels__hint-text">{t("swipeUp")}</span>
        </div>
      )}
      {trends.map((tr, i) => (
        <Reel key={tr.id} trend={tr} index={i} api={api} mine={tr.guest_id === meId} sound={sound} onSound={setSound} onHeart={onHeart} onDelete={onDelete} onOpenGuest={onOpenGuest} onComments={onComments} />
      ))}
    </div>
  );
}

function Reel({ trend: tr, index, api, mine, sound, onSound, onHeart, onDelete, onOpenGuest, onComments }: { trend: Trend; index: number; api: Api; mine: boolean; sound: boolean; onSound: (s: boolean) => void; onHeart: (t: Trend) => void; onDelete: (t: Trend) => void; onOpenGuest: (g: Trend["guest"]) => void; onComments: (t: Trend) => void }) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pop, setPop] = useState(0);
  const [flash, setFlash] = useState(0);
  const lastTap = useRef(0);
  const singleTap = useRef(0);

  // Play only the reel that fills the screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting && e.intersectionRatio >= 0.6), { threshold: [0, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!active) {
      v.pause();
      v.currentTime = 0;
      setPaused(false);
      return;
    }
    v.muted = !sound;
    v.play().catch(() => {
      // Sound without a fresh tap is refused on some phones: fall back to muted.
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }, [active, sound, tr.video_path]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPaused(false);
    } else {
      v.pause();
      setPaused(true);
    }
  };

  const heart = () => {
    if (!tr.hearted) {
      setPop((n) => n + 1);
      buzz();
    }
    onHeart(tr);
  };

  const onStageClick = () => {
    const now = performance.now();
    if (now - lastTap.current < 320) {
      lastTap.current = 0;
      window.clearTimeout(singleTap.current);
      setFlash(now);
      if (!tr.hearted) heart();
      return;
    }
    lastTap.current = now;
    window.clearTimeout(singleTap.current);
    singleTap.current = window.setTimeout(togglePlay, 320);
  };

  const toggleSound = () => {
    const v = videoRef.current;
    const next = !sound;
    onSound(next);
    if (v) {
      v.muted = !next;
      if (v.paused && active) void v.play();
    }
  };

  return (
    <section ref={rootRef} className="reel" data-index={index}>
      {tr.thumb_path && <div className="reel__bg" style={{ backgroundImage: `url(${api.urlFor(tr.thumb_path)})` }} />}
      <div className="reel__stage" onClick={onStageClick}>
        {tr.video_path ? (
          <video ref={videoRef} src={api.urlFor(tr.video_path)} poster={tr.thumb_path ? api.urlFor(tr.thumb_path) : undefined} loop playsInline muted preload={index < 2 ? "auto" : "metadata"} />
        ) : (
          <div className="reel__pending">
            <span className={`trend__logo trend__logo--${tr.provider}`}>
              <Icon name={tr.provider === "instagram" ? "instagram" : tr.provider === "tiktok" ? "tiktok" : tr.provider === "youtube" ? "play" : "globe"} size={30} fill={tr.provider === "youtube"} strokeWidth={tr.provider === "youtube" ? 0 : 1.6} />
            </span>
            <p className="reel__pending-text">{tr.fetch_error ? t("trendFailed") : t("trendPending")}</p>
            <span className="reel__pending-bar" />
          </div>
        )}
        {flash > 0 && (
          <span key={flash} className="bigheart" aria-hidden="true">
            ♥
          </span>
        )}
        {paused && tr.video_path && (
          <span className="viewer__paused" aria-hidden="true">
            <Icon name="play" size={36} fill strokeWidth={0} />
          </span>
        )}
        <HeartRain count={tr.hearts} id={tr.id} />
      </div>

      <div className="reel__rail">
        <button className={"rail__btn" + (tr.hearted ? " rail__btn--on" : "") + (pop ? " like--pop" : "")} onClick={heart} aria-pressed={tr.hearted}>
          <span key={pop} className="rail__icon like__icon">
            <Icon name="heart" size={28} fill={tr.hearted} strokeWidth={1.7} />
          </span>
          <span className="rail__label">{tr.hearts || ""}</span>
        </button>
        <button className="rail__btn" onClick={() => onComments(tr)} aria-label={t("comments")}>
          <span className="rail__icon">
            <Icon name="comment" size={26} />
          </span>
          <span className="rail__label">{tr.comments || ""}</span>
        </button>
        {tr.video_path && (
          <button className="rail__btn" onClick={toggleSound} aria-label={sound ? t("mute") : t("unmute")}>
            <span className="rail__icon">
              <Icon name={sound ? "sound" : "muted"} size={24} />
            </span>
          </button>
        )}
        <a className="rail__btn" href={tr.url} target="_blank" rel="noreferrer" aria-label={PROVIDER_LABEL[tr.provider]}>
          <span className="rail__icon">
            <Icon name="share" size={22} />
          </span>
        </a>
        {mine && (
          <button className="rail__btn rail__btn--danger" onClick={() => onDelete(tr)} aria-label={t("delete")}>
            <span className="rail__icon">
              <Icon name="trash" size={22} />
            </span>
          </button>
        )}
      </div>

      <div className="reel__info">
        <button className="reel__author" onClick={() => onOpenGuest(tr.guest)}>
          <Avatar guest={tr.guest} urlFor={api.urlFor} size={36} />
          <span className="reel__name">
            {tr.guest.name}
            <RoleBadge name={tr.guest.name} size={14} />
          </span>
        </button>
        {tr.note && <p className="reel__note">{tr.note}</p>}
        <span className="reel__provider">{PROVIDER_LABEL[tr.provider]}</span>
      </div>
    </section>
  );
}
