/**
 * Make the QR code guests scan at the venue.
 *   npm run qr -- https://your-app.vercel.app
 * Writes qr.png (print it) and qr.svg (for a designer / the invitation).
 */
import { writeFileSync } from "node:fs";
import QRCode from "qrcode";

const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) {
  console.error("Usage: npm run qr -- https://your-deployed-app-url");
  process.exit(1);
}
const opts = { errorCorrectionLevel: "H" as const, margin: 2, color: { dark: "#1a1408", light: "#ffffff" } };
await QRCode.toFile("qr.png", url, { ...opts, width: 1200 });
writeFileSync("qr.svg", await QRCode.toString(url, { ...opts, type: "svg" }));
console.log(`Wrote qr.png and qr.svg for ${url}`);
