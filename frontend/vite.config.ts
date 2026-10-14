import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Backend origin the development server forwards `/api` calls to. */
const proxyTarget = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000'

// Vite configuration for the financial agent web frontend.
export default defineConfig({
  plugins: [react()],
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
})
