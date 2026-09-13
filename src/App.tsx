import { useCallback, useEffect, useMemo, useState } from "react";
import { WEDDING } from "./config";
import { Avatar } from "./components/Avatar";
import { Honeycomb } from "./components/Honeycomb";
import { LangToggle } from "./components/LangToggle";
import { Onboarding } from "./components/Onboarding";
import { PhotoDetail } from "./components/PhotoDetail";
import { TopPhotos } from "./components/TopPhotos";
import { UploadSheet } from "./components/UploadSheet";
import { usePhotos } from "./hooks/usePhotos";
import { useI18n } from "./i18n";
import { createApi } from "./lib/api";
import { topPhotos } from "./lib/ranking";
import type { Guest } from "./lib/types";

type Stage = "loading" | "onboarding" | "ready" | "error";
type Tab = "wall" | "top";

export default function App() {
  const api = useMemo(createApi, []);
  const { t } = useI18n();
  const [stage, setStage] = useState<Stage>("loading");
  const [fatal, setFatal] = useState<string | null>(null);
  const [, setGuest] = useState<Guest | null>(null);
  const [tab, setTab] = useState<Tab>("wall");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { photos, loading, error, addPhoto, toggleHeart, removePhoto } = usePhotos(api, stage === "ready");

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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }, []);

  // Keep the detail view in sync with live heart/score updates.
  const selected = selectedId ? (photos.find((p) => p.id === selectedId) ?? null) : null;
  const topIds = useMemo(() => new Set(topPhotos(photos, "all").map((p) => p.id)), [photos]);

  if (stage === "loading") return <div className="center muted">{t("connecting")}</div>;
  if (stage === "error") return <div className="center error">{fatal}</div>;
  if (stage === "onboarding") {
    return (
      <Onboarding
        api={api}
        onJoined={(g) => {
          setGuest(g);
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
          <LangToggle />
          {api.guest && <Avatar guest={api.guest} urlFor={api.urlFor} size={32} />}
        </div>
      </header>

      <main className="main">
        {error && <div className="banner banner--error">{error}</div>}
        {tab === "wall" ? (
          <>
            <Honeycomb photos={photos} urlFor={api.urlFor} onSelect={(p) => setSelectedId(p.id)} highlight={topIds} />
            {!loading && photos.length === 0 && (
              <div className="empty">
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
          <span className="nav__icon">⬡</span>
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
          api={api}
          onClose={() => setSelectedId(null)}
          onHeart={toggleHeart}
          onDelete={removePhoto}
        />
      )}
      {uploadOpen && (
        <UploadSheet
          api={api}
          onClose={() => setUploadOpen(false)}
          onUploaded={addPhoto}
          onError={showToast}
          onDone={() => showToast(t("posted"))}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
