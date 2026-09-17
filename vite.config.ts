import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [
    // `npm run dev:https` — self-signed HTTPS so the in-app camera works on a phone over LAN.
    ...(process.env.VITE_HTTPS ? [basicSsl()] : []),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "Wedding Photos",
        short_name: "Wedding",
        description: "Share your photos of the wedding",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#100e0c",
        theme_color: "#100e0c",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Photos from Supabase Storage: cache aggressively, they never change.
            urlPattern: ({ url }) => url.pathname.includes("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: {
              cacheName: "wedding-photos",
              expiration: { maxEntries: 1500, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
