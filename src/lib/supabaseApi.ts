import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import { processImage } from "./image";
import { approximateLocation, describeDevice } from "./device";
import { uid } from "./uid";
import { isVideoFile, processVideo, videoExt } from "./video";
import type { Api, Guest, Message, Photo, RealtimeHandlers, Score, Socials } from "./types";

/**
 * Production talks to the `public` tables and the `photos` bucket. Set VITE_DB_SCHEMA=dev and
 * VITE_STORAGE_BUCKET=photos-dev (local .env, Vercel "Preview") to work on a separate copy in
 * the same Supabase project without touching the real wall.
 */
const SCHEMA = (import.meta.env.VITE_DB_SCHEMA as string | undefined) || "public";
const BUCKET = (import.meta.env.VITE_STORAGE_BUCKET as string | undefined) || "photos";

const PHOTO_SELECT =
  "id, guest_id, kind, duration, path, thumb_path, width, height, caption, created_at, " +
  // guests!photos_guest_id_fkey: hearts also links photos↔guests, so the embed must name the FK.
  "guest:guests!photos_guest_id_fkey(id, name, avatar_path, socials), hearts(guest_id), photo_scores(score, theme, tags, reason)";

interface PhotoRow {
  id: string;
  guest_id: string;
  kind: "photo" | "video" | null;
  duration: number | string | null;
  path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  guest: GuestRow | GuestRow[] | null;
  hearts: { guest_id: string }[] | null;
  photo_scores: ScoreRow | ScoreRow[] | null;
}
interface GuestRow {
  id: string;
  name: string;
  avatar_path: string | null;
  socials?: Socials | null;
  created_at?: string;
}
const GUEST_SELECT = "id, name, avatar_path, socials";
function toGuest(g: GuestRow): Guest {
  return { id: g.id, name: g.name, avatar_path: g.avatar_path, socials: g.socials ?? {}, created_at: g.created_at };
}

const MESSAGE_SELECT = "id, guest_id, text, created_at, guest:guests!messages_guest_id_fkey(id, name, avatar_path, socials), message_hearts(guest_id)";
interface MessageRow {
  id: string;
  guest_id: string;
  text: string;
  created_at: string;
  guest: GuestRow | GuestRow[] | null;
  message_hearts: { guest_id: string }[] | null;
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
  const sb = createClient(url, anonKey, { db: { schema: SCHEMA } });
  let guest: Guest | null = null;
  let authId: string | null = null;
  let channelSeq = 0; // each subscribe() gets its own channel: reusing a topic after subscribe() throws

  function toPhoto(r: PhotoRow): Photo {
    const hearts = r.hearts ?? [];
    return {
      id: r.id,
      guest_id: r.guest_id,
      kind: r.kind === "video" ? "video" : "photo",
      duration: r.duration == null ? null : Number(r.duration),
      path: r.path,
      thumb_path: r.thumb_path,
      width: r.width,
      height: r.height,
      caption: r.caption,
      created_at: r.created_at,
      guest: toGuest(one(r.guest) ?? { id: r.guest_id, name: "?", avatar_path: null }),
      hearts: hearts.length,
      hearted: !!guest && hearts.some((h) => h.guest_id === guest!.id),
      score: toScore(one(r.photo_scores)),
    };
  }

