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
    // Vitest already refuses a committed `.only` when CI is set, but it does so
    // through an implicit default. Pin the rule explicitly so a committed `.only`
    // can never silently skip the rest of the suite, while staying usable locally.
    allowOnly: !process.env.CI,
  },
})
