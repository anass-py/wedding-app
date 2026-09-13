# Wedding photo wall

A web app (PWA) your guests open by scanning a QR code. They type their first name, optionally
snap a selfie, and start posting photos — from the camera or their gallery. Everyone sees the
photos appear live on a Pinterest-style wall (with an Apple-Watch-style "bubbles" view one tap
away). Tapping a photo shows who took it.
A **Top 5** tab ranks the best photos overall and by theme (bride & groom, decoration, dance
floor…) using Claude vision blended with guest ❤️.

- No app store, no install, no passwords. Works on iPhone and Android in the browser.
- Posting is a moment: the photo springs in with a burst of sparks, then lands on the wall.
- Swipeable viewer with share, live floating hearts, a Top 5 that reads like a magazine spread.
- `/tv` — a live slideshow with a QR code for the venue screen.
- English / French toggle.
- Photos are resized in the browser before upload (fast on venue WiFi, tiny storage bill).

## 1. Run it locally (2 minutes, no account needed)

```bash
npm install
npm run dev
```

Open the printed URL. Without Supabase keys the app runs in **demo mode** with placeholder
photos so you can feel the wall, the Top tab and the upload flow. Open it on your phone via the
`Network:` URL Vite prints (same WiFi) to try the real camera.

Edit [src/config.ts](src/config.ts) for your names, date, hashtag and the look: `theme: "midnight"`
(dark, evening) or `theme: "ivory"` (cream invitation-card look, daytime).
See [VERSIONS.md](VERSIONS.md) for the history of every version and how to compare them.

## 2. Create the backend (Supabase, ~10 minutes, free)

1. Create a project at https://supabase.com (choose a region close to the venue).
2. **SQL Editor → New query** → paste all of [supabase/schema.sql](supabase/schema.sql) → Run.
   This creates the tables, security rules, realtime and the `photos` storage bucket.
3. **Authentication → Sign In / Providers → Anonymous sign-ins → Enable.**
4. **Authentication → Rate Limits → "Anonymous users"**: raise it to at least **500 per hour**.
   The default (30/hour per IP) would lock out guests joining from the venue WiFi, which shares
   one IP.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

```bash
cp .env.example .env     # then paste the URL and anon key into .env
npm run dev              # demo banner disappears → you're live
```

## 3. Put it online

Any static host works. Vercel is the least effort:

1. Push this folder to a GitHub repo.
2. https://vercel.com → *Add New Project* → import the repo (framework: Vite).
3. Add the two env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` → Deploy.
4. You get `https://something.vercel.app`. Optionally attach a nicer domain.

Netlify / Cloudflare Pages work the same way (build command `npm run build`, output `dist`).

Then make the QR code for the tables:

```bash
npm run qr -- https://something.vercel.app     # writes qr.png + qr.svg
```

## 3b. The live wall on the venue screen

Plug a laptop into the TV/projector and open **`https://your-url/tv`** in full screen (F11).
It cycles through the photos with the photographer's name, shows a live count and a QR code
guests scan to join, and new photos jump the queue with a NEW tag. Click or press space to pause.

## 4. AI ranking (Top 5)

[scripts/rank.ts](scripts/rank.ts) looks at every photo not yet scored, asks Claude to grade it
(0–10) and classify its theme, and writes the result to `photo_scores`. The app blends that with
hearts (weights in [src/config.ts](src/config.ts)). Photos that aren't scored yet still rank by
hearts, so the Top tab works from the first minute.

Add to `.env`: `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API → *service_role*, secret —
never put it in the app) and `ANTHROPIC_API_KEY` (https://console.anthropic.com).

```bash
npm run rank            # score everything new, once
npm run rank:watch      # keep running; checks every 60 s
npm run rank -- --all   # re-score everything (after changing the prompt)
```

Cost: roughly **1 cent per photo** with the default `claude-opus-5` (a 500-photo wedding ≈ $5).
Set `RANK_MODEL=claude-sonnet-5` in `.env` for about a third of that.

**Wedding day without a laptop:** the GitHub Actions workflow in
[.github/workflows/rank.yml](.github/workflows/rank.yml) runs the ranker every 10 minutes. Add the
three secrets in the repo settings (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ANTHROPIC_API_KEY`), and disable the workflow again after the wedding.

To tweak what "best" means, edit the `SYSTEM` prompt in `scripts/rank.ts` and run `--all`.
Themes live in both `src/config.ts` and `scripts/rank.ts` — keep them in sync.

## Wedding-day checklist

- [ ] `src/config.ts` has your names; deployed; QR printed on cards for the tables.
- [ ] Anonymous sign-ins enabled and the rate limit raised (step 2.4).
- [ ] Tested from two phones: join, post from camera, post from gallery, heart, see it appear live on the other phone.
- [ ] Ranker running (`npm run rank:watch` on a laptop at home, or the GitHub Action enabled).
- [ ] Ask the venue for the WiFi password to put on the cards — uploads are much faster than on cellular.

## How it's built

```
src/
  App.tsx                 shell: header, wall/top tabs, upload FAB, detail overlay
  config.ts               names, themes, ranking weights          ← edit me
  i18n.tsx                EN/FR strings
  components/Masonry      the default wall: Pinterest-style columns, "N new" pill when scrolled
  components/Honeycomb    alternate wall: Apple-Watch-style bubbles (hex spiral, fisheye, inertia)
  components/TopPhotos    Top 5 overall / per theme
  components/PhotoDetail  full photo, author, hearts, delete own
  components/UploadSheet  camera / gallery picker, multi-upload
  components/Onboarding   name + selfie
  lib/supabaseApi.ts      auth, storage upload, queries, realtime
  lib/demoApi.ts          in-memory stand-in used when no keys are set
  lib/image.ts            client-side resize (1920px full, 512px square thumb)
  lib/ranking.ts          AI score × hearts blend
supabase/schema.sql       tables, RLS policies, realtime, storage bucket
scripts/rank.ts           Claude vision ranker
scripts/qr.ts             QR code generator
```

Security model: every guest gets an anonymous Supabase session. Row-level security lets anyone
read, lets guests insert only as themselves, and lets them delete only their own photos. Storage
uploads are confined to a folder named after the guest's auth id. Only the service-role key (used
by the ranker, never shipped to browsers) can write scores. Photo URLs are public but
unguessable (UUIDs) and the bucket can't be listed.
