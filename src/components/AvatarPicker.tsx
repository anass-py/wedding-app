import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n";
import { processAvatar } from "../lib/image";
import { Camera, isCameraSupported } from "./Camera";
import { Icon } from "./Icon";

interface Props {
  /** The avatar/selfie preview to render inside the tappable area. */
  children: ReactNode;
  label: ReactNode;
  onPicked: (blob: Blob) => void;
  onError: (msg: string) => void;
}

/**
 * Tap the avatar → choose Camera (in-app selfie camera when available, else the
 * phone's own) or Gallery. Returns a square-cropped JPEG blob.
 */
export function AvatarPicker({ children, label, onPicked, onError }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const nativeRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const inApp = isCameraSupported();

  const handle = async (file: File | undefined) => {
    setOpen(false);
    if (!file) return;
    try {
      onPicked(await processAvatar(file));
    } catch {
      onError(t("unsupportedImage"));
    }
  };

  return (
    <div className="avatarpick">
      <input ref={nativeRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { void handle(e.target.files?.[0]); e.target.value = ""; }} />
      <button className="selfie" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {children}
        <span className="selfie__label">{label}</span>
      </button>
      {open && (
        <div className="avatarpick__row" role="group">
          <button className="pill" type="button" onClick={() => (inApp ? setCameraOpen(true) : nativeRef.current?.click())}>
            <Icon name="camera" size={16} /> {t("camera")}
          </button>
          <button className="pill" type="button" onClick={() => galleryRef.current?.click()}>
            <Icon name="image" size={16} /> {t("gallery")}
          </button>
        </div>
      )}
      {cameraOpen && (
        <Camera
          photoOnly
          initialFacing="user"
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            void handle(file);
          }}
        />
      )}
    </div>
  );
}
