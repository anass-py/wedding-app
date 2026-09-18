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
