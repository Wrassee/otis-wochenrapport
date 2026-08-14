import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
      includeAssets: ['favicon.svg', 'icons.svg', 'templates/template.xlsx'],
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
          { src: '/favicon.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/favicon.svg', sizes: '512x512', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
