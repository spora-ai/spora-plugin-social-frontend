/**
 * Plugin-local bridge to the host's typed REST client, which owns CSRF, the
 * `/api/v1` base and the `{ data: T }` unwrap. `setApi()` installs the
 * instance the registry hands `mount()`; `getApi()` serves every `api/*`
 * module. Tests either `vi.mock()` this module or `setApi()` a stub.
 */
import type { PluginHostContext } from '../shims'

let _api: PluginHostContext['api'] | null = null

export function setApi(api: PluginHostContext['api']): void {
    _api = api
}

export function getApi(): PluginHostContext['api'] {
    if (_api === null) {
        throw new Error('Plugin API not initialized — call setApi() in main.ts before mounting the plugin.')
    }
    return _api
}

/**
 * The host's error, as the plugin can see it.
 *
 * The host's client throws its own `ApiError`
 * (`spora-frontend/src/api/client.ts`), and a plugin bundle declares its
 * own copy of that class — so `instanceof` against the class this file
 * declares never matches the error the host throws, and a check written
 * that way drops every sentence the backend sent.
 */
export interface ApiError extends Error {
    readonly code: string
    readonly status: number
}

/**
 * Whether the failure is the API's own answer.
 *
 * The shape, not the class — see {@see ApiError}.
 */
export function isApiError(e: unknown): e is ApiError {
    if (!(e instanceof Error)) return false

    const candidate = e as { code?: unknown; status?: unknown }

    return typeof candidate.code === 'string' && typeof candidate.status === 'number'
}

/**
 * The sentence to show the operator.
 *
 * The API's own sentence when it sent one — it names the part that was
 * refused and where to fix it. An error whose message is empty carries no
 * sentence, and an empty banner hides the failure instead of reporting it.
 */
export function apiMessage(e: unknown, fallback: string): string {
    return isApiError(e) && e.message !== '' ? e.message : fallback
}
