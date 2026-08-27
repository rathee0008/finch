import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.GITHUB_PAGES === 'true' ? '/finch/' : '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // Rewrites the service worker on every deploy and activates it
      // immediately, so a redeploy (e.g. `npm run deploy`) reaches
      // installed devices on their next launch without a manual uninstall.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Finch — Personal Finance',
        short_name: 'Finch',
        description:
          'A local-first personal finance manager: budgets, cash-flow forecasting, debt payoff planning and automatic spending insights.',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#0c0d11',
        theme_color: '#4f46e5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Everything the app needs is bundled at build time, so precache the
        // whole shell — the installed app then boots with zero network
        // requests, and localStorage does the rest.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
})
