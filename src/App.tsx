import { useCallback, useEffect, useMemo, useState } from "react";
import { WEDDING } from "./config";
import { Avatar } from "./components/Avatar";
import { Celebration } from "./components/Celebration";
import { GuestCard } from "./components/GuestCard";
import { Icon } from "./components/Icon";
import { Masonry } from "./components/Masonry";
import { Onboarding } from "./components/Onboarding";
import { PhotoDetail } from "./components/PhotoDetail";
import { ProfileSheet } from "./components/ProfileSheet";
import { SkeletonGrid } from "./components/Skeleton";
import { TopPhotos } from "./components/TopPhotos";
import { UploadSheet } from "./components/UploadSheet";
import { Welcome } from "./components/Welcome";
import { usePhotos } from "./hooks/usePhotos";
import { useI18n } from "./i18n";
import { createApi } from "./lib/api";
import { describeError, isSchemaOutOfDate } from "./lib/errors";
import { topPhotos } from "./lib/ranking";
import type { Guest, Photo } from "./lib/types";

type Stage = "loading" | "onboarding" | "ready" | "error";
type Tab = "wall" | "top";
/** "Sara & Yassine" → ["Sara", "Yassine"] so the ampersand can be styled. */
const coupleNames = WEDDING.couple.split(/\s*&\s*/).map((n) => n.trim()).filter(Boolean);

