/**
 * Every path the app links to, in one place.
 *
 * The principal is on every path, because every account and post belongs to
 * one: a link without a principal points at a scope the operator did not
 * choose, and the plugin's own API is principal-scoped, so it would 403 — a
 * broken page rather than a wrong one, but still broken. These pure builders
 * cannot be called without a principal, where a template literal could — and
 * a forgotten principal at one call site reopens that bug.
 *
 * **There is no recurring tab.** The static slot — a fixed slot that posts
 * the same words every week — was cut, together with the routes that carried
 * it. The agent-driven mode replaced it: core's scheduler wakes an agent, the
 * agent drafts the copy, and the post it creates is a scheduled post like any
 * other. The recurrence itself lives in the agent's own Schedules tab.
 */

/** The app's sections. The analytics view is the second view of the Posts tab. */
export type Section = 'compose' | 'calendar' | 'posts' | 'analytics' | 'accounts'

/**
 * The rail's sections.
 *
 * The analytics view is not one of them: it shares the Posts item, because the
 * two are one job and a sixth rail item would make the navigation worse for
 * no gain.
 */
export type RailSection = 'compose' | 'calendar' | 'posts' | 'accounts'

export function composePath(principalId: number): string {
    return `/p/${principalId}/compose`
}

export function calendarPath(principalId: number): string {
    return `/p/${principalId}/calendar`
}

export function postsPath(principalId: number): string {
    return `/p/${principalId}/posts`
}

export function analyticsPath(principalId: number): string {
    return `/p/${principalId}/posts/analytics`
}

export function accountsPath(principalId: number): string {
    return `/p/${principalId}/accounts`
}

/** A post, as a drawer over the list — the one shape that makes a post shareable. */
export function postPath(principalId: number, postId: number): string {
    return `/p/${principalId}/post/${postId}`
}

/**
 * The path of a section, by name.
 *
 * The principal switcher and the canonicalisation both need "the same
 * section, another principal", and a `switch (section)` over hand-written
 * literals is where a path and its section would drift apart.
 */
export function sectionPath(principalId: number, section: Section): string {
    switch (section) {
        case 'compose':
            return composePath(principalId)
        case 'calendar':
            return calendarPath(principalId)
        case 'posts':
            return postsPath(principalId)
        case 'analytics':
            return analyticsPath(principalId)
        case 'accounts':
            return accountsPath(principalId)
    }
}
