import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite configuration for the financial agent web frontend.
export default defineConfig(({ mode }) => {
  // Read the whole env set (including non-`VITE_` names) so the proxy target can
  // come from `.env`/`.env.local` as well as from the shell.
  const env = loadEnv(mode, process.cwd(), '')

  /** Backend origin the development server forwards `/api` calls to. */
  const proxyTarget = env.VITE_PROXY_TARGET || process.env.VITE_PROXY_TARGET || 'http://localhost:8000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      // The API serves no CORS headers, so development stays single-origin: the
      // dev server forwards `/api` to the backend instead of the browser calling
      // another origin. The production image mirrors this with Nginx.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
