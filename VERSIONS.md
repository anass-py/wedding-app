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
| v1.0 | Two looks, one switch: `theme: "midnight"` (dark, photos glow — evening) or `theme: "ivory"` (cream paper, ink, deeper gold — invitation feel, daytime) in `src/config.ts`. Everything above included. |

## Looking at one version's code

`git checkout v0.3` switches the whole folder to that version (you'll see "detached HEAD");
`git checkout main` brings you back to the latest. Prefer `npm run compare` for just *looking*.

To try Ivory: open `src/config.ts`, change `theme: "midnight"` to `theme: "ivory"`, and the dev
server reloads.
