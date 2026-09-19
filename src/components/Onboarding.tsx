import { useState } from "react";
import { WEDDING } from "../config";
import { useI18n } from "../i18n";
import { describeError } from "../lib/errors";
import type { Api, Guest } from "../lib/types";
import { SOCIAL_META, normalizeSocial, type SocialKey } from "../lib/socials";
import { AvatarPicker } from "./AvatarPicker";
import { Icon } from "./Icon";
import { SocialPicker } from "./SocialPicker";

interface Props {
  api: Api;
  onJoined: (guest: Guest) => void;
}

export function Onboarding({ api, onJoined }: Props) {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<"name" | "social">("name");
  const [recover, setRecover] = useState(false);
  const [rName, setRName] = useState("");
  const [name, setName] = useState("");
  const [network, setNetwork] = useState<SocialKey | null>(null);
  const [handle, setHandle] = useState("");
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanHandle = network ? normalizeSocial(network, handle) : "";
  const displayName = mode === "social" ? cleanHandle : name.trim();
  const canJoin =
    mode === "social" ? !!network && !!cleanHandle : !!name.trim();

  const reconnect = async () => {
    if (!rName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      onJoined(await api.claimGuest(rName));
    } catch {
      setError(t("reconnectFailed"));
      setBusy(false);
    }
  };

  const join = async () => {
    if (!canJoin || busy) return;
    setBusy(true);
    setError(null);
    try {
      const guest = await api.createGuest(displayName, selfie?.blob);
      if (mode === "social" && network) {
        try {
          onJoined(
            await api.updateGuest(displayName, undefined, {
              [network]: cleanHandle,
            }),
          );
          return;
        } catch {
          /* joined without the link; they can add it in their profile */
        }
      }
      onJoined(guest);
    } catch (e) {
      const code = (e as { code?: string })?.code;
      setError(
        code === "23505" || /duplicate|unique/i.test(describeError(e))
          ? t("nameTaken")
          : describeError(e),
      );
      setBusy(false);
    }
  };

  return (
    <div className="onboarding">
      <div className="onboarding__glow" aria-hidden="true" />
      <button
        className="onboarding__lang"
        onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      >
        {lang === "fr" ? "English" : "Français"}
      </button>
      <div className="onboarding__card">
        <p className="eyebrow">{t("welcome")}</p>
        <h1 className="display">{WEDDING.couple}</h1>
        <div className="ornament onboarding__ornament">
          <span>✦</span>
        </div>
        <p className="onboarding__intro">{t("onboardingIntro")}</p>

        <AvatarPicker
          label={
            <>
              {t("addSelfie")} <span className="muted">({t("optional")})</span>
            </>
          }
          onPicked={(blob) =>
            setSelfie({ blob, url: URL.createObjectURL(blob) })
          }
          onError={setError}
        >
          {selfie ? (
            <img src={selfie.url} alt="" />
          ) : (
            <span className="selfie__icon">
              <Icon name="camera" size={34} strokeWidth={1.4} />
            </span>
          )}
        </AvatarPicker>
        {recover ? (
          <div className="onboarding__body">
            <p className="onboarding__intro" style={{ margin: 0 }}>
              <b>{t("reconnectTitle")}</b>
              <br />
              {t("reconnectHint")}
            </p>
            <input
              className="input"
              value={rName}
              placeholder={t("reconnectName")}
              maxLength={60}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setRName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void reconnect()}
            />
          </div>
        ) : (
          <>
            <div className="choose" role="radiogroup">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "name"}
                className={
                  "choose__btn" + (mode === "name" ? " choose__btn--on" : "")
                }
                onClick={() => setMode("name")}
              >
                {t("joinWithName")}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "social"}
                className={
                  "choose__btn" + (mode === "social" ? " choose__btn--on" : "")
                }
                onClick={() => setMode("social")}
              >
                {t("joinWithSocial")}
              </button>
            </div>

            <div className="onboarding__body" key={mode}>
              {mode === "name" ? (
                <label className="field">
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
              ) : (
                <div className="field">
                  <SocialPicker value={network} onChange={setNetwork} />
                  {network && (
                    <label
                      className="handlefield"
                      style={{
                        ["--brand" as string]: SOCIAL_META[network].color,
                      }}
                    >
                      <span className="handlefield__at">@</span>
                      <input
                        className="input handlefield__input"
                        value={handle}
                        placeholder={t("handlePlaceholder", {
                          network: SOCIAL_META[network].label,
                        })}
                        maxLength={60}
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoFocus
                        enterKeyHint="go"
                        onChange={(e) =>
                          setHandle(e.target.value.replace(/^@+/, ""))
                        }
                        onKeyDown={(e) => e.key === "Enter" && void join()}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {error && <p className="error">{error}</p>}

        {recover ? (
          <button
            className="btn btn--primary btn--block"
            onClick={reconnect}
            disabled={!rName.trim() || busy}
          >
            {busy ? t("joining") : t("reconnect")}
          </button>
        ) : (
          <button
            className="btn btn--primary btn--block"
            onClick={join}
            disabled={!canJoin || busy}
          >
            {busy ? t("joining") : t("join")}
          </button>
        )}
        <button
          className="onboarding__switch"
          type="button"
          onClick={() => {
            setRecover((r) => !r);
            setError(null);
          }}
        >
          {recover ? t("backToJoin") : t("alreadyJoined")}
        </button>
      </div>
    </div>
  );
}
