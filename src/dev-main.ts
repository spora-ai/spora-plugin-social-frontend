import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from './App.vue'
import { appRoutes } from './lib/routes'
import { setApi } from './api/client'
import { createPluginI18n } from './i18n'
import { HOST_CONTEXT_KEY, type PluginHostContext } from './shims'

/**
 * The dev sandbox.
 *
 * The production entry is `src/main.ts`, which the host calls with its own
 * context. This one stands in for the host so the app can be opened on its
 * own: the REST calls answer with empty lists, the media picker resolves with
 * nothing, and the router is the same local one the app installs in the host.
 *
 * It is not part of the shipped bundle — `vite.config.ts` builds
 * `src/main.ts` — and it is excluded from the i18n scan and from coverage,
 * because its strings are not the operator's.
 */
const emptyApi = {
    get: async <T = unknown>(path: string): Promise<T> => {
        if (path === '/principals/me') {
            return {
                principals: [
                    { id: 1, type: 'user', name: 'Dev operator', user_id: 1, group_id: null },
                    { id: 2, type: 'group', name: 'Dev group', user_id: null, group_id: 1 },
                ],
            } as unknown as T
        }
        // The shapes here are the backend's, not invented ones: the provider
        // entries are objects, and the list endpoints answer with a bare list.
        if (path.includes('/plugins/social/config')) {
            return {
                providers: {
                    meta: {
                        configured: true,
                        client_id: 'dev-meta-client',
                        config_id: 'dev-meta-config',
                        needs_setup: {
                            title: 'Meta integration needs setup',
                            body: 'Add the app id, the app secret and the configuration id in Settings → Plugins.',
                        },
                    },
                    linkedin: {
                        configured: true,
                        client_id: 'dev-linkedin-client',
                        config_id: null,
                        needs_setup: {
                            title: 'LinkedIn integration needs setup',
                            body: 'Add the client id, the client secret and the requested permissions in Settings → Plugins.',
                        },
                    },
                },
                app_url: 'http://localhost:5195',
                app_url_public: false,
                rules: {},
            } as unknown as T
        }
        if (path.includes('/plugins/social/connections')) return [] as unknown as T
        if (path.includes('/plugins/social/posts')) return { items: [], total: 0 } as unknown as T
        if (path.includes('/plugins/social/media')) return [] as unknown as T
        if (path.includes('/plugins/social/calendar')) return { days: [], posts: [] } as unknown as T
        if (path.includes('/plugins/social/analytics/summary')) {
            return { totals: {}, by_network: [], series: [], top_posts: [], notes: [] } as unknown as T
        }
        return {} as T
    },
    post: async <T = unknown>(): Promise<T> => ({}) as T,
    put: async <T = unknown>(): Promise<T> => ({}) as T,
    patch: async <T = unknown>(): Promise<T> => ({}) as T,
    delete: async <T = unknown>(): Promise<T> => ({ deleted: true }) as T,
}

const hostContext: PluginHostContext = {
    api: emptyApi,
    pinia: null,
    theme: 'light',
    locale: new URLSearchParams(window.location.search).get('locale') ?? 'en',
    route: { path: '/apps/social', params: {}, query: {} },
    router: null,
    openMediaPicker: async () => [],
}

setApi(hostContext.api)

const app = createApp(App, { hostContext })
app.provide(HOST_CONTEXT_KEY, hostContext)
app.use(createPinia())
app.use(createPluginI18n(hostContext.locale))
app.use(createRouter({ history: createMemoryHistory(), routes: appRoutes() }))
app.mount('#app')
