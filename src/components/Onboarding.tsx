import { useRef, useState } from "react";
import { WEDDING } from "../config";
import { useI18n } from "../i18n";
import { processAvatar } from "../lib/image";
import type { Api, Guest } from "../lib/types";
import { Icon } from "./Icon";

interface Props {
  api: Api;
  onJoined: (guest: Guest) => void;
}

export function Onboarding({ api, onJoined }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onSelfie = async (file: File | undefined) => {
    if (!file) return;
    try {
      const blob = await processAvatar(file);
      setSelfie({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const join = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      onJoined(await api.createGuest(trimmed, selfie?.blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__card">
        <p className="eyebrow">{t("welcome")}</p>
        <h1 className="display">{WEDDING.couple}</h1>
        <div className="ornament onboarding__ornament">
          <span>✦</span>
        </div>
        {WEDDING.hashtag && <p className="muted">{WEDDING.hashtag}</p>}
        <p className="onboarding__intro">{t("onboardingIntro")}</p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="user"
          hidden
          onChange={(e) => {
            void onSelfie(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <button className="selfie" onClick={() => fileRef.current?.click()} type="button">
          {selfie ? (
            <img src={selfie.url} alt="" />
          ) : (
            <span className="selfie__icon">
              <Icon name="camera" size={34} strokeWidth={1.4} />
            </span>
          )}
          <span className="selfie__label">
            {t("addSelfie")} <span className="muted">({t("optional")})</span>
          </span>
        </button>

        <label className="field">
          <span>{t("yourName")}</span>
          <input
            className="input"
            value={name}
            placeholder={t("namePlaceholder")}
            maxLength={40}
            autoComplete="given-name"
            enterKeyHint="go"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void join()}
          />
        </label>

        {error && <p className="error">{error}</p>}

        <button className="btn btn--primary btn--block" onClick={join} disabled={!name.trim() || busy}>
          {busy ? t("joining") : t("join")}
        </button>
      </div>
    </div>
  );
}
