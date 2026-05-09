import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "pwa-192x192.png",
        "pwa-512x512.png",
        "maskable-icon-512x512.png",
        "offline.html",
      ],

      manifest: {
        id: "/",
        name: "Rebel Angels Gymnastics",
        short_name: "Rebel Angels",
        description:
          "Judge and Parent PWA for live events, scores, academy access, notifications, and results.",
        theme_color: "#e11d2e",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["sports", "education", "productivity"],
        lang: "en",
        dir: "ltr",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        sourcemap: false,

        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2}"],

        // Offline fallback page
        navigateFallback: "/offline.html",

        // Do not use fallback for API requests
        navigateFallbackAllowlist: [/^(?!\/api\/).*/],

        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "ra-pages-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },

          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "ra-assets-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },

          {
            urlPattern: ({ request }) =>
              ["image", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "ra-media-cache",
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },

          // Public APIs can be cached briefly
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/public"),
            handler: "NetworkFirst",
            options: {
              cacheName: "ra-public-api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 10,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // Private APIs should NOT be cached
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/api/judge") ||
              url.pathname.startsWith("/api/parent") ||
              url.pathname.startsWith("/api/participant") ||
              url.pathname.startsWith("/api/notification") ||
              url.pathname.startsWith("/api/admin") ||
              url.pathname.startsWith("/api/super-admin"),
            handler: "NetworkOnly",
          },
        ],
      },

      devOptions: {
        enabled: false,
      },
    }),
  ],
});
