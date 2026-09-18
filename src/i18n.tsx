import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Theme } from "./config";

export type Lang = "en" | "fr";

const en = {
  welcome: "The wedding of",
  onboardingIntro: "Tonight, you’re the photographer. Every shot lands on the wall — live.",
  yourName: "What do we call you?",
  namePlaceholder: "Your name",
  addSelfie: "A selfie for your card",
  optional: "optional",
  join: "I’m here",
  joinWithName: "Name",
  joinWithSocial: "Social",
  or: "or",
  handlePlaceholder: "your {network} handle",
  socialNote: "Just your handle. Nothing else, promise. It becomes your name on the wall.",
  joining: "One second…",
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
  retake: "Again",
  useThis: "Keep it",
  cameraDenied: "Camera access was refused. Allow it in your browser settings, or pick from the gallery.",
  cameraUnavailable: "The camera isn't available here. Pick from the gallery instead.",
  videoHint: "Videos up to {s} s / {mb} MB",
  videoTooLarge: "That video is too large (max {mb} MB).",
  videoTooLong: "Keep videos under {s} seconds.",
  unsupportedVideo: "This video can't be read on this phone.",
  fromGallery: "Gallery",
  post: "Post",
  postOne: "Post",
  postMany: "Post {n}",
  posting: "Sending {i}/{n}… {p}%",
  caption: "Say something… or don’t",
  cancel: "Cancel",
  addMore: "Add more",
  by: "by",
  delete: "Delete",
  confirmDelete: "Delete this photo for everyone?",
  emptyWall: "Nothing here yet.",
  emptyWallHint: "First photo — yours?",
  allThemes: "All",
  topEmpty: "The podium is under construction. Post, like, repeat.",
  topEyebrow: "Tonight’s podium",
  topSub: "Chosen by your ❤️ and one very picky judge.",
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
  look: "Theme",
  language: "Language",
  midnight: "Dark",
  ivory: "Light",
  posted: "Posted!",
  celebrateOne: "On the wall. For everyone. Now.",
  celebrateMany: "{n} photos on the wall. For everyone. Now.",
  openFull: "Save",
  share: "Share",
  mute: "Mute",
  unmute: "Unmute",
  sound: "Sound",
  tapForSound: "Tap the speaker for sound",
  fit: "Show the whole photo",
  demoBanner: "Demo mode — add your Supabase keys in .env to go live.",
  connecting: "Opening the wall…",
  retry: "Try again",
  schemaOutOfDate: "The database needs an update: in Supabase → SQL Editor, run supabase/schema.sql once, then try again.",
  hearts: "hearts",
  newPhotos: "{n} new",
  viewGrid: "Grid view",
  welcomeName: "Welcome, {name}",
  welcomeSub: "The wall is yours.",
  profile: "Your card",
  yourPhotos: "photos",
  heartsReceived: "hearts received",
  videosLabel: "videos",
  bestScore: "best score",
  socialsTitle: "Your networks",
  socialsHint: "for those who’ll want to find you",
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
  welcome: "Le mariage de",
  onboardingIntro: "Ce soir, c’est toi le photographe. Chaque photo rejoint le mur — en direct.",
  yourName: "Comment on t’appelle ?",
  namePlaceholder: "Ton prénom",
  addSelfie: "Un selfie pour ta carte",
  optional: "optionnel",
  join: "Je suis là",
  joinWithName: "Prénom",
  joinWithSocial: "Réseau",
  or: "ou",
  handlePlaceholder: "ton pseudo {network}",
  socialNote: "Juste ton pseudo. Rien d’autre, promis. Il devient ton nom sur le mur.",
  joining: "Une seconde…",
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
  retake: "Encore",
  useThis: "Je garde",
  cameraDenied: "L’accès à la caméra a été refusé. Autorise-le dans les réglages, ou passe par la galerie.",
  cameraUnavailable: "Pas de caméra ici. Passe par la galerie.",
  videoHint: "Vidéos jusqu'à {s} s / {mb} Mo",
  videoTooLarge: "Cette vidéo est trop lourde (max {mb} Mo).",
  videoTooLong: "Garde les vidéos sous {s} secondes.",
  unsupportedVideo: "Cette vidéo ne se lit pas sur ce téléphone.",
  fromGallery: "Galerie",
  post: "Publier",
  postOne: "Publier",
  postMany: "Publier ({n})",
  posting: "Envoi {i}/{n}… {p}%",
  caption: "Dis quelque chose… ou pas",
  cancel: "Annuler",
  addMore: "Ajouter",
  by: "par",
  delete: "Supprimer",
  confirmDelete: "Supprimer cette photo pour tout le monde ?",
  emptyWall: "Rien encore.",
  emptyWallHint: "La première photo, c’est la tienne ?",
  allThemes: "Tout",
  topEmpty: "Le podium se construit. Poste, like, recommence.",
  topEyebrow: "Le palmarès de la soirée",
  topSub: "Élues par vos ❤️ et un juge très exigeant.",
  aiPick: "Choix de l'IA",
  photosCount: "{n} photos",
  videosCount: "{n} vidéos",
  photoOne: "1 photo",
  videoOne: "1 vidéo",
  live: "en direct",
  justNow: "à l'instant",
  minutesAgo: "il y a {n} min",
  hoursAgo: "il y a {n} h",
  uploadFailed: "L’envoi a échoué. Vérifie ta connexion et réessaie.",
  unsupportedImage: "Ce fichier ne passe pas. Essaie une autre photo.",
  look: "Thème",
  language: "Langue",
  midnight: "Sombre",
  ivory: "Clair",
  posted: "Publié !",
  celebrateOne: "Sur le mur. Pour tout le monde. Maintenant.",
  celebrateMany: "{n} photos sur le mur. Pour tout le monde. Maintenant.",
  openFull: "Enregistrer",
  share: "Partager",
  mute: "Muet",
  unmute: "Son",
  sound: "Son",
  tapForSound: "Touche le haut-parleur pour le son",
  fit: "Voir la photo entière",
  demoBanner: "Mode démo — clés Supabase manquantes dans .env",
  connecting: "Ouverture du mur…",
  retry: "Réessayer",
  schemaOutOfDate: "La base de données doit être mise à jour : dans Supabase → SQL Editor, exécute supabase/schema.sql une fois, puis réessaie.",
  hearts: "cœurs",
  newPhotos: "{n} nouvelles",
  viewGrid: "Vue grille",
  welcomeName: "Bienvenue, {name}",
  welcomeSub: "Le mur est à toi.",
  profile: "Ta carte",
  yourPhotos: "photos",
  heartsReceived: "cœurs reçus",
  videosLabel: "vidéos",
  bestScore: "meilleure note",
  socialsTitle: "Tes réseaux",
  socialsHint: "pour ceux qui voudront te retrouver",
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
