import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setApi } from '../../src/api/client'
import { useSocialStore } from '../../src/stores/social'
import { CONFIG_PAYLOAD, CONNECTIONS_PAYLOAD } from '../recorded'
import { hostApiError, makePost } from '../fixtures'
import type { PluginHostContext } from '../../src/shims'

let get: ReturnType<typeof vi.fn>
let post: ReturnType<typeof vi.fn>
let patch: ReturnType<typeof vi.fn>
let del: ReturnType<typeof vi.fn>

beforeEach(() => {
    setActivePinia(createPinia())
    get = vi.fn().mockResolvedValue({})
    post = vi.fn().mockResolvedValue({})
    patch = vi.fn().mockResolvedValue({})
    del = vi.fn().mockResolvedValue({ deleted: true })
    setApi({
        get: get as never,
        post: post as never,
        put: vi.fn() as never,
        patch: patch as never,
        delete: del as never,
    } satisfies PluginHostContext['api'])
})

describe('stores/social', () => {
    it('reads the connections of a principal', async () => {
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()

        await store.loadConnections(7)

        expect(get).toHaveBeenCalledWith('/plugins/social/connections', { principal_id: 7 })
        expect(store.connections).toHaveLength(3)
    })

    it('flattens the accounts of every connection', async () => {
        // The accounts arrive inside their connection; the composer's picker
        // needs them on their own.
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()

        await store.loadConnections(7)

        expect(store.accounts).toHaveLength(4)
    })

    it('puts a new post at the top of the list', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87 })], total: 1 })
        post.mockResolvedValueOnce(makePost({ id: 88 }))
        const store = useSocialStore()

        await store.loadPosts(7)
        await store.createPost({
            principal_id: 7,
            title: 'Q4 release',
            body: 'We shipped…',
            account_ids: [12],
            scheduled_for: null,
            timezone: 'Europe/Zurich',
            publish_now: false,
        })

        expect(store.posts.map((post) => post.id)).toEqual([88, 87])
    })

    it('removes a deleted post from the list', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87 })], total: 1 })
        const store = useSocialStore()

        await store.loadPosts(7)
        await store.deletePost(7, 87)

        expect(store.posts).toHaveLength(0)
    })

    it('reports a failure instead of throwing', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        await store.loadConnections(7)

        expect(store.error).not.toBeNull()
    })

    it('starts the OAuth round trip and hands back the URL', async () => {
        post.mockResolvedValueOnce({ authorize_url: 'https://example.test/oauth', state: 's', expires_at: '' })
        const store = useSocialStore()

        const result = await store.connectProvider(7, 'linkedin')

        expect(result?.authorize_url).toBe('https://example.test/oauth')
    })

    it('reads the redirect URI the backend sent', async () => {
        // The URL is built from the address this instance is reached at, so
        // the operator cannot work it out — it travels with the config.
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig(7)

        expect(store.config?.providers.linkedin.redirect_uri).toBe(
            'https://spora.example.com/api/v1/plugins/social/oauth/linkedin/callback',
        )
        expect(store.config?.providers.meta.redirect_uri).toBe(
            'https://spora.example.com/api/v1/plugins/social/oauth/meta/callback',
        )
    })

    it('reads no redirect URI when the backend sent none', async () => {
        // An instance with no address a platform accepts has none to name.
        get.mockResolvedValue({
            ...CONFIG_PAYLOAD,
            providers: {
                ...CONFIG_PAYLOAD.providers,
                linkedin: { ...CONFIG_PAYLOAD.providers.linkedin, redirect_uri: null },
            },
        })
        const store = useSocialStore()

        await store.loadConfig(7)

        expect(store.config?.providers.linkedin.redirect_uri).toBeNull()
    })

    it('reads the rules the backend enforces', async () => {
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig(7)

        expect(store.rules['direct:linkedin']?.max_text).toBe(3000)
        expect(store.rules['direct:instagram']?.max_text).toBe(2200)
        expect(store.rules['direct:instagram']?.media_note).toBe('Instagram accepts JPEG or MP4, up to 100 MB.')
    })

    it('reads the config once', async () => {
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig(7)
        await store.loadConfig(7)

        expect(get).toHaveBeenCalledTimes(1)
        expect(get).toHaveBeenCalledWith('/plugins/social/config', { principal_id: 7 })
    })

    it('joins the config read that is already in flight', async () => {
        // Two owners ask for the same config at once — the app's shell and
        // the screen inside it — and the second one must not ask again for
        // an answer that is on its way.
        let release: (payload: unknown) => void = () => {}
        get.mockImplementationOnce(
            () => new Promise((resolve) => { release = resolve }),
        )
        const store = useSocialStore()

        const first = store.loadConfig(7)
        const second = store.loadConfig(7)
        release(CONFIG_PAYLOAD)
        await Promise.all([first, second])

        expect(get).toHaveBeenCalledTimes(1)
        expect(store.config?.app_url).toBe('https://spora.example.com')
    })

    it('has no rules when the config could not be read', async () => {
        get.mockRejectedValue(new Error('boom'))
        const store = useSocialStore()

        await store.loadConfig(7)

        expect(store.configError).not.toBeNull()
        expect(store.rules).toEqual({})
    })
})