export default function App() {
  const api = useMemo(createApi, []);
  const { t, lang, setLang } = useI18n();
  const [stage, setStage] = useState<Stage>("loading");
  const [fatal, setFatal] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guestCard, setGuestCard] = useState<Guest | null>(null);
  const [tab, setTab] = useState<Tab>("wall");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Photo[] | null>(null);
  const [wallReset, setWallReset] = useState(0);

  const [pulse, setPulse] = useState<{ key: number; photoId: string } | null>(null);
  const onRemoteHeart = useCallback((photoId: string) => setPulse({ key: Date.now() + Math.random(), photoId }), []);
  const { photos, loading, error, addPhoto, toggleHeart, removePhoto } = usePhotos(api, stage === "ready", onRemoteHeart);

  useEffect(() => {
    api
      .init()
      .then((g) => {
        setGuest(g);
        setStage(g ? "ready" : "onboarding");
      })
      .catch((e: unknown) => {
        setFatal(isSchemaOutOfDate(e) ? `${t("schemaOutOfDate")}\n\n${describeError(e)}` : describeError(e));
        setStage("error");
      });
  }, [api]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  const finishCelebration = useCallback(() => {
    setCelebrating((batch) => {
      batch?.forEach(addPhoto);
      return null;
    });
    setTab("wall");
    setWallReset((k) => k + 1);
  }, [addPhoto]);

  // Keep the detail view in sync with live heart/score updates.
  const selected = selectedId ? (photos.find((p) => p.id === selectedId) ?? null) : null;
  const topIds = useMemo(() => new Set(topPhotos(photos, "all").map((p) => p.id)), [photos]);
  const videoCount = useMemo(() => photos.filter((p) => p.kind === "video").length, [photos]);
  const photoCount = photos.length - videoCount;

  if (stage === "loading") {
    return (
      <div className="splash">
        <div className="splash__mark">✦</div>
        <div className="display">{WEDDING.couple}</div>
        <div className="muted small">{t("connecting")}</div>
      </div>
    );
  }
  if (stage === "error") {
    return (
      <div className="center">
        <div className="fatal">
          <div className="fatal__mark">✦</div>
          <p className="fatal__text">{fatal}</p>
          <button className="btn btn--ghost" onClick={() => location.reload()}>
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }
  if (stage === "onboarding") {
    return (
      <Onboarding
        api={api}
        onJoined={(g) => {
          setGuest(g);
          setWelcome(true);
          setStage("ready");
        }}
      />
    );
  }

  return (
    <div className="app">
      {api.isDemo && <div className="banner">{t("demoBanner")}</div>}
      <header className="header">
        <h1 className="header__title">
          {coupleNames.length === 2 ? (
            <>
              <span>{coupleNames[0]}</span>
              <span className="header__amp">&</span>
              <span>{coupleNames[1]}</span>
            </>
          ) : (
            WEDDING.couple
          )}
        </h1>
        <div className="ornament header__ornament">
          <span>✦</span>
        </div>
        <div className="header__sub">
          {photoCount === 1 ? t("photoOne") : t("photosCount", { n: photoCount })}
          {videoCount > 0 && ` · ${videoCount === 1 ? t("videoOne") : t("videosCount", { n: videoCount })}`}
        </div>
        <button className="langtoggle header__lang" onClick={() => setLang(lang === "fr" ? "en" : "fr")} aria-label={t("language")}>
          <span className={lang === "fr" ? "on" : ""}>FR</span>
          <span className="sep">/</span>
          <span className={lang === "en" ? "on" : ""}>EN</span>
        </button>
        <div className="header__right">
          {guest && (
            <button className="header__me" onClick={() => setProfileOpen(true)} aria-label={t("profile")}>
              <Avatar guest={guest} urlFor={api.urlFor} size={36} />
            </button>
          )}
        </div>
      </header>

      <main className="main">
        {error && <div className="banner banner--error">{error}</div>}
        {tab === "wall" ? (
          <>
            {loading && photos.length === 0 ? (
              <SkeletonGrid />
            ) : (
              <Masonry
                photos={photos}
                urlFor={api.urlFor}
                onSelect={(p) => setSelectedId(p.id)}
                highlight={topIds}
                resetKey={wallReset}
                pulse={pulse}
                onHeart={toggleHeart}
              />
            )}
            {!loading && photos.length === 0 && (
              <div className="empty">
                <div className="ornament">
                  <span>✦</span>
                </div>
                <div className="empty__title">{t("emptyWall")}</div>
                <div className="muted">{t("emptyWallHint")}</div>
              </div>
            )}
          </>
        ) : (
          <TopPhotos photos={photos} api={api} onSelect={(p) => setSelectedId(p.id)} />
        )}
      </main>

      <nav className="nav">
        <div className="nav__pill">
          <button className={"nav__btn" + (tab === "wall" ? " nav__btn--on" : "")} onClick={() => setTab("wall")} aria-label={t("wall")}>
            <Icon name="grid" size={24} strokeWidth={tab === "wall" ? 2 : 1.6} />
          </button>
          <button className={"fab" + (!loading && photos.length === 0 ? " fab--invite" : "")} onClick={() => setUploadOpen(true)} aria-label={t("takePhoto")}>
            <Icon name="plus" size={28} strokeWidth={2.4} />
          </button>
          <button className={"nav__btn" + (tab === "top" ? " nav__btn--on" : "")} onClick={() => setTab("top")} aria-label={t("top")}>
            <Icon name="star" size={24} fill={tab === "top"} strokeWidth={1.6} />
          </button>
        </div>
      </nav>

      {selected && (
        <PhotoDetail
          photo={selected}
          photos={photos}
          api={api}
          onClose={() => setSelectedId(null)}
          onNavigate={setSelectedId}
          onHeart={toggleHeart}
          onDelete={removePhoto}
          onOpenGuest={setGuestCard}
        />
      )}
      {guestCard && <GuestCard guest={guestCard} photos={photos} api={api} onClose={() => setGuestCard(null)} />}
      {uploadOpen && (
        <UploadSheet
          api={api}
          onClose={() => setUploadOpen(false)}
          onError={showToast}
          onDone={(batch) => setCelebrating(batch)}
        />
      )}
      {celebrating && <Celebration photos={celebrating} urlFor={api.urlFor} onDone={finishCelebration} />}
      {welcome && guest && <Welcome name={guest.name} onDone={() => setWelcome(false)} />}
      {profileOpen && guest && (
        <ProfileSheet
          api={api}
          guest={guest}
          photos={photos}
          onClose={() => setProfileOpen(false)}
          onUpdated={setGuest}
          onToast={showToast}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
