import type { RouteObject } from 'react-router'

import { BibliographyWorkspace } from '../features/bibliography/BibliographyWorkspace'
import { AlertsWorkspace } from '../features/alerts/AlertsWorkspace'
import { MarketWorkspace } from '../features/market/MarketWorkspace'
import { PortfolioWorkspace } from '../features/portfolio/PortfolioWorkspace'
import { SplitWorkspace } from '../features/tools/split/SplitWorkspace'
import { TransactionsWorkspace } from '../features/transactions/TransactionsWorkspace'
import { WishlistWorkspace } from '../features/wishlist/WishlistWorkspace'
import { WorkspaceShell } from './WorkspaceShell'

/**
 * One workspace route.
 *
 * `path` is the client-side URL segment. Route names must not collide with the
 * `/api/**`, `/health` and `/ready` locations Nginx proxies to the backend
 * (`frontend/nginx.conf`), or a deep link would never reach the SPA.
 */
export interface WorkspaceRoute {
  path: string
  label: string
  element: React.ReactNode
}

/**
 * The workspace destinations, in navigation order.
 *
 * Alerts is a first-class destination here: it used to render inside the market
 * workspace, and promoting it means monitoring alerts no longer requires
 * opening market first.
 */
export const WORKSPACE_ROUTES: WorkspaceRoute[] = [
  { path: 'portfolio', label: 'Portfolio', element: <PortfolioWorkspace /> },
  { path: 'transactions', label: 'Transactions', element: <TransactionsWorkspace /> },
  { path: 'market', label: 'Market', element: <MarketWorkspace /> },
  { path: 'alerts', label: 'Alerts', element: <AlertsWorkspace /> },
  { path: 'wishlist', label: 'Wishlist', element: <WishlistWorkspace /> },
  { path: 'bibliography', label: 'Bibliography', element: <BibliographyWorkspace /> },
  { path: 'tools', label: 'Tools', element: <SplitWorkspace /> },
]

/** Landing route: the default workspace. */
export const DEFAULT_WORKSPACE = 'portfolio'

/**
 * The route tree, shared by the browser router and the test memory router.
 *
 * One shell route matches every path and owns which workspace is visible, so
 * the router never unmounts a workspace and the shell decides from the URL.
 */
export const appRoutes: RouteObject[] = [{ path: '*', element: <WorkspaceShell /> }]