describe('stores/social — the reads', () => {
    it('reads the analytics summary', async () => {
        get.mockResolvedValueOnce({ totals: { reach: 100 }, by_network: [], series: [], top_posts: [], notes: [] })
        const store = useSocialStore()

        await store.loadAnalytics(7)

        expect(get).toHaveBeenCalledWith('/plugins/social/analytics/summary', {
            principal_id: 7,
            days: 30,
        })
        expect(store.analytics?.totals.reach).toBe(100)
    })

    it('reads the analytics summary with a window', async () => {
        get.mockResolvedValueOnce({ totals: {}, by_network: [], series: [], top_posts: [], notes: [] })
        const store = useSocialStore()

        await store.loadAnalytics(7, 7)

        expect(get).toHaveBeenCalledWith('/plugins/social/analytics/summary', {
            principal_id: 7,
            days: 7,
        })
    })

    it('reports a failed analytics read', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        await store.loadAnalytics(7)

        expect(store.error).not.toBeNull()
        expect(store.analytics).toBeNull()
    })

    it('reads the calendar of a month', async () => {
        get.mockResolvedValueOnce({ posts: [] })
        const store = useSocialStore()

        await store.loadCalendar(7, '2026-11')

        expect(get).toHaveBeenCalledWith('/plugins/social/calendar', {
            principal_id: 7,
            month: '2026-11',
        })
        expect(store.calendar?.posts).toEqual([])
    })

    it('reports a failed calendar read', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        await store.loadCalendar(7, '2026-11')

        expect(store.error).not.toBeNull()
    })

    it('reports a failed posts read', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        await store.loadPosts(7)

        expect(store.error).not.toBeNull()
    })

    it('carries the backend’s own message when it sent one', async () => {
        // The host's client throws its own error class, so the plugin has
        // to recognise the error by its shape. A fixture built from a
        // plugin-local class would pass while production dropped it.
        get.mockRejectedValueOnce(hostApiError('The connection expired.', 'expired', 409))
        const store = useSocialStore()

        await store.loadConnections(7)

        expect(store.error).toBe('The connection expired.')
    })

    it('reports a failed config read with the backend’s message', async () => {
        get.mockRejectedValueOnce(hostApiError('No client id.', 'config', 422))
        const store = useSocialStore()

        await store.loadConfig(7)

        expect(store.configError).toBe('No client id.')
    })

    it('tries the config again after a failed read', async () => {
        // A config that could not be read is a temporary state, and the rules
        // are what the composer judges the body against.
        get.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        await store.loadConfig(7)
        get.mockResolvedValueOnce(CONFIG_PAYLOAD)
        await store.loadConfig(7)

        expect(store.configError).toBeNull()
        expect(store.rules['direct:linkedin']?.max_text).toBe(3000)
    })
})

