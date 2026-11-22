import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const baseCsp = "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'none'; manifest-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"

export default defineConfig(() => {
  const csp = baseCsp
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
    ],
    preview: { headers: { 'Content-Security-Policy': csp } },
    test: { environment: 'jsdom', exclude: [...configDefaults.exclude, 'e2e/**'] },
  }
})
