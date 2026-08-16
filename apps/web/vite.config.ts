import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Source map upload to Sentry — only active in CI/deployments that set
    // SENTRY_AUTH_TOKEN (Vercel dashboard). Without it the plugin is disabled
    // and the build behaves exactly as before.
    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      telemetry: false,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // NOTE: with the injectManifest strategy the `workbox` option is inert
      // (no automatic runtime caching) — all caching lives in src/sw.ts, which
      // precaches the app shell (index.html, hashed bundles, the Excel
      // template) and deliberately leaves API calls (Supabase / Render) on the
      // network, because the app has its own IndexedDB sync layer.
      includeAssets: ['favicon.svg', 'templates/template.xlsx'],
      manifest: {
        name: 'OTIS Wochenrapport',
        short_name: 'OTIS Rapport',
        description: 'Wochenrapport für OTIS Techniker',
        theme_color: '#00205b',
        background_color: '#00205b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Source maps only when they are actually uploaded to Sentry (build with
    // SENTRY_AUTH_TOKEN) — keeps local/preview builds lean and never ships
    // the source to the public web otherwise.
    sourcemap: Boolean(process.env.SENTRY_AUTH_TOKEN),
  },
})