describe('stores/social — the aggregator', () => {
    it('reads the config again for another principal', async () => {
        // The aggregators' flags are the principal's, so another principal
        // is another config.
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig(7)
        await store.loadConfig(9)

        expect(get).toHaveBeenCalledTimes(2)
    })

    it('reads the config again after a key is stored', async () => {
        // The flag is what says whether the aggregator is set up, and the
        // key has just changed it.
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig(7)
        await store.setAggregatorKey(7, 'zernio', 'the-key')

        expect(get.mock.calls.filter((call) => String(call[0]).includes('/config'))).toHaveLength(2)
    })

    it('reads the connections again after a key is stored', async () => {
        // The aggregator's accounts are discovered rather than connected, so
        // they are only known once the key is there — and the refresh has to
        // ask again, cache or no cache.
        get.mockImplementation((path: string) =>
            Promise.resolve(String(path).includes('/connections') ? CONNECTIONS_PAYLOAD : CONFIG_PAYLOAD),
        )
        const store = useSocialStore()

        await store.loadConnections(7)
        await store.setAggregatorKey(7, 'zernio', 'the-key')

        expect(get.mock.calls.filter((call) => String(call[0]).includes('/connections'))).toHaveLength(2)
    })

    it('reads the connections again after a sync', async () => {
        // A sync brings accounts the aggregator found since the last read.
        get.mockImplementation((path: string) =>
            Promise.resolve(String(path).includes('/connections') ? CONNECTIONS_PAYLOAD : CONFIG_PAYLOAD),
        )
        const store = useSocialStore()

        await store.loadConnections(7)
        await store.syncAggregator(7, 'zernio')

        expect(get.mock.calls.filter((call) => String(call[0]).includes('/connections'))).toHaveLength(2)
    })
})

