/**
 * Starts the MSW browser worker for local demo mode when both `VITE_DEMO=1` and
 * the Vite dev server are active.
 *
 * Both conditions matter:
 *
 * - The flag keeps the workers' fixtures out of an ordinary `npm run dev`, where
 *   the real backend is what the developer wants to look at.
 * - `import.meta.env.DEV` keeps the demo out of a production build entirely.
 *
 * MSW and the fixtures are imported dynamically, so neither reaches the
 * production bundle even though this module is imported unconditionally from
 * `main.tsx`.
 */

/**
 * Start the demo worker when enabled.
 *
 * @returns The running worker, or `undefined` when demo mode is off or the
 * build is not a development build.
 */
export async function startDemo() {
  if (!import.meta.env.DEV || import.meta.env.VITE_DEMO !== '1') {
    return undefined
  }

  const [{ setupWorker }, { handlers }] = await Promise.all([
    import('msw/browser'),
    import('../mocks/handlers'),
  ])

  const worker = setupWorker(...handlers)
  // Anything the fixtures do not cover still reaches the network, so a route
  // missing from the harness is visible instead of silently empty.
  await worker.start({ onUnhandledFrame: 'bypass' })
  return worker
}
