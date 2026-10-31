import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { appRoutes } from './app/routes'
import { startDemo } from './dev/demo'
import './index.css'

const container = document.getElementById('root')
if (container === null) {
  throw new Error('Root element #root was not found in index.html')
}

const router = createBrowserRouter(appRoutes)

// Demo mode starts the MSW browser worker before the first render, so every
// workspace can be walked with no backend process running.
await startDemo()

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
