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
        "apple-touch-icon.png",
        "icon-192x192.png",
        "icon-512x512.png",
        "offline.html",
        "logo.png",
        "loginside.jpg",
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
            src: "/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-512x512.png",
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

        // Fix large bundle precache issue
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,

        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2,jpg,jpeg}"],

        // IMPORTANT: React Router pages must load index.html
        navigateFallback: "/index.html",

        // Do not fallback API/uploads requests to React app
        navigateFallbackAllowlist: [/^\/(?!api\/|uploads\/).*/],

        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" &&
              !url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/uploads/"),
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
