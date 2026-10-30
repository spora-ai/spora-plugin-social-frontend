/**
 * The notice the OAuth callback leaves behind.
 *
 * The backend redirects the browser back to `?connected={provider}` after a
 * successful round trip, and that query is the only signal there is — so it
 * is read once, turned into a notice, and then dropped from the URL. A
 * reload must not repeat the notice, and an address bar that keeps a query
 * nobody reads is a lie about where the operator is.
 *
 * **The query travels through the canonical rewrite** — the callback's path
 * is `/connections`, the screen's own address is `/accounts` — so the notice
 * is read *after* the path has been canonicalised, and it names the screen
 * the operator is looking at.
 *
 * The callback is a server-side redirect, so it always arrives as a fresh
 * mount: the query is read once, when the app comes up.
 */
import { ref } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { t } from '../i18n'
import { PROVIDERS, providerLabel } from '../lib/providers'
import type { Provider } from '../types'

/** The provider a query names, when it names one this app knows. */
function providerFromQuery(value: unknown): Provider | null {
    if (typeof value !== 'string') return null
    return PROVIDERS.find((provider) => provider === value) ?? null
}

export function useConnectedNotice() {
    const route = useRoute()
    const router = useRouter()

    const notice = ref<string | null>(null)

    /**
     * Read the query the callback left behind, and drop it.
     *
     * The query is dropped either way: it has said what it had to say, and a
     * query nobody reads must not sit in the address bar. The notice itself
     * appears only for a provider this app knows — a notice about a connection
     * that does not exist is worse than none.
     */
    async function announce(): Promise<void> {
        const provider = providerFromQuery(route.query.connected)
        if (provider !== null) {
            notice.value = t('{provider} is connected.', { provider: providerLabel(provider) })
        }

        if (!('connected' in route.query)) return

        const query: LocationQueryRaw = {}
        for (const [key, entry] of Object.entries(route.query)) {
            if (key === 'connected') continue
            query[key] = entry
        }
        await router.replace({ path: route.path, query }).catch(() => {})
    }

    return { notice, announce }
}
