/** One injection key for every bootstrap path — a per-entry symbol surfaces as
 *  `[Vue warn]: injection "Symbol(...)" not found` with `hostContext` `undefined`. */
import type { InjectionKey } from 'vue'

export const HOST_CONTEXT_KEY: InjectionKey<PluginHostContext | null> = Symbol(
    'spora-social-host-context',
) as unknown as InjectionKey<PluginHostContext | null>

/**
 * The media asset the host's picker returns.
 *
 * `MediaPickerOverlay.vue` resolves against the host's own `MediaAsset`
 * (`spora-frontend/src/types/media.ts`). The plugin cannot import that type —
 * the host does not publish its modules, only its globals — so the shape is
 * restated here. Only the fields the composer reads are named; the id is a
 * string because the host's is.
 */
export interface HostMediaAsset {
    id: string
    filename: string | null
    media_type: string | null
    mime_type: string | null
    byte_size: number | null
    asset_url: string | null
}

/** The picker's options. Mirrors the host's `MediaPickerOptions`. */
export interface MediaPickerOptions {
    /** Allow multi-select. */
    multi?: boolean
    /** Filter the listing by media kind. */
    mediaKind?: 'image' | 'image+document'
    /** Override the modal title. */
    title?: string
}

/**
 * The deliberately small context the host's `PluginAppPage.vue` passes:
 *   - `api`    — the host's typed REST client, used verbatim so the `{ data: T }`
 *                envelope and the `/api/v1` base stay in the host's hands.
 *   - `pinia`  — the host's Pinia. Plugins may install a *local* Pinia but must NOT call
 *                `setActivePinia(host.pinia)`: that collides with the host's stores.
 *   - `theme`  — a mount-time snapshot; the host's theme store is reached through `pinia`.
 *   - `route` / `router` — the host's current route and Vue Router.
 *   - `openMediaPicker` — the host's own media picker, which lists the Media Archive
 *                *and* uploads. The plugin ships no upload dialog of its own.
 */
export interface PluginHostContext {
    api: {
        get: <T = unknown>(path: string, query?: Record<string, unknown>) => Promise<T>
        post: <T = unknown>(path: string, body?: unknown) => Promise<T>
        put: <T = unknown>(path: string, body?: unknown) => Promise<T>
        patch: <T = unknown>(path: string, body?: unknown) => Promise<T>
        delete: <T = unknown>(path: string) => Promise<T>
    }
    pinia: unknown
    theme: 'light' | 'dark'
    /**
     * The host's active interface language, e.g. `'de'`.
     *
     * The plugin builds its own i18n instance from its own catalogue and
     * initialises it with this.
     */
    locale: string
    route: { path: string; params: Record<string, unknown>; query: Record<string, unknown> } | null
    /** The host exposes the full Router; plugins only see this surface. */
    router: {
        push: (to: string) => Promise<unknown>
        currentRoute: {
            value: {
                path: string
                /** The path with its query. Optional: the host always publishes it. */
                fullPath?: string
                params?: Record<string, unknown>
                query?: Record<string, unknown>
            }
        }
        /**
         * Optional because it is read defensively, not because the host lacks it. Watching
         * `currentRoute` reactively does not work from inside a plugin (separate `vue` copies, so the
         * host's `shallowRef` sits behind a proxy that does not subscribe to its deps); `afterEach` is the
         * imperative way out.
         *
         * The third argument is vue-router's `failure`. It fires for CANCELLED and aborted navigations too,
         * so a plugin syncing a URL must ignore it.
         */
        afterEach?: (
            cb: (
                to: { path: string; fullPath?: string; query?: Record<string, unknown> },
                from: unknown,
                failure?: unknown,
            ) => void,
        ) => () => void
    } | null
    /**
     * Open the host's media picker. Resolves with the operator's selection,
     * or `[]` on cancel.
     */
    openMediaPicker: (options?: MediaPickerOptions) => Promise<HostMediaAsset[]>
}

declare global {
    interface Window {
        SporaAppSocial?: {
            /** Async, and must stay so: the app may mount onto a URL that already names a principal and a section. */
            mount: (target: HTMLElement, ctx: PluginHostContext) => Promise<void>
            unmount?: (target: HTMLElement) => void
        }
    }
}
