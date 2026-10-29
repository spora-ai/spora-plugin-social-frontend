/**
 * The app's route table — one definition, three consumers (`main.ts`,
 * `dev-main.ts`, the specs). It used to be copied into each, and a page added
 * to one copy was unreachable.
 *
 * **Every path carries the acting principal as `p/{pid}`** — see
 * `lib/hostRoute.ts` for why. The unscoped records are transient: `App.vue`
 * canonicalises the path as soon as the principal is known, so they are not
 * a second way of being somewhere.
 *
 * **`/posts/analytics` is a route, not a flag.** It is a place the operator
 * can be sent to — "the numbers for this quarter" — so it gets a path. It
 * lives under `posts` because it is the second view of that tab, and the
 * rail item stays "Posts" for both.
 *
 * **A post is a route that opens a drawer.** The list stays mounted
 * underneath, so closing the drawer returns to where you were.
 *
 * **There is no recurring route.** The static slot — a fixed slot that posts
 * the same words every week — was cut, together with the tab that showed it.
 * A stale `/recurring` link lands on the catch-all and is canonicalised to a
 * real section rather than blanked.
 *
 * The route *names* are load-bearing: the section is detected from
 * `route.name` and never from `route.path.startsWith(...)`, because the path
 * carries a principal prefix that a string match gets wrong.
 */
import type { Component } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import ComposePage from '../pages/ComposePage.vue'
import CalendarPage from '../pages/CalendarPage.vue'
import PostsPage from '../pages/PostsPage.vue'
import AccountsPage from '../pages/AccountsPage.vue'
import type { RailSection, Section } from './paths'

/** Narrower than `RouteRecordRaw`, whose union members disagree about which fields are required. */
export interface AppRoute {
    path: string
    name: string
    component: Component
}

export function appRoutes(): RouteRecordRaw[] {
    return APP_ROUTES.map(({ path, name, component }) => ({ path, name, component }))
}

/**
 * The section a route belongs to.
 *
 * A drawer route belongs to the tab it opens over — a post drawer is the
 * Posts tab — so switching the principal from inside a drawer lands on that
 * tab's list rather than on a path that names a record the new principal does
 * not own.
 */
const SECTION_FOR_ROUTE: Record<string, Section> = {
    compose: 'compose',
    calendar: 'calendar',
    posts: 'posts',
    analytics: 'analytics',
    accounts: 'accounts',
    post: 'posts',
    // The backend sends the browser back here after an OAuth round trip — it
    // calls the screen "connections" — so the path has to lead somewhere.
    connections: 'accounts',
}

/** The section a route name names, or null for a route that names none. */
export function sectionForRouteName(name: string | symbol | null | undefined): Section | null {
    if (typeof name !== 'string') return null
    return SECTION_FOR_ROUTE[name] ?? null
}

/**
 * The rail item a route highlights.
 *
 * The analytics view shares the Posts item: they are two views of one job,
 * and a sixth rail item would make the navigation worse for no gain.
 */
const TAB_FOR_ROUTE: Record<string, RailSection> = {
    compose: 'compose',
    calendar: 'calendar',
    posts: 'posts',
    analytics: 'posts',
    accounts: 'accounts',
    post: 'posts',
    connections: 'accounts',
}

export function tabForRouteName(name: string | symbol | null | undefined): RailSection | null {
    if (typeof name !== 'string') return null
    return TAB_FOR_ROUTE[name] ?? null
}

export const APP_ROUTES: AppRoute[] = [
    { path: '/', name: 'root', component: ComposePage },
    { path: '/p/:principalId', name: 'root-scoped', component: ComposePage },
    { path: '/p/:principalId/compose', name: 'compose', component: ComposePage },
    { path: '/p/:principalId/calendar', name: 'calendar', component: CalendarPage },
    { path: '/p/:principalId/posts', name: 'posts', component: PostsPage },
    { path: '/p/:principalId/posts/analytics', name: 'analytics', component: PostsPage },
    { path: '/p/:principalId/accounts', name: 'accounts', component: AccountsPage },
    // The backend redirects the browser here after an OAuth round trip, so the
    // path has to lead to the same screen — the app rewrites it to
    // `/accounts`, which is the one address the screen has.
    { path: '/p/:principalId/connections', name: 'connections', component: AccountsPage },
    { path: '/p/:principalId/post/:postId', name: 'post', component: PostsPage },
    // A path that matches no record. The composer is the honest landing, and
    // `App.vue` replaces the URL with the canonical section rather than
    // leaving a stale link in the address bar.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: ComposePage },
]
