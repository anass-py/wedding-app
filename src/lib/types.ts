export interface Guest {
  id: string;
  name: string;
  avatar_path: string | null;
}

export interface Score {
  score: number; // 0-10
  theme: string;
  tags: string[];
  reason: string | null;
}

export interface Photo {
  id: string;
  guest_id: string;
  /** "photo" or "video" — for videos `path` is the video and `thumb_path` its poster frame. */
  kind: "photo" | "video";
  duration: number | null;
  path: string;
  thumb_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
  guest: Guest;
  hearts: number;
  /** Whether the current guest hearted it. */
  hearted: boolean;
  score: Score | null;
}

export interface RealtimeHandlers {
  onPhotoInsert: (photo: Photo) => void;
  onPhotoDelete: (id: string) => void;
  /** delta is +1 or -1; guestId lets the UI ignore its own optimistic updates. */
  onHeart: (photoId: string, guestId: string, delta: 1 | -1) => void;
  onScore: (photoId: string, score: Score) => void;
}

export interface Api {
  /** True when running without Supabase keys (in-memory demo data). */
  readonly isDemo: boolean;
  /** Current guest, once init()/createGuest() resolved. */
  readonly guest: Guest | null;
  /** Ensure an auth session; return the guest profile if one exists on this device. */
  init(): Promise<Guest | null>;
  createGuest(name: string, avatar?: Blob): Promise<Guest>;
  updateGuest(name: string, avatar?: Blob): Promise<Guest>;
  listPhotos(): Promise<Photo[]>;
  subscribe(handlers: RealtimeHandlers): () => void;
  /** Upload a photo or a video. onProgress gets 0..1 for the transfer. */
  uploadMedia(file: File, caption?: string, onProgress?: (fraction: number) => void): Promise<Photo>;
  setHeart(photoId: string, hearted: boolean): Promise<void>;
  deletePhoto(photo: Photo): Promise<void>;
  urlFor(path: string): string;
}
