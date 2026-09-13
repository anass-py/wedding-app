import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { processImage } from "./image";
import type { Api, Guest, Photo, RealtimeHandlers, Score } from "./types";

const BUCKET = "photos";

const PHOTO_SELECT =
  "id, guest_id, path, thumb_path, width, height, caption, created_at, " +
  "guest:guests(id, name, avatar_path), hearts(guest_id), photo_scores(score, theme, tags, reason)";

interface PhotoRow {
  id: string;
  guest_id: string;
  path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  guest: Guest | Guest[] | null;
  hearts: { guest_id: string }[] | null;
  photo_scores: ScoreRow | ScoreRow[] | null;
}
interface ScoreRow {
  score: number | string;
  theme: string;
  tags: string[] | null;
  reason: string | null;
}

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function toScore(r: ScoreRow | null): Score | null {
  return r ? { score: Number(r.score), theme: r.theme, tags: r.tags ?? [], reason: r.reason } : null;
}

export function createSupabaseApi(url: string, anonKey: string): Api {
  const sb = createClient(url, anonKey);
  let guest: Guest | null = null;
  let authId: string | null = null;

  function toPhoto(r: PhotoRow): Photo {
    const hearts = r.hearts ?? [];
    return {
      id: r.id,
      guest_id: r.guest_id,
      path: r.path,
      thumb_path: r.thumb_path,
      width: r.width,
      height: r.height,
      caption: r.caption,
      created_at: r.created_at,
      guest: one(r.guest) ?? { id: r.guest_id, name: "?", avatar_path: null },
      hearts: hearts.length,
      hearted: !!guest && hearts.some((h) => h.guest_id === guest!.id),
      score: toScore(one(r.photo_scores)),
    };
  }

  async function ensureSession() {
    const { data } = await sb.auth.getSession();
    if (data.session) return data.session;
    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    if (!anon.session) throw new Error("Anonymous sign-in returned no session");
    return anon.session;
  }

  async function upload(path: string, blob: Blob) {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
  }

  async function fetchOne(id: string): Promise<Photo | null> {
    const { data, error } = await sb.from("photos").select(PHOTO_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toPhoto(data as unknown as PhotoRow) : null;
  }

  const api: Api = {
    isDemo: false,
    get guest() {
      return guest;
    },

    async init() {
      const session = await ensureSession();
      authId = session.user.id;
      const { data, error } = await sb
        .from("guests")
        .select("id, name, avatar_path")
        .eq("auth_id", authId)
        .maybeSingle();
      if (error) throw error;
      guest = data ?? null;
      return guest;
    },

    async createGuest(name, avatar) {
      if (!authId) throw new Error("init() first");
      let avatar_path: string | null = null;
      if (avatar) {
        avatar_path = `${authId}/avatar-${Date.now()}.jpg`;
        await upload(avatar_path, avatar);
      }
      const { data, error } = await sb
        .from("guests")
        .insert({ auth_id: authId, name: name.trim(), avatar_path })
        .select("id, name, avatar_path")
        .single();
      if (error) throw error;
      guest = data;
      return data;
    },

    async listPhotos() {
      const { data, error } = await sb
        .from("photos")
        .select(PHOTO_SELECT)
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;
      return (data as unknown as PhotoRow[]).map(toPhoto);
    },

    subscribe(h: RealtimeHandlers) {
      const channel: RealtimeChannel = sb
        .channel("wall")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "photos" }, async (p) => {
          const photo = await fetchOne((p.new as { id: string }).id).catch(() => null);
          if (photo) h.onPhotoInsert(photo);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "photos" }, (p) => {
          h.onPhotoDelete((p.old as { id: string }).id);
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "hearts" }, (p) => {
          const r = p.new as { photo_id: string; guest_id: string };
          h.onHeart(r.photo_id, r.guest_id, 1);
        })
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "hearts" }, (p) => {
          const r = p.old as { photo_id: string; guest_id: string };
          h.onHeart(r.photo_id, r.guest_id, -1);
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "photo_scores" }, (p) => {
          const r = p.new as ScoreRow & { photo_id?: string };
          const s = toScore(r);
          if (r.photo_id && s) h.onScore(r.photo_id, s);
        })
        .subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },

    async uploadPhoto(file, caption) {
      if (!guest || !authId) throw new Error("Not registered");
      const processed = await processImage(file);
      const base = `${authId}/${crypto.randomUUID()}`;
      const path = `${base}.jpg`;
      const thumb_path = `${base}_t.jpg`;
      await Promise.all([upload(path, processed.full), upload(thumb_path, processed.thumb)]);
      const { data, error } = await sb
        .from("photos")
        .insert({
          guest_id: guest.id,
          path,
          thumb_path,
          width: processed.width,
          height: processed.height,
          caption: caption?.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const photo = await fetchOne(data.id);
      if (!photo) throw new Error("Photo vanished after insert");
      return photo;
    },

    async setHeart(photoId, hearted) {
      if (!guest) throw new Error("Not registered");
      if (hearted) {
        const { error } = await sb
          .from("hearts")
          .upsert({ photo_id: photoId, guest_id: guest.id }, { onConflict: "photo_id,guest_id", ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await sb.from("hearts").delete().eq("photo_id", photoId).eq("guest_id", guest.id);
        if (error) throw error;
      }
    },

    async deletePhoto(photo) {
      const { error } = await sb.from("photos").delete().eq("id", photo.id);
      if (error) throw error;
      await sb.storage.from(BUCKET).remove([photo.path, photo.thumb_path]);
    },

    urlFor(path) {
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
  };
  return api;
}
