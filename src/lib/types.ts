export interface Socials {
  instagram?: string;
  snapchat?: string;
  tiktok?: string;
  facebook?: string;
  x?: string;
  website?: string;
}

export interface Guest {
  id: string;
  name: string;
  avatar_path: string | null;
  socials: Socials;
  created_at?: string;
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

export interface Message {
  kind: "message";
  id: string;
  guest_id: string;
  text: string;
  created_at: string;
  guest: Guest;
  hearts: number;
  hearted: boolean;
}

export interface Trend {
  id: string;
  guest_id: string;
  url: string;
  provider: "instagram" | "tiktok" | "youtube" | "other";
  external_id: string | null;
  note: string | null;
  video_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  fetch_error: string | null;
  created_at: string;
  guest: Guest;
  hearts: number;
  hearted: boolean;
  comments: number;
}

export interface TrendComment {
  id: string;
  trend_id: string;
  guest_id: string;
  text: string;
  created_at: string;
  guest: Guest;
}

/** What the wall shows: photos, videos and guestbook messages, newest first. */
export type WallItem = Photo | Message;

export interface RealtimeHandlers {
  onPhotoInsert: (photo: Photo) => void;
  onPhotoDelete: (id: string) => void;
  /** delta is +1 or -1; guestId lets the UI ignore its own optimistic updates. */
  onHeart: (photoId: string, guestId: string, delta: 1 | -1) => void;
  onScore: (photoId: string, score: Score) => void;
  onMessageInsert?: (message: Message) => void;
  onMessageDelete?: (id: string) => void;
  onMessageHeart?: (messageId: string, guestId: string, delta: 1 | -1) => void;
  onTrendInsert?: (trend: Trend) => void;
  onTrendUpdate?: (trend: Trend) => void;
  onTrendDelete?: (id: string) => void;
  onTrendHeart?: (trendId: string, guestId: string, delta: 1 | -1) => void;
  onTrendComment?: (comment: TrendComment) => void;
  onTrendCommentDelete?: (trendId: string, id: string) => void;
}

export interface Api {
  /** True when running without Supabase keys (in-memory demo data). */
  readonly isDemo: boolean;
  /** Current guest, once init()/createGuest() resolved. */
  readonly guest: Guest | null;
  /** Ensure an auth session; return the guest profile if one exists on this device. */
  init(): Promise<Guest | null>;
  createGuest(name: string, avatar?: Blob): Promise<Guest>;
  updateGuest(name: string, avatar?: Blob, socials?: Socials): Promise<Guest>;
  /** Everyone who joined, oldest first (for the guest number on the card). */
  listGuests(): Promise<Guest[]>;
  /** Re-link this device to the existing profile with that name. */
  claimGuest(name: string): Promise<Guest>;
  listPhotos(): Promise<Photo[]>;
  subscribe(handlers: RealtimeHandlers): () => void;
  /** Upload a photo or a video. onProgress gets 0..1 for the transfer. */
  uploadMedia(file: File, caption?: string, onProgress?: (fraction: number) => void): Promise<Photo>;
  setHeart(photoId: string, hearted: boolean): Promise<void>;
  deletePhoto(photo: Photo): Promise<void>;
  urlFor(path: string): string;
  /** "I'm here" ping for the hosts' online/last-seen view. */
  heartbeat(): Promise<void>;
  listMessages(): Promise<Message[]>;
  postMessage(text: string): Promise<Message>;
  setMessageHeart(messageId: string, hearted: boolean): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  listTrends(): Promise<Trend[]>;
  postTrend(input: { url: string; provider: Trend["provider"]; external_id: string | null; note?: string }): Promise<Trend>;
  setTrendHeart(trendId: string, hearted: boolean): Promise<void>;
  deleteTrend(id: string): Promise<void>;
  listTrendComments(trendId: string): Promise<TrendComment[]>;
  postTrendComment(trendId: string, text: string): Promise<TrendComment>;
  deleteTrendComment(id: string): Promise<void>;
}
