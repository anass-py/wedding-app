/**
 * The one thing to leave running on a laptop during the wedding:
 * every 60 s it scores new photos (rank.ts) and converts new videos (transcode.ts).
 *
 *   npm run worker
 */
import { rankOnce } from "./rank";
import { transcodeOnce } from "./transcode";
import { trendsOnce } from "./trends";

async function loop() {
  for (;;) {
    let did = 0;
    try {
      did += await transcodeOnce();
    } catch (e) {
      console.error("transcode:", e instanceof Error ? e.message : e);
    }
    try {
      did += await trendsOnce();
    } catch (e) {
      console.error("trends:", e instanceof Error ? e.message : e);
    }
    try {
      did += await rankOnce();
    } catch (e) {
      console.error("rank:", e instanceof Error ? e.message : e);
    }
    if (did === 0) process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 60_000));
  }
}

loop().catch((e) => {
  console.error(e);
  process.exit(1);
});
