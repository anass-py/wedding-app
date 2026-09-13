import { useCallback, useEffect, useMemo, useState } from "react";
import { WEDDING } from "./config";
import { Avatar } from "./components/Avatar";
import { Celebration } from "./components/Celebration";
import { Honeycomb } from "./components/Honeycomb";
import { LangToggle } from "./components/LangToggle";
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
import { topPhotos } from "./lib/ranking";
import type { Guest, Photo } from "./lib/types";

type Stage = "loading" | "onboarding" | "ready" | "error";
type Tab = "wall" | "top";
type View = "grid" | "bubbles";
const VIEW_KEY = "wedding.view";

function initialView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "bubbles" ? "bubbles" : "grid";
  } catch {
    return "grid";
  }
}

export default function App() {
  const api = useMemo(createApi, []);
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("loading");
  const [fatal, setFatal] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("wall");
  const [view, setViewState] = useState<View>(initialView);
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
        setFatal(e instanceof Error ? e.message : String(e));
        setStage("error");
      });
  }, [api]);

  const setView = useCallback((v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);

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

  if (stage === "loading") {
    return (
      <div className="splash">
        <div className="splash__mark">✦</div>
        <div className="display">{WEDDING.couple}</div>
        <div className="muted small">{t("connecting")}</div>
      </div>
    );
  }
  if (stage === "error") return <div className="center error">{fatal}</div>;
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
        <div>
          <div className="header__title">{WEDDING.couple}</div>
          <div className="header__sub muted">{t("photosCount", { n: photos.length })}</div>
        </div>
        <div className="header__right">
          {tab === "wall" && (
            <div className="viewtoggle" role="group">
              <button
                className={view === "grid" ? "on" : ""}
                onClick={() => setView("grid")}
                aria-label={t("viewGrid")}
                aria-pressed={view === "grid"}
              >
                ▦
              </button>
              <button
                className={view === "bubbles" ? "on" : ""}
                onClick={() => setView("bubbles")}
                aria-label={t("viewBubbles")}
                aria-pressed={view === "bubbles"}
              >
                ⬡
              </button>
            </div>
          )}
          <LangToggle />
          {guest && (
            <button className="header__me" onClick={() => setProfileOpen(true)} aria-label={t("profile")}>
              <Avatar guest={guest} urlFor={api.urlFor} size={32} />
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
            ) : view === "grid" ? (
              <Masonry
                photos={photos}
                urlFor={api.urlFor}
                onSelect={(p) => setSelectedId(p.id)}
                highlight={topIds}
                resetKey={wallReset}
                pulse={pulse}
              />
            ) : (
              <Honeycomb photos={photos} urlFor={api.urlFor} onSelect={(p) => setSelectedId(p.id)} highlight={topIds} />
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
        <button className={"nav__btn" + (tab === "wall" ? " nav__btn--on" : "")} onClick={() => setTab("wall")}>
          <span className="nav__icon">▦</span>
          {t("wall")}
        </button>
        <button className="fab" onClick={() => setUploadOpen(true)} aria-label={t("takePhoto")}>
          +
        </button>
        <button className={"nav__btn" + (tab === "top" ? " nav__btn--on" : "")} onClick={() => setTab("top")}>
          <span className="nav__icon">★</span>
          {t("top")}
        </button>
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
        />
      )}
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
