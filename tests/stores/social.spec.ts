import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { setApi } from '../../src/api/client'
import { useSocialStore } from '../../src/stores/social'
import { CONFIG_PAYLOAD, CONNECTIONS_PAYLOAD } from '../recorded'
import { makePost } from '../fixtures'
import type { PluginHostContext } from '../../src/shims'

let get: ReturnType<typeof vi.fn>
let post: ReturnType<typeof vi.fn>

beforeEach(() => {
    setActivePinia(createPinia())
    get = vi.fn().mockResolvedValue({})
    post = vi.fn().mockResolvedValue({})
    setApi({
        get: get as never,
        post: post as never,
        put: vi.fn() as never,
        patch: vi.fn() as never,
        delete: vi.fn() as never,
    } satisfies PluginHostContext['api'])
})

describe('stores/social', () => {
    it('reads the connections of a principal', async () => {
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()

        await store.loadConnections(7)

        expect(get).toHaveBeenCalledWith('/plugins/social/connections', { principal_id: 7 })
        expect(store.connections).toHaveLength(2)
    })

    it('flattens the accounts of every connection', async () => {
        // The accounts arrive inside their connection; the composer's picker
        // needs them on their own.
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const store = useSocialStore()

        await store.loadConnections(7)

        expect(store.accounts).toHaveLength(3)
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

    it('reads no redirect URI — the setup instruction lives in the settings', async () => {
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig()

        expect(store.config?.providers.linkedin).not.toHaveProperty('redirect_uri')
        expect(store.config?.providers.meta).not.toHaveProperty('redirect_uri')
    })

    it('reads the rules the backend enforces', async () => {
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig()

        expect(store.rules.linkedin?.max_text).toBe(3000)
        expect(store.rules.instagram?.max_text).toBe(2200)
        expect(store.rules.instagram?.media_note).toBe('Instagram accepts JPEG or MP4, up to 100 MB.')
    })

    it('reads the config once', async () => {
        get.mockResolvedValue(CONFIG_PAYLOAD)
        const store = useSocialStore()

        await store.loadConfig()
        await store.loadConfig()

        expect(get).toHaveBeenCalledTimes(1)
        expect(get).toHaveBeenCalledWith('/plugins/social/config')
    })

    it('has no rules when the config could not be read', async () => {
        get.mockRejectedValue(new Error('boom'))
        const store = useSocialStore()

        await store.loadConfig()

        expect(store.configError).not.toBeNull()
        expect(store.rules).toEqual({})
    })
})
