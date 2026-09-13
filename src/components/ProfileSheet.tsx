import { useMemo, useRef, useState } from "react";
import { getTheme, setTheme, type ThemeName } from "../lib/theme";
import { useI18n } from "../i18n";
import { processAvatar } from "../lib/image";
import type { Api, Guest, Photo } from "../lib/types";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { LangToggle } from "./LangToggle";

interface Props {
  api: Api;
  guest: Guest;
  photos: Photo[];
  onClose: () => void;
  onUpdated: (guest: Guest) => void;
  onToast: (msg: string) => void;
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function ProfileSheet({ api, guest, photos, onClose, onUpdated, onToast }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState(guest.name);
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setThemeState] = useState<ThemeName>(getTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const pickTheme = (th: ThemeName) => {
    setTheme(th);
    setThemeState(th);
  };

  const stats = useMemo(() => {
    const mine = photos.filter((p) => p.guest_id === guest.id);
    return { photos: mine.length, hearts: mine.reduce((n, p) => n + p.hearts, 0) };
  }, [photos, guest.id]);

  const dirty = name.trim() !== guest.name || !!selfie;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const showInstall = !isStandalone() && /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  const save = async () => {
    if (!dirty || !name.trim() || busy) return;
    setBusy(true);
    try {
      onUpdated(await api.updateGuest(name, selfie?.blob));
      onToast(t("saved"));
      onClose();
    } catch (e) {
      onToast(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet profile" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__handle" />
        <div className="profile__head">
          <p className="eyebrow">{t("profile")}</p>
          <LangToggle />
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            try {
              const blob = await processAvatar(f);
              setSelfie({ blob, url: URL.createObjectURL(blob) });
            } catch {
              onToast(t("uploadFailed"));
            }
          }}
        />
        <button className="profile__avatar" onClick={() => fileRef.current?.click()} type="button">
          {selfie ? <img className="avatar" style={{ width: 84, height: 84 }} src={selfie.url} alt="" /> : <Avatar guest={guest} urlFor={api.urlFor} size={84} />}
          <span className="profile__change">{t("changeSelfie")}</span>
        </button>
        <div className="profile__stats">
          <div>
            <b>{stats.photos}</b>
            <span>{t("yourPhotos")}</span>
          </div>
          <div>
            <b>{stats.hearts}</b>
            <span>{t("heartsReceived")}</span>
          </div>
        </div>
        <label className="field">
          <span>{t("yourName")}</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field">
          <span>{t("look")}</span>
          <div className="segmented">
            <button className={theme === "midnight" ? "on" : ""} onClick={() => pickTheme("midnight")}>
              ● {t("midnight")}
            </button>
            <button className={theme === "ivory" ? "on" : ""} onClick={() => pickTheme("ivory")}>
              ○ {t("ivory")}
            </button>
          </div>
        </div>
        {showInstall && (
          <div className="install">
            <div className="install__title">
              <Icon name="phone" size={16} /> {t("installTitle")}
            </div>
            <div className="muted small">{ios ? t("installIos") : t("installAndroid")}</div>
          </div>
        )}
        <div className="sheet__actions">
          <button className="btn btn--ghost" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="btn btn--primary" onClick={save} disabled={!dirty || !name.trim() || busy}>
            {t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
