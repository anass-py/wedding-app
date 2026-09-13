# Versions

Each version is a git tag. To look at one: `git checkout v0.3 && npm run dev`
(then `git checkout main` to come back). Later versions include everything before them
unless noted.

| Tag | What changed |
|-----|--------------|
| v0.1 | First working app: onboarding, Apple-Watch-style bubble wall, detail view, upload, Top 5, AI ranker, EN/FR. |
| v0.2 | Pinterest-style masonry grid becomes the default wall; bubbles behind a ▦/⬡ toggle. Thumbnails keep their real proportions. "N new" pill when photos arrive while scrolled. |
| v0.3 | Top 5 redesigned as an editorial page: framed hero for №1 with the AI verdict as a pull-quote, gold Roman-numeral ranked list for II–V, theme chips in gold. |
| v0.4 | The celebration: after posting, the photo springs in inside a gold frame with a burst of sparks and "Posted!", then flies off to the wall where the new card pops in. Heart button bursts, double-tap a photo to ❤️ it (big heart flash), cards stagger in on first load, upload progress bar, haptic tick on Android. |
| v0.5 | Photo viewer: swipe left/right between photos (with slide transition), swipe down to close, "12 / 35" counter, arrow keys on desktop, neighbours preloaded, native Share button (WhatsApp, AirDrop…), full-size + delete as pills. |
| v0.6 | Live wall for the venue TV/projector: open `/tv` (or `?tv`). Full-screen slideshow with blurred backdrop and slow Ken-Burns zoom, photographer credit, live photo count, QR code guests scan to join; new photos jump the queue with a NEW tag. Space/click pauses. |
| v0.7 | First impressions: animated onboarding with ornament, a "Welcome, Nadia" spark moment after joining, splash screen with the couple's names instead of "Connecting…", shimmer skeleton grid while photos load. Tap your avatar → profile sheet: change name/selfie, see your photos & hearts received, "Add to Home Screen" hint. |
