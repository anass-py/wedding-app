# Development workflow

| Branch | Where it runs | Who sees it |
|--------|---------------|-------------|
| `main` | **Production** — https://wedding-app-g153.vercel.app | the guests |
| `dev`  | local (`npm run dev`) + a Vercel *preview* link for every push | you, to validate |

1. New features are built and pushed on `dev`.
2. Test locally (`npm run dev`, or `npm run dev:https` for the camera) or on the preview link
   (Vercel → Deployments → the deployment tagged `dev`).
3. Validated → merge into `main` (`git checkout main && git merge dev && git push`) → production
   deploys itself in about a minute.

## One database, two namespaces

Production uses the `public` tables and the `photos` bucket. Development uses an identical copy
in the `dev` namespace and the `photos-dev` bucket — same Supabase project, same keys, no mixing.

- **Once:** Supabase → SQL Editor → run `supabase/schema.dev.sql` (generated from `schema.sql` by
  `npm run schema:dev`), then Settings → API → *Exposed schemas* → add `dev`.
- **Local:** `.env` has `VITE_DB_SCHEMA=dev`, `VITE_STORAGE_BUCKET=photos-dev` (and the
  `SUPABASE_DB_SCHEMA` / `STORAGE_BUCKET` pair for the scripts).
- **Vercel:** add the two `VITE_*` variables for the **Preview** environment only; Production has none
  and therefore uses `public` / `photos`.
- When a version changes the database: run `schema.dev.sql` first (dev), validate, then `schema.sql`
  (production) when merging.
