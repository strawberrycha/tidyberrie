import { configDefaults, defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { lightTokens } from './src/shared/theme/tokens.ts'

const baseCsp = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const project = env.VITE_FIREBASE_PROJECT_ID
  const configured = !!project && /^[a-z][a-z0-9-]{3,28}[a-z0-9]$/u.test(project) &&
    !!env.VITE_FIREBASE_API_KEY && !!env.VITE_FIREBASE_APP_ID
  const emulator = env.VITE_SYNC_EMULATOR === 'true'
  const authCsp = baseCsp.replace("script-src 'self'", "script-src 'self' https://apis.google.com")
  const csp = emulator
    ? authCsp.replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:8080 http://127.0.0.1:9099") +
      '; frame-src http://127.0.0.1:9099'
    : configured
      ? authCsp.replace("connect-src 'self'",
        "connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://" + project + '.firebaseapp.com') +
        '; frame-src https://' + project + '.firebaseapp.com'
      : baseCsp
  return {
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
        workbox: {
          clientsClaim: true,
          globPatterns: ['{**/*.{js,css,html,png,woff2,woff},stickers/*.webp}'],
          globIgnores: configured || emulator ? [] : ['assets/firebase-*.js'],
        },
      }),
    ],
    preview: { headers: { 'Content-Security-Policy': csp } },
    test: { environment: 'jsdom', exclude: [...configDefaults.exclude, 'e2e/**'] },
  }
})
