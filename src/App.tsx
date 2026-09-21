import { useCallback, useEffect, useMemo, useState } from "react";
import { WEDDING } from "./config";
import { Avatar } from "./components/Avatar";
import { Celebration } from "./components/Celebration";
import { CommentsSheet } from "./components/CommentsSheet";
import { GuestCard } from "./components/GuestCard";
import { Guestbook } from "./components/Guestbook";
import { Icon } from "./components/Icon";
import { Masonry } from "./components/Masonry";
import { Onboarding } from "./components/Onboarding";
import { PhotoDetail } from "./components/PhotoDetail";
import { ProfileSheet } from "./components/ProfileSheet";
import { SkeletonGrid } from "./components/Skeleton";
import { Trends } from "./components/Trends";
import { UploadSheet } from "./components/UploadSheet";
import { Welcome } from "./components/Welcome";
import { useMessages } from "./hooks/useMessages";
import { useTrends } from "./hooks/useTrends";
import { usePhotos } from "./hooks/usePhotos";
import { useI18n } from "./i18n";
import { createApi } from "./lib/api";
import { describeError, isSchemaOutOfDate } from "./lib/errors";
import type { Guest, Message, Photo, Trend } from "./lib/types";

type Stage = "loading" | "onboarding" | "ready" | "error";
type Tab = "wall" | "trends";
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
  const { messages, addMessage, toggleMessageHeart, removeMessage } = useMessages(api, stage === "ready");
  const [celebratingMessage, setCelebratingMessage] = useState<Message | null>(null);
  const { trends, addTrend, toggleTrendHeart, removeTrend, bumpComments } = useTrends(api, stage === "ready");
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const commentsTrend = commentsFor ? (trends.find((x) => x.id === commentsFor) ?? null) : null;
  const [celebratingTrend, setCelebratingTrend] = useState<Trend | null>(null);

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

  // Presence: ping while the app is open (every minute + whenever it comes to the front).
  useEffect(() => {
    if (stage !== "ready") return;
    const ping = () => {
      if (document.visibilityState === "visible") void api.heartbeat().catch(() => undefined);
    };
    ping();
    const id = window.setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [api, stage]);

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
              <div className="wall">
                <Guestbook
                  layout="column"
                  messages={messages}
                  urlFor={api.urlFor}
                  meId={guest?.id ?? null}
                  onHeart={toggleMessageHeart}
                  onDelete={(m) => window.confirm(t("confirmDeleteMessage")) && void removeMessage(m)}
                  onOpenGuest={setGuestCard}
                />
                <div className="wall__divider" aria-hidden="true">
                  <span>✦</span>
                </div>
                <div className="wall__photos">
                  <Masonry
                    photos={photos}
                    urlFor={api.urlFor}
                    onSelect={(p) => setSelectedId(p.id)}
                    resetKey={wallReset}
                    pulse={pulse}
                    onHeart={toggleHeart}
                    top={
                      <Guestbook
                        layout="strip"
                        messages={messages}
                        urlFor={api.urlFor}
                        meId={guest?.id ?? null}
                        onHeart={toggleMessageHeart}
                        onDelete={(m) => window.confirm(t("confirmDeleteMessage")) && void removeMessage(m)}
                        onOpenGuest={setGuestCard}
                      />
                    }
                  />
                </div>
              </div>
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
          <Trends
            trends={trends}
            api={api}
            meId={guest?.id ?? null}
            onHeart={toggleTrendHeart}
            onDelete={(tr) => window.confirm(t("confirmDeleteTrend")) && void removeTrend(tr)}
            onOpenGuest={setGuestCard}
            onComments={(tr) => setCommentsFor(tr.id)}
          />
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
          <button className={"nav__btn" + (tab === "trends" ? " nav__btn--on" : "")} onClick={() => setTab("trends")} aria-label={t("trends")}>
            <Icon name="reel" size={24} strokeWidth={tab === "trends" ? 2 : 1.6} />
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
          onMessage={(m) => setCelebratingMessage(m)}
          onTrend={(tr) => setCelebratingTrend(tr)}
        />
      )}
      {celebrating && <Celebration photos={celebrating} urlFor={api.urlFor} onDone={finishCelebration} />}
      {commentsTrend && guest && (
        <CommentsSheet trend={commentsTrend} api={api} meId={guest.id} onClose={() => setCommentsFor(null)} onCount={(d) => bumpComments(commentsTrend.id, d)} onToast={showToast} />
      )}
      {celebratingTrend && (
        <Celebration
          trendNote={celebratingTrend.note}
          urlFor={api.urlFor}
          onDone={() => {
            addTrend(celebratingTrend);
            setCelebratingTrend(null);
            setTab("trends");
          }}
        />
      )}
      {celebratingMessage && (
        <Celebration
          message={celebratingMessage}
          urlFor={api.urlFor}
          onDone={() => {
            addMessage(celebratingMessage);
            setCelebratingMessage(null);
            setTab("wall");
            setWallReset((k) => k + 1);
          }}
        />
      )}
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
