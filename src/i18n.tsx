import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Theme } from "./config";

export type Lang = "en" | "fr";

const en = {
  welcome: "Welcome to the wedding of",
  onboardingIntro: "Share the moments you capture with everyone here tonight.",
  yourName: "Your first name",
  namePlaceholder: "e.g. Nadia",
  addSelfie: "Add a selfie",
  optional: "optional",
  join: "Join the wall",
  joining: "Joining…",
  wall: "Wall",
  top: "Top 5",
  takePhoto: "Take a photo",
  recordVideo: "Record a video",
  camera: "Camera",
  gallery: "Gallery",
  cameraHint: "Tap for a photo, hold for a video",
  shutterHint: "Tap = photo · Hold = video · Double-tap = flip",
  stop: "Stop",
  releaseToStop: "Recording · Tap ● to stop · Double-tap to flip",
  flipCamera: "Flip camera",
  retake: "Retake",
  useThis: "Use this",
  cameraDenied: "Camera access was refused. Allow it in your browser settings, or pick from the gallery.",
  cameraUnavailable: "The camera isn't available here. Pick from the gallery instead.",
  videoHint: "Videos up to {s} s / {mb} MB",
  videoTooLarge: "That video is too large (max {mb} MB).",
  videoTooLong: "Keep videos under {s} seconds.",
  unsupportedVideo: "This video can't be read on this phone.",
  fromGallery: "Choose from gallery",
  post: "Post",
  postOne: "Post 1 photo",
  postMany: "Post {n} photos",
  posting: "Posting {i}/{n}… {p}%",
  caption: "Add a caption",
  cancel: "Cancel",
  addMore: "Add more",
  by: "by",
  delete: "Delete",
  confirmDelete: "Delete this photo for everyone?",
  emptyWall: "No photos yet. Be the first!",
  emptyWallHint: "Tap + to take a photo or import from your gallery.",
  allThemes: "All",
  topEmpty: "The top photos appear once a few photos have been posted.",
  topEyebrow: "Tonight's favourites",
  topSub: "Picked by our AI judge and your ❤️",
  aiPick: "AI pick",
  photosCount: "{n} photos",
  videosCount: "{n} videos",
  photoOne: "1 photo",
  videoOne: "1 video",
  live: "live",
  justNow: "just now",
  minutesAgo: "{n} min ago",
  hoursAgo: "{n} h ago",
  uploadFailed: "Upload failed. Check your connection and try again.",
  unsupportedImage: "This file type isn't supported. Try another photo.",
  look: "Look",
  language: "Language",
  midnight: "Midnight",
  ivory: "Ivory",
  posted: "Posted!",
  celebrateOne: "It's on the wall for everyone.",
  celebrateMany: "{n} photos are on the wall for everyone.",
  openFull: "Save",
  share: "Share",
  mute: "Mute",
  unmute: "Unmute",
  sound: "Sound",
  tapForSound: "Tap the speaker for sound",
  fit: "Show the whole photo",
  demoBanner: "Demo mode — add your Supabase keys in .env to go live.",
  connecting: "Connecting…",
  retry: "Try again",
  schemaOutOfDate: "The database needs an update: in Supabase → SQL Editor, run supabase/schema.sql once, then try again.",
  hearts: "hearts",
  newPhotos: "{n} new",
  viewGrid: "Grid view",
  welcomeName: "Welcome, {name}",
  welcomeSub: "Every photo you post appears here for everyone.",
  profile: "Your profile",
  yourPhotos: "photos",
  heartsReceived: "hearts received",
  videosLabel: "videos",
  bestScore: "best score",
  socialsTitle: "Your links",
  socialsHint: "Optional — shown on your guest card",
  website: "Website",
  changeSelfie: "Change selfie",
  save: "Save",
  saved: "Saved",
  installTitle: "Add to your home screen",
  installIos: "Tap Share, then \"Add to Home Screen\".",
  installAndroid: "Open the browser menu, then \"Install app\".",
  viewBubbles: "Bubble view",
  theme: {
    couple: "Bride & Groom",
    ceremony: "Ceremony",
    decoration: "Decoration",
    guests: "Guests",
    dance: "Dance floor",
    food: "Food & drinks",
    details: "Details",
    venue: "Venue",
    other: "Other",
  } satisfies Record<Theme, string>,
};

type Dict = typeof en;

