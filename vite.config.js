import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Le service worker sert aussi en `npm run dev`, pour tester le hors-ligne
      // sans passer par un build.
      devOptions: { enabled: true, type: 'module' },

      manifest: {
        name: 'HEBI',
        short_name: 'HEBI',
        description: 'Snake franco-japonais, jouable hors-ligne.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0b0b12',
        background_color: '#0b0b12',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Tout est précaché : après la première visite, plus une seule requête.
        // Ce motif ratisse tout dist/, y compris ce qui vient de public/ :
        // inutile d'ajouter includeAssets, ça ne ferait que des doublons.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // N'importe quelle URL retombe sur l'app...
        navigateFallback: '/index.html',
        // ...SAUF /api, sinon le service worker sert l'index HTML à la place du
        // JSON du classement et tout casse silencieusement.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
