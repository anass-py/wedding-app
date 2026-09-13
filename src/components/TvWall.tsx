import QRCode from "qrcode";
import { useEffect, useMemo, useRef, useState } from "react";
import { WEDDING } from "../config";
import { createApi } from "../lib/api";
import type { Photo } from "../lib/types";
import { Avatar } from "./Avatar";

const SLIDE_MS = 7000;
const VIDEO_MAX_MS = 20_000;
const LOOP_SIZE = 80; // newest N photos cycle; new arrivals jump the queue

interface Slide {
  photo: Photo;
  isNew: boolean;
}

/**
 * Full-screen live slideshow for a TV / projector at the venue. Open /tv (or ?tv).
 * No registration needed — it only reads.
 */
export function TvWall() {
  const api = useMemo(createApi, []);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [slide, setSlide] = useState<Slide | null>(null);
  const [qr, setQr] = useState("");
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photosRef = useRef<Photo[]>([]);
  const queue = useRef<Photo[]>([]);
  const cursor = useRef(-1);
  photosRef.current = photos;

  useEffect(() => {
    QRCode.toDataURL(`${location.origin}/`, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: "M",
      color: { dark: "#f4ede3ff", light: "#00000000" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .init()
      .then(() => api.listPhotos())
      .then((list) => {
        if (!cancelled) setPhotos(list);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    const unsubscribe = api.subscribe({
      onPhotoInsert: (photo) => {
        setPhotos((prev) => (prev.some((p) => p.id === photo.id) ? prev : [photo, ...prev]));
        queue.current.push(photo);
      },
      onPhotoDelete: (id) => setPhotos((prev) => prev.filter((p) => p.id !== id)),
      onHeart: (photoId, _guest, delta) =>
        setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, hearts: Math.max(0, p.hearts + delta) } : p))),
      onScore: (photoId, score) => setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, score } : p))),
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [api]);

  const advance = () => {
    const fresh = queue.current.shift();
    if (fresh) {
      setSlide({ photo: fresh, isNew: true });
      return;
    }
    const loop = photosRef.current.slice(0, LOOP_SIZE);
    if (loop.length === 0) return;
    cursor.current = (cursor.current + 1) % loop.length;
    setSlide({ photo: loop[cursor.current], isNew: false });
  };

  // Each slide schedules the next one: photos stay SLIDE_MS, videos play out (capped).
  useEffect(() => {
    if (paused) return;
    if (!slide) {
      advance();
      return;
    }
    const ms = slide.photo.kind === "video" ? Math.min(VIDEO_MAX_MS, ((slide.photo.duration ?? 10) + 0.5) * 1000) : SLIDE_MS;
    const id = window.setTimeout(advance, ms);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, slide, photos.length > 0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (error) return <div className="center error">{error}</div>;

  return (
    <div className="tv" onClick={() => setPaused((p) => !p)}>
      {slide && (
        <>
          <div key={"bg" + slide.photo.id} className="tv__bg" style={{ backgroundImage: `url(${api.urlFor(slide.photo.thumb_path)})` }} />
          <div key={slide.photo.id} className="tv__slide">
            {slide.photo.kind === "video" ? (
              <video src={api.urlFor(slide.photo.path)} poster={api.urlFor(slide.photo.thumb_path)} autoPlay muted playsInline onEnded={advance} />
            ) : (
              <img src={api.urlFor(slide.photo.path)} alt="" />
            )}
          </div>
          <div key={"cap" + slide.photo.id} className="tv__caption">
            <Avatar guest={slide.photo.guest} urlFor={api.urlFor} size={52} />
            <div className="tv__caption-text">
              <div className="tv__name">
                {slide.photo.guest.name}
                {slide.isNew && <span className="tv__new">NEW</span>}
              </div>
              {slide.photo.caption && <div className="tv__cap">{slide.photo.caption}</div>}
              {slide.photo.hearts > 0 && <div className="tv__hearts">♥ {slide.photo.hearts}</div>}
            </div>
          </div>
        </>
      )}
      {!slide && photos.length === 0 && <div className="tv__waiting">{WEDDING.couple}</div>}

      <div className="tv__brand">
        <div className="tv__live">
          <span className="tv__dot" /> LIVE · {photos.length}
        </div>
        <div className="tv__couple">{WEDDING.couple}</div>
        {WEDDING.hashtag && <div className="tv__hashtag">{WEDDING.hashtag}</div>}
      </div>

      <div className="tv__qr">
        {qr && <img src={qr} alt="QR code" />}
        <div className="tv__qr-text">
          <div>Scan to share your photos</div>
          <div className="muted">Scannez pour partager vos photos</div>
        </div>
      </div>
      {paused && <div className="tv__paused">❚❚</div>}
    </div>
  );
}