  async function freshAnonymousSession() {
    const { data: anon, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    if (!anon.session) throw new Error("Anonymous sign-in returned no session");
    return anon.session;
  }

  /**
   * Reuse the stored session, but confirm the user still exists server-side: after a
   * data reset the phone may hold a session for a deleted user, which would make every
   * insert fail with a foreign-key error. In that case start over with a new one.
   */
  function toMessage(r: MessageRow): Message {
    const hearts = r.message_hearts ?? [];
    return {
      kind: "message",
      id: r.id,
      guest_id: r.guest_id,
      text: r.text,
      created_at: r.created_at,
      guest: toGuest(one(r.guest) ?? { id: r.guest_id, name: "?", avatar_path: null }),
      hearts: hearts.length,
      hearted: !!guest && hearts.some((h) => h.guest_id === guest!.id),
    };
  }

  async function fetchMessage(id: string): Promise<Message | null> {
    const { data, error } = await sb.from("messages").select(MESSAGE_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toMessage(data as unknown as MessageRow) : null;
  }

  async function ensureSession() {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      const { error } = await sb.auth.getUser();
      if (!error) return data.session;
      await sb.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
    return freshAnonymousSession();
  }

  /**
   * Same wire format as storage-js (multipart with a cacheControl field), but
   * through XHR so we can show real upload progress for big videos.
   */
  async function upload(path: string, blob: Blob, onProgress?: (f: number) => void) {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("No session");
    const type = blob.type || "application/octet-stream";
    const form = new FormData();
    form.append("cacheControl", "31536000");
    form.append("", new File([blob], path.split("/").pop() ?? "file", { type }));
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${url}/storage/v1/object/${BUCKET}/${path}`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", anonKey);
      xhr.setRequestHeader("x-upsert", "false");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () =>
        xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`Upload rejected (${xhr.status}) ${xhr.responseText.slice(0, 160)}`));
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.ontimeout = () => reject(new Error("Upload timed out"));
      xhr.timeout = 10 * 60_000;
      xhr.send(form);
    });
    onProgress?.(1);
  }

  /** Once a day per device: note what it is and roughly where (for the hosts only). */
  function registerDevice() {
    const key = "wedding.device.registered";
    try {
      const last = Number(localStorage.getItem(key) ?? 0);
      if (Date.now() - last < 24 * 3600_000) return;
    } catch {
      /* ignore */
    }
    void (async () => {
      const info = { ...describeDevice(), ...(await approximateLocation()) };
      const { error } = await sb.rpc("register_device", { p: info });
      if (!error) {
        try {
          localStorage.setItem(key, String(Date.now()));
        } catch {
          /* ignore */
        }
      }
    })();
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
      // Through guest_devices: a profile can be linked to several devices.
      const { data, error } = await sb.rpc("my_guest");
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as GuestRow | undefined;
      guest = row ? toGuest(row) : null;
      if (guest) registerDevice();
      return guest;
    },

    async createGuest(name, avatar) {
      if (!authId) throw new Error("init() first");
      let avatar_path: string | null = null;
      if (avatar) {
        avatar_path = `${authId}/avatar-${Date.now()}.jpg`;
        await upload(avatar_path, avatar);
      }
      let { data, error } = await sb
        .from("guests")
        .insert({ auth_id: authId, name: name.trim(), avatar_path })
        .select(GUEST_SELECT)
        .single();
      if (error?.code === "23503") {
        // Session belonged to a deleted user: get a new identity and try once more.
        await sb.auth.signOut({ scope: "local" }).catch(() => undefined);
        authId = (await freshAnonymousSession()).user.id;
        ({ data, error } = await sb
          .from("guests")
          .insert({ auth_id: authId, name: name.trim(), avatar_path: null })
          .select(GUEST_SELECT)
          .single());
      }
      if (error) throw error;
      guest = toGuest(data as GuestRow);
      registerDevice();
      return guest;
    },

    async updateGuest(name, avatar, socials) {
      if (!guest || !authId) throw new Error("Not registered");
      const patch: { name: string; avatar_path?: string; socials?: Socials } = { name: name.trim() };
      if (avatar) {
        patch.avatar_path = `${authId}/avatar-${Date.now()}.jpg`;
        await upload(patch.avatar_path, avatar);
      }
      if (socials) patch.socials = socials;
      const { data, error } = await sb.from("guests").update(patch).eq("id", guest.id).select(GUEST_SELECT).single();
      if (error) throw error;
      guest = toGuest(data as GuestRow);
      return guest;
    },

    async claimGuest(name) {
      if (!authId) throw new Error("init() first");
      const { data, error } = await sb.rpc("claim_guest", { p_name: name.trim() });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as GuestRow | undefined;
      if (!row) throw new Error("no guest with this name");
      guest = toGuest(row);
      registerDevice();
      return guest;
    },

    async listGuests() {
      const { data, error } = await sb.from("guests").select(`${GUEST_SELECT}, created_at`).order("created_at");
      if (error) throw error;
      return (data as GuestRow[]).map(toGuest);
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
        .channel(`wall-${++channelSeq}`)
        .on("postgres_changes", { event: "INSERT", schema: SCHEMA, table: "photos" }, async (p) => {
          const photo = await fetchOne((p.new as { id: string }).id).catch(() => null);
          if (photo) h.onPhotoInsert(photo);
        })
        .on("postgres_changes", { event: "DELETE", schema: SCHEMA, table: "photos" }, (p) => {
          h.onPhotoDelete((p.old as { id: string }).id);
        })
        .on("postgres_changes", { event: "INSERT", schema: SCHEMA, table: "hearts" }, (p) => {
          const r = p.new as { photo_id: string; guest_id: string };
          h.onHeart(r.photo_id, r.guest_id, 1);
        })
        .on("postgres_changes", { event: "DELETE", schema: SCHEMA, table: "hearts" }, (p) => {
          const r = p.old as { photo_id: string; guest_id: string };
          h.onHeart(r.photo_id, r.guest_id, -1);
        })
        .on("postgres_changes", { event: "INSERT", schema: SCHEMA, table: "messages" }, async (p) => {
          const m = await fetchMessage((p.new as { id: string }).id).catch(() => null);
          if (m) h.onMessageInsert?.(m);
        })
        .on("postgres_changes", { event: "DELETE", schema: SCHEMA, table: "messages" }, (p) => {
          h.onMessageDelete?.((p.old as { id: string }).id);
        })
        .on("postgres_changes", { event: "INSERT", schema: SCHEMA, table: "message_hearts" }, (p) => {
          const r = p.new as { message_id: string; guest_id: string };
          h.onMessageHeart?.(r.message_id, r.guest_id, 1);
        })
        .on("postgres_changes", { event: "DELETE", schema: SCHEMA, table: "message_hearts" }, (p) => {
          const r = p.old as { message_id: string; guest_id: string };
          h.onMessageHeart?.(r.message_id, r.guest_id, -1);
        })
        .on("postgres_changes", { event: "*", schema: SCHEMA, table: "photo_scores" }, (p) => {
          const r = p.new as ScoreRow & { photo_id?: string };
          const s = toScore(r);
          if (r.photo_id && s) h.onScore(r.photo_id, s);
        })
        .subscribe();
      return () => {
        void sb.removeChannel(channel);
      };
    },

    async uploadMedia(file, caption, onProgress) {
      if (!guest || !authId) throw new Error("Not registered");
      const base = `${authId}/${uid()}`;
      const thumb_path = `${base}_t.jpg`;
      let row: Record<string, unknown>;
      if (isVideoFile(file)) {
        const v = await processVideo(file);
        const path = `${base}.${videoExt(file)}`;
        await upload(thumb_path, v.poster);
        await upload(path, file, onProgress);
        row = { kind: "video", duration: Math.round(v.duration * 10) / 10, path, thumb_path, width: v.width, height: v.height };
      } else {
        const processed = await processImage(file);
        const path = `${base}.jpg`;
        await Promise.all([upload(path, processed.full, onProgress), upload(thumb_path, processed.thumb)]);
        row = { kind: "photo", path, thumb_path, width: processed.width, height: processed.height };
      }
      const { data, error } = await sb
        .from("photos")
        .insert({ guest_id: guest.id, caption: caption?.trim() || null, ...row })
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

    async listMessages() {
      const { data, error } = await sb.from("messages").select(MESSAGE_SELECT).order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return (data as unknown as MessageRow[]).map(toMessage);
    },

    async postMessage(text) {
      if (!guest) throw new Error("Not registered");
      const { data, error } = await sb.from("messages").insert({ guest_id: guest.id, text: text.trim() }).select("id").single();
      if (error) throw error;
      const m = await fetchMessage(data.id);
      if (!m) throw new Error("Message vanished after insert");
      return m;
    },

    async setMessageHeart(messageId, hearted) {
      if (!guest) throw new Error("Not registered");
      if (hearted) {
        const { error } = await sb.from("message_hearts").upsert({ message_id: messageId, guest_id: guest.id }, { onConflict: "message_id,guest_id", ignoreDuplicates: true });
        if (error) throw error;
      } else {
        const { error } = await sb.from("message_hearts").delete().eq("message_id", messageId).eq("guest_id", guest.id);
        if (error) throw error;
      }
    },

    async deleteMessage(id) {
      const { error } = await sb.from("messages").delete().eq("id", id);
      if (error) throw error;
    },
  };
  return api;
}
