import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import AccountsPage from '../../src/pages/AccountsPage.vue'
import { APP_ROUTES } from '../../src/lib/routes'
import { useSocialStore } from '../../src/stores/social'
import { CONFIG_PAYLOAD, CONNECTIONS_PAYLOAD } from '../recorded'
import { ApiError } from '../../src/api/client'
import { hostContext, mountPage } from '../mountPage'

function makeRouter() {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

/**
 * A host context that answers with the backend's **recorded** payloads.
 *
 * The connections are a bare list and the provider entries are objects — the
 * shapes `spora-plugin-social` actually sends.
 */
function contextWith(
    config: Record<string, unknown> = CONFIG_PAYLOAD,
    connections: unknown[] = CONNECTIONS_PAYLOAD,
) {
    const context = hostContext()
    context.api.get = vi.fn().mockImplementation((path: string) => {
        if (path.includes('/plugins/social/config')) {
            return Promise.resolve(config)
        }
        if (path.includes('/plugins/social/connections')) {
            return Promise.resolve(connections)
        }
        return Promise.resolve({})
    }) as never
    return context
}

/** Only Meta is connected, so LinkedIn can still be connected. */
const META_ONLY = [CONNECTIONS_PAYLOAD[0]]

describe('AccountsPage', () => {
    it('lists the connections and the accounts they cover', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const wrapper = mountPage(AccountsPage, pinia, router, contextWith())
        await flushPromises()

        expect(wrapper.find('[data-test="connections-grid"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connection-1"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connection-account-12"]').exists()).toBe(true)
    })

    it('opens the OAuth URL the backend returned', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const post = vi.fn().mockResolvedValue({
            authorize_url: 'https://example.test/oauth',
            state: 'signed',
            expires_at: '',
        })
        const context = contextWith(CONFIG_PAYLOAD, META_ONLY)
        context.api.post = post as never

        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        await wrapper.find('[data-test="connect-linkedin"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith('/plugins/social/connections/connect', {
            principal_id: 7,
            provider: 'linkedin',
        })
    })

    it('surfaces the server’s setup message when a provider is not configured', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        // The backend refuses it, and its sentence says what to add and where.
        const post = vi.fn().mockRejectedValue(
            new ApiError(
                'LinkedIn is not configured. Set its client id and client secret in the plugin settings first.',
                'VALIDATION',
                422,
            ),
        )
        const context = contextWith(
            {
                ...CONFIG_PAYLOAD,
                providers: {
                    ...CONFIG_PAYLOAD.providers,
                    linkedin: { ...CONFIG_PAYLOAD.providers.linkedin, configured: false },
                },
            },
            META_ONLY,
        )
        context.api.post = post as never

        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        await wrapper.find('[data-test="connect-linkedin"]').trigger('click')
        await flushPromises()

        // The client does not refuse it in its own words: the server's message
        // is the one that says what to add.
        expect(post).toHaveBeenCalled()
        expect(social.error).toContain('LinkedIn is not configured')
        expect(social.error).toContain('plugin settings')
    })

    it('does not say so when the provider is configured', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const post = vi.fn().mockResolvedValue({
            authorize_url: 'https://example.test/oauth',
            state: 'signed',
            expires_at: '',
        })
        const context = contextWith(CONFIG_PAYLOAD, META_ONLY)
        context.api.post = post as never

        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        await wrapper.find('[data-test="connect-linkedin"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalled()
        expect(social.notice).toBeNull()
    })

    it('asks the server when the provider entry is absent altogether', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const post = vi.fn().mockRejectedValue(
            new ApiError('LinkedIn is not configured.', 'VALIDATION', 422),
        )
        // A config without any provider entry at all: absent means "not
        // configured", the same as a missing field — and the server says so.
        const context = contextWith({ app_url: null, app_url_public: false }, META_ONLY)
        context.api.post = post as never

        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        await wrapper.find('[data-test="connect-linkedin"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalled()
        expect(social.error).toContain('LinkedIn is not configured')
    })

    it('shows no redirect URI — the setup instruction lives in the settings', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const wrapper = mountPage(AccountsPage, pinia, router, contextWith(CONFIG_PAYLOAD, META_ONLY))
        await flushPromises()

        expect(wrapper.find('[data-test="redirect-uri-linkedin"]').exists()).toBe(false)
        expect(wrapper.find('[data-test="copy-redirect-uri-linkedin"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('/oauth/')
        // The Connect button is still there.
        expect(wrapper.find('[data-test="connect-linkedin"]').exists()).toBe(true)
    })
})

describe('AccountsPage — the connections', () => {
    /** The page, with a host that answers the connection routes. */
    async function mountAccounts() {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const post = vi.fn().mockResolvedValue({})
        const del = vi.fn().mockResolvedValue({ deleted: true })
        const context = contextWith()
        context.api.post = post as never
        context.api.delete = del as never

        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()
        return { wrapper, post, del }
    }

    it('refreshes a token that expires', async () => {
        const { wrapper, post } = await mountAccounts()

        await wrapper.find('[data-test="connection-refresh-2"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith('/plugins/social/connections/2/refresh', {
            principal_id: 7,
        })
    })

    it('disconnects a connection', async () => {
        const { wrapper, del } = await mountAccounts()

        await wrapper.find('[data-test="connection-disconnect-1"]').trigger('click')
        await flushPromises()

        expect(del).toHaveBeenCalledWith('/plugins/social/connections/1?principal_id=7')
    })

    it('lists the connections that need a human', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const context = contextWith(CONFIG_PAYLOAD, [
            { ...CONNECTIONS_PAYLOAD[0], status: 'expired', needs_reconnect: true },
        ])
        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        expect(wrapper.find('[data-test="connection-attention-1"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('This connection will not publish until it is renewed.')
    })

    it('says so when every connection is healthy', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const wrapper = mountPage(AccountsPage, pinia, router, contextWith())
        await flushPromises()

        expect(wrapper.text()).toContain('Every connection has a healthy token.')
    })

    it('reconnects a connection that needs a human', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const post = vi.fn().mockResolvedValue({
            authorize_url: 'https://example.test/oauth',
            state: 'signed',
            expires_at: '',
        })
        const context = contextWith(CONFIG_PAYLOAD, [
            { ...CONNECTIONS_PAYLOAD[0], status: 'expired', needs_reconnect: true },
        ])
        context.api.post = post as never

        const wrapper = mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        await wrapper.find('[data-test="connection-reconnect-1"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith('/plugins/social/connections/connect', {
            principal_id: 7,
            provider: 'meta',
        })
    })
})

describe('AccountsPage — without a principal', () => {
    it('asks for nothing', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/')
        await router.isReady()

        const get = vi.fn().mockResolvedValue({})
        const context = hostContext()
        context.api.get = get as never

        mountPage(AccountsPage, pinia, router, context)
        await flushPromises()

        // A path without a principal names no scope, so there is nothing to
        // ask the backend about.
        expect(get).not.toHaveBeenCalled()
    })
})
