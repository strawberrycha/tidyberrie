import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { lightTokens } from './src/shared/theme/tokens.ts'

const csp = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'production-csp',
      transformIndexHtml(html, context) {
        return context.server ? html : html.replace('<head>', () =>
          '<head>\n    <meta http-equiv="Content-Security-Policy" content="' + csp.replace("; frame-ancestors 'none'", '') + '">')
      },
    },
    VitePWA({
      registerType: 'prompt',
      manifest: {
        id: '/', name: 'Tidyberrie', short_name: 'Tidyberrie', start_url: '/',
        display: 'standalone', theme_color: lightTokens.bg, background_color: lightTokens.bg,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { clientsClaim: true, globPatterns: ['{**/*.{js,css,html,png,woff2,woff},stickers/*.webp}'] },
    }),
  ],
  preview: { headers: { 'Content-Security-Policy': csp } },
  test: { environment: 'jsdom' },
})
