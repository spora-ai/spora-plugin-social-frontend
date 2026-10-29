/**
 * Navigating the host SPA from inside the plugin.
 *
 * The plugin owns `/apps/social/*` and nothing else, so a link to the host's
 * own screen goes through the host's router: an `<a href>` written by the
 * plugin is relative to wherever it is mounted, so it cannot be correct in
 * both the standalone and hosted cases without hard-coding the host's base —
 * the coupling this boundary exists to avoid.
 */

/** The host's agent-schedules route (`spora-frontend/src/router/index.ts`). */
export const AGENT_SCHEDULES_PATH_PREFIX = '/agents/'

export function agentSchedulesPath(agentId: number): string {
    return `${AGENT_SCHEDULES_PATH_PREFIX}${agentId}/scheduled-runs`
}

/**
 * The slice of `PluginHostContext['router']` this module needs, re-declared
 * structurally so `lib/` never imports the ambient shims and a test can pass
 * a two-field stub.
 */
export interface PluginRouter {
    push: (to: string) => Promise<unknown>
}

export type HostLinkAction =
    | { readonly kind: 'push'; readonly to: string }
    | { readonly kind: 'disabled' }

/**
 * Resolve the click action for a link out of the plugin.
 *
 * A null router is a legitimate state, not an error to recover from: the
 * plugin's dev entry passes `router: null` because a standalone page has no
 * host SPA to navigate inside. The link renders disabled rather than broken.
 */
export function hostLinkAction(router: PluginRouter | null, to: string): HostLinkAction {
    if (router === null || typeof router.push !== 'function') return { kind: 'disabled' }
    return { kind: 'push', to }
}