const fr: Dict = {
  welcome: "Bienvenue au mariage de",
  onboardingIntro: "Partagez les moments que vous capturez avec tout le monde ce soir.",
  yourName: "Votre prénom",
  namePlaceholder: "ex. Nadia",
  addSelfie: "Ajouter un selfie",
  optional: "optionnel",
  join: "Rejoindre le mur",
  joining: "Connexion…",
  wall: "Mur",
  top: "Top 5",
  takePhoto: "Prendre une photo",
  recordVideo: "Filmer une vidéo",
  camera: "Caméra",
  gallery: "Galerie",
  cameraHint: "Touchez pour une photo, maintenez pour une vidéo",
  shutterHint: "Touchez = photo · Maintenez = vidéo · Double-touchez = retourner",
  stop: "Arrêter",
  releaseToStop: "Enregistrement · Touchez ● pour arrêter · Double-touchez pour retourner",
  flipCamera: "Changer de caméra",
  retake: "Refaire",
  useThis: "Utiliser",
  cameraDenied: "L'accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, ou choisissez dans la galerie.",
  cameraUnavailable: "La caméra n'est pas disponible ici. Choisissez dans la galerie.",
  videoHint: "Vidéos jusqu'à {s} s / {mb} Mo",
  videoTooLarge: "Cette vidéo est trop lourde (max {mb} Mo).",
  videoTooLong: "Gardez les vidéos sous {s} secondes.",
  unsupportedVideo: "Cette vidéo ne peut pas être lue sur ce téléphone.",
  fromGallery: "Choisir dans la galerie",
  post: "Publier",
  postOne: "Publier 1 photo",
  postMany: "Publier {n} photos",
  posting: "Envoi {i}/{n}… {p}%",
  caption: "Ajouter une légende",
  cancel: "Annuler",
  addMore: "Ajouter",
  by: "par",
  delete: "Supprimer",
  confirmDelete: "Supprimer cette photo pour tout le monde ?",
  emptyWall: "Pas encore de photos. Soyez le premier !",
  emptyWallHint: "Appuyez sur + pour prendre une photo ou importer depuis votre galerie.",
  allThemes: "Tout",
  topEmpty: "Le top apparaîtra dès que quelques photos auront été publiées.",
  topEyebrow: "Les favoris de la soirée",
  topSub: "Choisies par notre juge IA et vos ❤️",
  aiPick: "Choix de l'IA",
  photosCount: "{n} photos",
  videosCount: "{n} vidéos",
  photoOne: "1 photo",
  videoOne: "1 vidéo",
  live: "en direct",
  justNow: "à l'instant",
  minutesAgo: "il y a {n} min",
  hoursAgo: "il y a {n} h",
  uploadFailed: "Échec de l'envoi. Vérifiez votre connexion et réessayez.",
  unsupportedImage: "Ce type de fichier n'est pas pris en charge. Essayez une autre photo.",
  look: "Style",
  language: "Langue",
  midnight: "Minuit",
  ivory: "Ivoire",
  posted: "Publié !",
  celebrateOne: "C'est sur le mur, pour tout le monde.",
  celebrateMany: "{n} photos sont sur le mur, pour tout le monde.",
  openFull: "Enregistrer",
  share: "Partager",
  mute: "Muet",
  unmute: "Son",
  sound: "Son",
  tapForSound: "Touchez le haut-parleur pour le son",
  fit: "Voir la photo entière",
  demoBanner: "Mode démo — clés Supabase manquantes dans .env",
  connecting: "Connexion…",
  retry: "Réessayer",
  schemaOutOfDate: "La base de données doit être mise à jour : dans Supabase → SQL Editor, exécutez supabase/schema.sql une fois, puis réessayez.",
  hearts: "cœurs",
  newPhotos: "{n} nouvelles",
  viewGrid: "Vue grille",
  welcomeName: "Bienvenue, {name}",
  welcomeSub: "Chaque photo que vous publiez apparaît ici pour tout le monde.",
  profile: "Votre profil",
  yourPhotos: "photos",
  heartsReceived: "cœurs reçus",
  videosLabel: "vidéos",
  bestScore: "meilleure note",
  socialsTitle: "Vos réseaux",
  socialsHint: "Optionnel — affichés sur votre carte",
  website: "Site web",
  changeSelfie: "Changer le selfie",
  save: "Enregistrer",
  saved: "Enregistré",
  installTitle: "Ajouter à l'écran d'accueil",
  installIos: "Touchez Partager, puis « Sur l'écran d'accueil ».",
  installAndroid: "Ouvrez le menu du navigateur, puis « Installer l'application ».",
  viewBubbles: "Vue bulles",
  theme: {
    couple: "Les mariés",
    ceremony: "Cérémonie",
    decoration: "Décoration",
    guests: "Invités",
    dance: "Piste de danse",
    food: "Repas",
    details: "Détails",
    venue: "Lieu",
    other: "Autres",
  } satisfies Record<Theme, string>,
};

const dict: Record<Lang, Dict> = { en, fr };
type Key = Exclude<keyof Dict, "theme">;

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  themeName: (theme: string) => string;
}

const I18nContext = createContext<I18n | null>(null);
const STORAGE_KEY = "wedding.lang";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch {
    /* private mode */
  }
  return "fr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo<I18n>(() => {
    const d: Dict = dict[lang];
    return {
      lang,
      setLang,
      t: (key, vars) => {
        let s: string = d[key];
        if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
        return s;
      },
      themeName: (theme) => (d.theme as Record<string, string>)[theme] ?? theme,
    };
  }, [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
