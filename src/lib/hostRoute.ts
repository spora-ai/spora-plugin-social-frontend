/**
 * Between a host URL and a local route — both directions.
 *
 * **The host path is the single source of truth:** what the address bar shows,
 * a bookmark stores and a reload re-reads. A local path is the host path minus
 * `/apps/{app}` — a prefix strip and append rather than a table of kinds, so
 * a page added later cannot be left out.
 *
 * **The principal is in the path.** Every account and post belongs to
 * one principal, and the plugin's own API is principal-scoped: a path without
 * one would point at a scope the operator did not choose and would 403 — a
 * broken page rather than a wrong one, but still broken.
 */
import { sectionPath, type Section } from './paths'
import { sectionForRouteName } from './routes'

export interface HostRoute {
    path: string
    params?: Record<string, unknown>
    query?: Record<string, unknown>
}

/** The slug this plugin is mounted under — the parent plugin's `plugin.json#slug`. */
const FALLBACK_APP_SLUG = 'social'

/** Matches `/apps/{app}` and nothing deeper, so the slug can be read off a path. */
const APP_PREFIX = /^\/apps\/([^/]+)/

/** The section an unknown path falls back to. */
export const DEFAULT_SECTION: Section = 'compose'

/** `route.params.appName` is authoritative — it is the slug the host resolved. */
export function appSlugFrom(route: HostRoute | null): string {
    const fromParams = route?.params?.['appName']
    if (typeof fromParams === 'string' && fromParams !== '') return fromParams

    const path = route?.path
    if (typeof path === 'string') {
        const match = APP_PREFIX.exec(path)
        if (match?.[1] !== undefined && match[1] !== '') return match[1]
    }

    return FALLBACK_APP_SLUG
}

/** The local path for a host path, or null when it is not this app's panel. */
export function localPathForHostPath(path: string, appSlug: string): string | null {
    const prefix = `/apps/${appSlug}`
    if (path === prefix || path === `${prefix}/`) return '/'
    if (!path.startsWith(`${prefix}/`)) return null

    return `/${path.slice(prefix.length + 1)}`
}

/** The local path for a host route, or null when it is not this app's panel. */
export function localPathForHostRoute(route: HostRoute | null, appSlug: string): string | null {
    if (route === null) return null
    return localPathForHostPath(route.path, appSlug)
}

/** The host path for a local path — the same prefix strip, in reverse. */
export function hostPathForLocalPath(localPath: string, appSlug: string): string {
    const rest = localPath === '/' ? '' : localPath.replace(/^\//, '')
    return rest === '' ? `/apps/${appSlug}` : `/apps/${appSlug}/${rest}`
}

/**
 * The principal a local path is scoped to, or null.
 *
 * `p/0` and `p/abc` parse to no principal: `Number.isSafeInteger` keeps a long
 * digit run from becoming a float, and `id > 0` rejects the zero id no
 * principal carries.
 */
export function principalIdInLocalPath(localPath: string): number | null {
    const match = /^\/p\/(\d+)(?:\/|$)/.exec(localPath)
    if (match?.[1] === undefined) return null

    const id = Number(match[1])
    return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * The path the URL should hold, or null when it already holds it.
 *
 * Three cases, and they are different kinds of wrong:
 *
 *  - **The path names no section** (`/`, `/p/7`) or names one that does not
 *    exist (`/p/7/bogus`). The section is canonicalised to the default rather
 *    than blanked: a stale link, a rename or a typo gets a working page, and
 *    the URL is rewritten so the address bar stops claiming a section that is
 *    not there.
 *  - **The path names a principal the app is not showing.** The path is
 *    rebuilt for the principal that is being shown, keeping the section.
 *  - **The path is already canonical.** Nothing to do — and saying so is what
 *    keeps the rewrite from firing on every navigation.
 */
export function canonicalLocalPath(
    localPath: string,
    routeName: string | symbol | null | undefined,
    principalId: number,
): string | null {
    if (routeName === 'not-found' || routeName === 'root' || routeName === 'root-scoped') {
        return sectionPath(principalId, DEFAULT_SECTION)
    }

    // The backend sends the browser back on `/connections` after an OAuth round
    // trip; the screen's own address is `/accounts`, so the path is rewritten
    // and the query — the notice that a provider is connected — travels with it.
    if (routeName === 'connections') {
        return sectionPath(principalId, 'accounts')
    }

    if (principalIdInLocalPath(localPath) === principalId) return null

    const section = sectionForRouteName(routeName)
    return sectionPath(principalId, section ?? DEFAULT_SECTION)
}
