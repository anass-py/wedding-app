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

## Databases

Use **two Supabase projects** so test data never mixes with the real wall:

- `.env` on your laptop → the **dev** project.
- Vercel → Settings → Environment Variables: the `VITE_SUPABASE_*` values for **Production** point to
  the real project, the ones for **Preview** point to the dev project.
- Run `supabase/schema.sql` on both whenever a version says it changed the database.
