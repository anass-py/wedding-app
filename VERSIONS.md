# Versions

Each version is a git tag. Later versions include everything before them unless noted.

**To open all of them at once:**

```bash
npm run compare
```

It builds every version into its own folder and serves one page — `http://localhost:5555/`
(it also prints an address for your phone on the same WiFi) — where you tap a version to open
it. Your name and language carry over between versions.

| Tag | What changed |
|-----|--------------|
| v0.1 | First working app: onboarding, Apple-Watch-style bubble wall, detail view, upload, Top 5, AI ranker, EN/FR. |
| v0.2 | Pinterest-style masonry grid becomes the default wall; bubbles behind a ▦/⬡ toggle. Thumbnails keep their real proportions. "N new" pill when photos arrive while scrolled. |
| v0.3 | Top 5 redesigned as an editorial page: framed hero for №1 with the AI verdict as a pull-quote, gold Roman-numeral ranked list for II–V, theme chips in gold. |
| v0.4 | The celebration: after posting, the photo springs in inside a gold frame with a burst of sparks and "Posted!", then flies off to the wall where the new card pops in. Heart button bursts, double-tap a photo to ❤️ it (big heart flash), cards stagger in on first load, upload progress bar, haptic tick on Android. |
| v0.5 | Photo viewer: swipe left/right between photos (with slide transition), swipe down to close, "12 / 35" counter, arrow keys on desktop, neighbours preloaded, native Share button (WhatsApp, AirDrop…), full-size + delete as pills. |
| v0.6 | Live wall for the venue TV/projector: open `/tv` (or `?tv`). Full-screen slideshow with blurred backdrop and slow Ken-Burns zoom, photographer credit, live photo count, QR code guests scan to join; new photos jump the queue with a NEW tag. Space/click pauses. |
| v0.7 | First impressions: animated onboarding with ornament, a "Welcome, Nadia" spark moment after joining, splash screen with the couple's names instead of "Connecting…", shimmer skeleton grid while photos load. Tap your avatar → profile sheet: change name/selfie, see your photos & hearts received, "Add to Home Screen" hint. |
| v0.8 | Live & smooth: when another guest hearts a photo, a ♥ floats up on that card in everyone's grid; images fade in as they load; the grid renders in batches of 60 so 500+ photos stay fast; the list refreshes when the app comes back to the foreground; Top 5 hero and rows animate in. |
| v0.9 | Premium finish: all glyph/emoji icons replaced with one hand-drawn SVG icon set (identical on iPhone and Android), gold icon discs on the upload choices, tighter nav typography, `prefers-reduced-motion` respected. |
| v3.3 | **Tendances** tab: guests paste an Instagram / TikTok / YouTube link (+ optional note) from the + sheet; cards show the provider's player on tap, likes with rising hearts, delete own, author → card. Optional: `TRENDS_DOWNLOAD=1` on the worker (needs `yt-dlp`) stores a copy so trends play natively. Also since v3.0: one rising heart per like, presence (online / last seen), device & approximate location per guest, `npm run guests`, no counts in the header. |
| v2.9 | Messages and photos in their own spaces: on wide screens a **Livre d'or** column on the left, a gold hairline with ✦, photos on the right (the main space); on phones the guestbook is a swipeable strip above the photos under a *LIVRE D'OR* heading. |
| v2.8 | **Livre d'or**: from the + sheet, *Un mot pour les mariés* → a message card (gold quotation mark, italic serif) appears in the wall between the photos; double-tap to ❤️, delete your own, author tap → card; the TV wall shows a message every 4 slides; header counts *mots*. **Bride & groom**: `groom` / `bride` names in config → gold ring next to their name, *Le marié / La mariée* on their card. **Save fixed** on iPhone (share sheet opens on the tap). `npm run migrate` now works with the service key through `exec_sql` (after one last paste). **Needs schema.sql run once.** |
| v2.7 | One profile, many devices: reconnecting on a laptop no longer logs the phone out — every device that joined or reconnected stays remembered. **Needs schema.sql run once** (guest_devices). |
| v2.6 | No codes. Names are unique: signing up with a name that exists says *déjà pris*; **Déjà inscrit ? Me reconnecter** re-links a new phone by typing the name. **Needs schema.sql run once** (unique index + claim_guest). |
| v2.5 | Reconnect: the device is remembered as before; on a new phone (or after a reset) **Déjà inscrit ? Me reconnecter** on the join screen re-links the profile with name + a 6-character code shown on the guest's own card (so nobody can take over someone else's profile by typing their name). Stale sessions after a data reset heal themselves. `npm run migrate` applies schema changes for you with a Supabase access token. **Needs schema.sql run once.** |
| v2.4 | FR/EN switch visible at the far left of the header (names stay centred, scale to the screen). Guests without a selfie get a unique gold-ringed gradient orb instead of an initial letter. |
| v2.3 | Copy & motion pass. French switched to *tu*; every sentence rewritten short and with a wink ("Ce soir, c’est toi le photographe.", "Je suis là", "Le mur est à toi.", "Dis quelque chose… ou pas", "Sur le mur. Pour tout le monde. Maintenant.", "Élues par vos ❤️ et un juge très exigeant."). Names in a cream→gold gradient, twinkling ornament, breathing glow on the join screen, springy nav dot, pulsing + when the wall is empty, glint on the Top-5 badge. Join screen: Prénom / Réseau buttons only, placeholder inside the box, no hashtag. |
| v2.2 | Join with a network: **Avec mon prénom** / **Avec un réseau** — floating Instagram · Snapchat · TikTok · Facebook icons (the chosen one glows in its brand colour), one field for the username, which becomes the name on the wall and a link on the card. We keep only the username. Snapchat & Facebook added to profile links and cards. |
| v2.1 | Guest cards: tap the name in the viewer → a collectible-style card (number of joining / total, name, handle, social buttons, hearts received, ★ TOP 5 chip, photos · videos · best score). Guests add Instagram / X / TikTok / website in their profile. What a guest is called is `guestTitle` in config (default *Complice*). Names set to Anass & Boutaina. Language switch (FR/EN) is back, in the profile and on the join screen — French by default. **Re-run supabase/schema.sql once** (adds the `socials` column). |
| v2.0 | Profile: tap the avatar → **Caméra** (in-app selfie camera, front-facing, photo only) or **Galerie**; same on the join screen. The non-clickable "Add to Home Screen" note is gone. |
| v1.9 | No text hints on the camera or the Camera button — tap, hold, double-tap are discovered like on Snapchat. |
| v1.8 | Header: the couple's names take centre stage — large serif, italic gold ampersand, gold ornament, photo/video count in small caps. Date and "en direct" removed. (Also cleaned a duplicated CSS block.) |
| v1.7 | Full-screen viewer: media edge to edge over a blurred backdrop (portrait fills the screen like Stories; ⤢ shows the whole frame), videos start immediately with sound (loop, tap to pause, mute), only a Reels-style animated ❤️ on the picture, name/caption merged at the bottom with icon-only save/delete, pinch to zoom, swipe between items, swipe down to close. Shell: French only, grid only, icon-only floating glass navigation, header with date · live · counts. Share removed. |
| v1.6 | Camera, Snapchat's real model: hold to start, **lift your finger and it keeps recording** (hands-free), tap the shutter to stop. Double-tap to flip now reads raw touches, so it works with a second finger while the first holds the shutter (iOS never sent clicks for that). iOS-safe camera switching (stop old → open new) and the microphone runs through an audio graph so sound survives flips. Live view stays mounted (no more paused view after Retake) and the mirror flips exactly when the new camera's frames arrive. |
| v1.5 | Camera exactly like Snapchat: double-tap anywhere on the viewfinder to flip, **also while recording** — the recorder is fed by an off-screen canvas mirroring whichever camera is live, so the clip and the microphone continue uninterrupted. Front-camera clips are mirrored like the preview. |
| v1.4 | Snapchat-style in-app camera: tap for a photo, hold for a video (ring timer, up to 60 s), flip front/back, preview → Use. Videos in the wall auto-play muted while on screen (like Shorts/Reels). Double-tap a card in the wall to ❤️ it (single tap still opens). The camera needs HTTPS: works on Vercel; on the LAN use `npm run dev:https`. |
| v1.3 | `npm run memories`: an automatically edited memories film (like iPhone / Google Photos). Claude picks and sequences ~28 moments into chapters with titles; ffmpeg renders Ken-Burns photos, 3-s clips, crossfades, title/end cards and looped, faded music. Portrait for phones or `--landscape` for the TV. |
| v1.2 | Videos: record or pick clips (limits in config), poster frame grabbed in the browser, real byte-level upload progress, ▶ badge + duration in the grid, native player in the viewer, videos play on the TV wall. `npm run worker` on a laptop converts uploads to universal H.264 MP4 (an iPhone .mov won't play on Android) and scores photos. |
| v1.1 | Fixes from the first phone test: uploads failed on a phone opening `http://192.168…` (browser hides `crypto.randomUUID` on plain http — now has a fallback); the big ♥ replayed on every swipe after one double-tap; "Full size" did nothing (now **Save** → share sheet with the file on phones, i.e. "Save Image", download on desktop); the Midnight/Ivory look is now a switch in the profile sheet, not only a config constant. Unsupported file types get their own message. |
| v1.0 | Two looks, one switch: `theme: "midnight"` (dark, photos glow — evening) or `theme: "ivory"` (cream paper, ink, deeper gold — invitation feel, daytime) in `src/config.ts`. Everything above included. |

## Looking at one version's code

`git checkout v0.3` switches the whole folder to that version (you'll see "detached HEAD");
`git checkout main` brings you back to the latest. Prefer `npm run compare` for just *looking*.

To try Ivory: open `src/config.ts`, change `theme: "midnight"` to `theme: "ivory"`, and the dev
server reloads.
