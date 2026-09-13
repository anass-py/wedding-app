/**
 * In-memory stand-in for Supabase so the UI runs before any keys are set.
 * Generates colourful placeholder "photos" with the canvas API.
 */
import { THEMES } from "../config";
import { processImage } from "./image";
import type { Api, Guest, Photo, RealtimeHandlers } from "./types";

const NAMES = ["Nadia", "Omar", "Léa", "Youssef", "Ines", "Karim", "Sofia", "Adam"];
const EMOJI = ["💍", "💐", "🥂", "💃", "🎂", "🕺", "✨", "🌹", "🎶", "📸", "🍽️", "🎉"];

function makeImage(seed: number, size: number): string {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const h1 = (seed * 47) % 360;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, `hsl(${h1} 45% 28%)`);
  g.addColorStop(1, `hsl(${(h1 + 60) % 360} 55% 55%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.font = `${Math.round(size * 0.42)}px system-ui`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(EMOJI[seed % EMOJI.length], size / 2, size / 2 + size * 0.02);
  return c.toDataURL("image/jpeg", 0.8);
}

export function createDemoApi(): Api {
  const guests: Guest[] = NAMES.map((name, i) => ({ id: `g${i}`, name, avatar_path: null }));
  let me: Guest | null = null;
  const urls = new Map<string, string>();
  let photos: Photo[] = [];
  let handlers: RealtimeHandlers | null = null;

  const count = 34;
  for (let i = 0; i < count; i++) {
    const id = `demo-${i}`;
    urls.set(`${id}.jpg`, makeImage(i, 900));
    urls.set(`${id}_t.jpg`, makeImage(i, 512));
    const g = guests[i % guests.length];
    const scored = i % 3 !== 0;
    photos.push({
      id,
      guest_id: g.id,
      path: `${id}.jpg`,
      thumb_path: `${id}_t.jpg`,
      width: 900,
      height: 900,
      caption: i % 5 === 0 ? "Quel moment ✨" : null,
      created_at: new Date(Date.now() - i * 4 * 60_000).toISOString(),
      guest: g,
      hearts: (i * 7) % 9,
      hearted: false,
      score: scored
        ? {
            score: Math.round(((i * 37) % 70) / 10 + 3),
            theme: THEMES[i % THEMES.length],
            tags: ["demo", "placeholder"],
            reason: "Demo score — run scripts/rank.ts for real AI scoring.",
          }
        : null,
    });
  }

  return {
    isDemo: true,
    get guest() {
      return me;
    },
    async init() {
      try {
        const saved = localStorage.getItem("wedding.demo.guest");
        me = saved ? (JSON.parse(saved) as Guest) : null;
      } catch {
        me = null;
      }
      return me;
    },
    async createGuest(name, avatar) {
      me = { id: "me", name: name.trim(), avatar_path: null };
      if (avatar) {
        const url = URL.createObjectURL(avatar);
        urls.set("me-avatar.jpg", url);
        me.avatar_path = "me-avatar.jpg";
      }
      try {
        localStorage.setItem("wedding.demo.guest", JSON.stringify({ ...me, avatar_path: null }));
      } catch {
        /* ignore */
      }
      return me;
    },
    async listPhotos() {
      return photos.map((p) => ({ ...p }));
    },
    subscribe(h) {
      handlers = h;
      return () => {
        handlers = null;
      };
    },
    async uploadPhoto(file, caption) {
      if (!me) throw new Error("Not registered");
      const processed = await processImage(file);
      const id = crypto.randomUUID();
      urls.set(`${id}.jpg`, URL.createObjectURL(processed.full));
      urls.set(`${id}_t.jpg`, URL.createObjectURL(processed.thumb));
      const photo: Photo = {
        id,
        guest_id: me.id,
        path: `${id}.jpg`,
        thumb_path: `${id}_t.jpg`,
        width: processed.width,
        height: processed.height,
        caption: caption?.trim() || null,
        created_at: new Date().toISOString(),
        guest: me,
        hearts: 0,
        hearted: false,
        score: null,
      };
      photos = [photo, ...photos];
      // Fake the ranker: score it a few seconds later so the realtime path is exercised.
      setTimeout(() => {
        const s = { score: 7.5, theme: "guests", tags: ["demo"], reason: "Demo score." };
        const p = photos.find((x) => x.id === id);
        if (p) p.score = s;
        handlers?.onScore(id, s);
      }, 4000);
      return photo;
    },
    async setHeart(photoId, hearted) {
      const p = photos.find((x) => x.id === photoId);
      if (p) {
        p.hearted = hearted;
        p.hearts += hearted ? 1 : -1;
      }
    },
    async deletePhoto(photo) {
      photos = photos.filter((p) => p.id !== photo.id);
    },
    urlFor(path) {
      return urls.get(path) ?? "";
    },
  };
}