describe('stores/social — the connections', () => {
    it('joins the connections read that is already in flight', async () => {
        // The app's shell and the accounts screen ask for the same
        // connections at once; the second one waits for the read that is
        // already on its way.
        let release: (payload: unknown) => void = () => {}
        get.mockImplementationOnce(
            () => new Promise((resolve) => { release = resolve }),
        )
        const store = useSocialStore()

        const first = store.loadConnections(7)
        const second = store.loadConnections(7)
        release(CONNECTIONS_PAYLOAD)
        await Promise.all([first, second])

        expect(get).toHaveBeenCalledTimes(1)
        expect(store.connections).toHaveLength(3)
    })

    it('reads the connections of a principal once', async () => {
        get.mockResolvedValue(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()

        await store.loadConnections(7)
        await store.loadConnections(7)

        expect(get).toHaveBeenCalledTimes(1)
    })

    it('reads the connections again for another principal', async () => {
        // The connections belong to the principal.
        get.mockResolvedValue(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()

        await store.loadConnections(7)
        await store.loadConnections(9)

        expect(get).toHaveBeenCalledTimes(2)
    })

    it('drops the connections of the principal being left', async () => {
        // The accounts on screen belong to the principal that is being left;
        // showing them under the new one would be a lie about whose
        // accounts they are.
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()
        await store.loadConnections(7)
        expect(store.connections).toHaveLength(3)

        let release: (payload: unknown) => void = () => {}
        get.mockImplementationOnce(
            () => new Promise((resolve) => { release = resolve }),
        )
        const pending = store.loadConnections(9)

        expect(store.connections).toEqual([])

        release([])
        await pending
    })

    it('disconnects a connection and drops it from the list', async () => {
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()
        await store.loadConnections(7)

        await store.disconnectConnection(7, 1)

        expect(store.connections.map((connection) => connection.id)).toEqual([2, 3])
    })

    it('reports a failed disconnect', async () => {
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()
        await store.loadConnections(7)
        del.mockRejectedValueOnce(new Error('boom'))

        await store.disconnectConnection(7, 1)

        expect(store.error).not.toBeNull()
    })

    it('refreshes a token and puts the fresh connection back', async () => {
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        post.mockResolvedValueOnce({ ...CONNECTIONS_PAYLOAD[0], status: 'active' })
        const store = useSocialStore()
        await store.loadConnections(7)

        await store.refreshConnection(7, 1)

        expect(post).toHaveBeenCalledWith('/plugins/social/connections/1/refresh', { principal_id: 7 })
        expect(store.connections[0]?.status).toBe('active')
    })

    it('reports a failed refresh', async () => {
        post.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        await store.refreshConnection(7, 1)

        expect(store.error).not.toBeNull()
    })

    it('checks a connection’s health', async () => {
        post.mockResolvedValueOnce({ status: 'active', needs_reconnect: false, message: null })
        const store = useSocialStore()

        const health = await store.checkConnectionHealth(7, 1)

        expect(post).toHaveBeenCalledWith('/plugins/social/connections/1/health', { principal_id: 7 })
        expect(health?.status).toBe('active')
    })

    it('reports a failed health check', async () => {
        post.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const health = await store.checkConnectionHealth(7, 1)

        expect(health).toBeNull()
        expect(store.error).not.toBeNull()
    })

    it('reports a failed OAuth round trip', async () => {
        post.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const result = await store.connectProvider(7, 'meta')

        expect(result).toBeNull()
        expect(store.error).not.toBeNull()
    })
})

describe('stores/social — the posts', () => {
    it('reports a failed save', async () => {
        post.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const created = await store.createPost({
            principal_id: 7,
            title: 'Q4 release',
            body: 'We shipped…',
            account_ids: [12],
            scheduled_for: null,
            timezone: 'Europe/Zurich',
            publish_now: false,
        })

        expect(created).toBeNull()
        expect(store.error).not.toBeNull()
    })

    it('publishes a post and puts the published one back', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87 })], total: 1 })
        post.mockResolvedValueOnce(makePost({ id: 87, status: 'published' }))
        const store = useSocialStore()
        await store.loadPosts(7)

        const published = await store.publishPost(7, 87)

        expect(published?.status).toBe('published')
        expect(store.posts[0]?.status).toBe('published')
    })

    it('reports a failed publish', async () => {
        post.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const published = await store.publishPost(7, 87)

        expect(published).toBeNull()
        expect(store.error).not.toBeNull()
    })

    it('retries the failed targets', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87 })], total: 1 })
        post.mockResolvedValueOnce(makePost({ id: 87, status: 'published' }))
        const store = useSocialStore()
        await store.loadPosts(7)

        const retried = await store.retryPost(7, 87)

        expect(post).toHaveBeenCalledWith('/plugins/social/posts/87/retry', { principal_id: 7 })
        expect(retried?.status).toBe('published')
    })

    it('reports a failed retry', async () => {
        post.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const retried = await store.retryPost(7, 87)

        expect(retried).toBeNull()
        expect(store.error).not.toBeNull()
    })

    it('takes a published post back down', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87 })], total: 1 })
        del.mockResolvedValueOnce(makePost({ id: 87, status: 'partial' }))
        const store = useSocialStore()
        await store.loadPosts(7)

        const taken = await store.unpublishPost(7, 87)

        expect(del).toHaveBeenCalledWith('/plugins/social/posts/87/published?principal_id=7')
        expect(taken?.status).toBe('partial')
    })

    it('reports a failed take-down', async () => {
        del.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const taken = await store.unpublishPost(7, 87)

        expect(taken).toBeNull()
        expect(store.error).not.toBeNull()
    })

    it('reports a failed delete', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87 })], total: 1 })
        const store = useSocialStore()
        await store.loadPosts(7)
        del.mockRejectedValueOnce(new Error('boom'))

        await store.deletePost(7, 87)

        expect(store.error).not.toBeNull()
        expect(store.posts).toHaveLength(1)
    })

    it('saves the changes to a post and puts the saved one back', async () => {
        get.mockResolvedValueOnce({ items: [makePost({ id: 87, body: 'The old copy.' })], total: 1 })
        patch.mockResolvedValueOnce(makePost({ id: 87, body: 'The new copy.' }))
        const store = useSocialStore()
        await store.loadPosts(7)

        const updated = await store.updatePost(7, 87, { body: 'The new copy.' })

        expect(patch).toHaveBeenCalledWith('/plugins/social/posts/87', {
            body: 'The new copy.',
            principal_id: 7,
        })
        expect(updated?.body).toBe('The new copy.')
        expect(store.posts[0]?.body).toBe('The new copy.')
    })

    it('reports a failed save', async () => {
        patch.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()

        const updated = await store.updatePost(7, 87, { body: 'The new copy.' })

        expect(updated).toBeNull()
        expect(store.error).not.toBeNull()
    })
})

describe('stores/social — the notices', () => {
    it('carries a notice and clears it again', () => {
        const store = useSocialStore()

        store.setNotice('Published.')
        expect(store.notice).toBe('Published.')

        store.setNotice(null)
        expect(store.notice).toBeNull()
    })

    it('clears the error', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = useSocialStore()
        await store.loadConnections(7)
        expect(store.error).not.toBeNull()

        store.clearError()

        expect(store.error).toBeNull()
    })
})
