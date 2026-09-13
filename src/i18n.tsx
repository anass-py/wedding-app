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
  fromGallery: "Choose from gallery",
  post: "Post",
  postOne: "Post 1 photo",
  postMany: "Post {n} photos",
  posting: "Posting {i}/{n}…",
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
  aiPick: "AI pick",
  photosCount: "{n} photos",
  justNow: "just now",
  minutesAgo: "{n} min ago",
  hoursAgo: "{n} h ago",
  uploadFailed: "Upload failed. Check your connection and try again.",
  posted: "Posted!",
  openFull: "Open full size",
  demoBanner: "Demo mode — add your Supabase keys in .env to go live.",
  connecting: "Connecting…",
  hearts: "hearts",
  newPhotos: "{n} new",
  viewGrid: "Grid view",
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
  fromGallery: "Choisir dans la galerie",
  post: "Publier",
  postOne: "Publier 1 photo",
  postMany: "Publier {n} photos",
  posting: "Envoi {i}/{n}…",
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
  aiPick: "Choix de l'IA",
  photosCount: "{n} photos",
  justNow: "à l'instant",
  minutesAgo: "il y a {n} min",
  hoursAgo: "il y a {n} h",
  uploadFailed: "Échec de l'envoi. Vérifiez votre connexion et réessayez.",
  posted: "Publié !",
  openFull: "Ouvrir en taille réelle",
  demoBanner: "Mode démo — ajoutez vos clés Supabase dans .env pour passer en ligne.",
  connecting: "Connexion…",
  hearts: "cœurs",
  newPhotos: "{n} nouvelles",
  viewGrid: "Vue grille",
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
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
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
