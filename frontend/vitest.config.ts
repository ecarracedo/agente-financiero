import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Vitest configuration: jsdom environment, RTL matchers, globals enabled.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
  },
})
