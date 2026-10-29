import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setApi } from '../../src/api/client'
import * as social from '../../src/api/social'
import {
    CALENDAR_PAYLOAD,
    CONFIG_PAYLOAD,
    CONNECTIONS_PAYLOAD,
    MEDIA_PAYLOAD,
    UNCONFIGURED_CONFIG_PAYLOAD,
} from '../recorded'
import type { PluginHostContext } from '../../src/shims'

let get: ReturnType<typeof vi.fn>
let post: ReturnType<typeof vi.fn>
let patch: ReturnType<typeof vi.fn>
let del: ReturnType<typeof vi.fn>

beforeEach(() => {
    // A list, because the backend answers a list endpoint with a list — and a
    // shape that is not one is a loud failure, not an empty screen.
    get = vi.fn().mockResolvedValue([])
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

describe('api/social — the paths', () => {
    it('reads the connections of a principal', async () => {
        await social.listConnections(3)
        expect(get).toHaveBeenCalledWith('/plugins/social/connections', { principal_id: 3 })
    })

    it('reads one connection', async () => {
        await social.getConnection(3, 1)
        expect(get).toHaveBeenCalledWith('/plugins/social/connections/1', { principal_id: 3 })
    })

    it('starts the OAuth round trip for a provider', async () => {
        await social.connectProvider(3, 'meta')
        expect(post).toHaveBeenCalledWith('/plugins/social/connections/connect', {
            principal_id: 3,
            provider: 'meta',
        })
    })

    it('disconnects a connection', async () => {
        await social.disconnectConnection(3, 1)
        expect(del).toHaveBeenCalledWith('/plugins/social/connections/1?principal_id=3')
    })

    it('refreshes a token', async () => {
        await social.refreshConnection(3, 1)
        expect(post).toHaveBeenCalledWith('/plugins/social/connections/1/refresh', { principal_id: 3 })
    })

    it('checks a connection’s health', async () => {
        await social.checkConnectionHealth(3, 1)
        expect(post).toHaveBeenCalledWith('/plugins/social/connections/1/health', { principal_id: 3 })
    })

    it('reads the plugin configuration', async () => {
        await social.getConfig()
        expect(get).toHaveBeenCalledWith('/plugins/social/config')
    })

    it('reads the posts of a principal, with the filters', async () => {
        await social.listPosts(3, { status: 'scheduled', platform: 'linkedin', limit: 20 })
        expect(get).toHaveBeenCalledWith('/plugins/social/posts', {
            principal_id: 3,
            status: 'scheduled',
            platform: 'linkedin',
            limit: 20,
        })
    })

    it('creates a post with the principal in the body', async () => {
        await social.createPost({
            principal_id: 3,
            title: 'Q4 release',
            body: 'We shipped…',
            account_ids: [12],
            scheduled_for: null,
            timezone: 'Europe/Zurich',
            publish_now: false,
        })
        expect(post).toHaveBeenCalledWith('/plugins/social/posts', {
            principal_id: 3,
            title: 'Q4 release',
            body: 'We shipped…',
            account_ids: [12],
            scheduled_for: null,
            timezone: 'Europe/Zurich',
            publish_now: false,
        })
    })

    it('publishes and retries a post', async () => {
        await social.publishPost(3, 88)
        await social.retryPost(3, 88)
        expect(post).toHaveBeenCalledWith('/plugins/social/posts/88/publish', { principal_id: 3 })
        expect(post).toHaveBeenCalledWith('/plugins/social/posts/88/retry', { principal_id: 3 })
    })

    it('reads the calendar of a month', async () => {
        await social.getCalendar(3, '2026-11')
        expect(get).toHaveBeenCalledWith('/plugins/social/calendar', {
            principal_id: 3,
            month: '2026-11',
        })
    })

    it('reads the analytics summary with the window', async () => {
        await social.getAnalyticsSummary(3, 30)
        expect(get).toHaveBeenCalledWith('/plugins/social/analytics/summary', {
            principal_id: 3,
            days: 30,
        })
    })

    it('asks for a draft per platform', async () => {
        await social.generateDraft({
            principal_id: 3,
            brief: 'Q4 release',
            platforms: ['linkedin', 'facebook'],
            account_ids: [12],
        })
        expect(post).toHaveBeenCalledWith('/plugins/social/drafts/generate', {
            principal_id: 3,
            brief: 'Q4 release',
            platforms: ['linkedin', 'facebook'],
            account_ids: [12],
        })
    })

    it('never calls the routes the rework removed', async () => {
        await social.listConnections(3)
        await social.listPosts(3)
        await social.getCalendar(3, '2026-11')
        await social.listMedia(3)
        await social.getConfig()

        const paths = get.mock.calls.map((call) => String(call[0]))
        expect(paths.some((path) => path.includes('/accounts'))).toBe(false)
        // The config is asked for once, not once per platform.
        expect(paths.filter((path) => path.includes('/config'))).toHaveLength(1)
        expect(paths.some((path) => path.includes('platform='))).toBe(false)
    })

    it('names the principal on every call that addresses a record', async () => {
        await social.getConnection(3, 1)
        await social.disconnectConnection(3, 1)
        await social.refreshConnection(3, 1)
        await social.checkConnectionHealth(3, 1)
        await social.getPost(3, 88)
        await social.updatePost(3, 88, { title: 'x' })
        await social.deletePost(3, 88)
        await social.publishPost(3, 88)
        await social.retryPost(3, 88)
        await social.getPostAnalytics(3, 88)
        await social.checkMediaFit(3, 'asset-1', ['linkedin'])
        await social.prepareMedia(3, 'asset-1', 'instagram')
        await social.attachMedia(3, 88, 'asset-1', 0)
        await social.detachMedia(3, 88, 'asset-1')

        const calls = [...get.mock.calls, ...post.mock.calls, ...patch.mock.calls, ...del.mock.calls]

        const unnamed = calls.filter((call) => {
            const [path, payload] = call as [string, unknown]
            if (typeof path === 'string' && path.includes('principal_id=')) return false
            if (payload !== null && typeof payload === 'object') {
                return !('principal_id' in (payload as Record<string, unknown>))
            }
            return true
        })

        expect(unnamed.map((call) => call[0])).toEqual([])
    })
})

describe('api/social — the shapes', () => {
    it('reads the connections the backend sent — a bare list', async () => {
        get.mockResolvedValueOnce(CONNECTIONS_PAYLOAD)
        const connections = await social.listConnections(3)

        expect(connections).toHaveLength(2)
        expect(connections[0]?.accounts).toHaveLength(2)
    })

    it('reads the posts envelope', async () => {
        get.mockResolvedValueOnce({ items: [{ id: 88 }], total: 1 })
        await expect(social.listPosts(3)).resolves.toEqual({ items: [{ id: 88 }], total: 1 })
    })

    it('says so when a list arrives as something else', async () => {
        // A shape change must be loud: an envelope the frontend invented is
        // how the two halves came to disagree about a payload.
        get.mockResolvedValueOnce({ connections: [] })
        await expect(social.listConnections(3)).rejects.toThrow('did not answer with a list')
    })

    it('reads the provider entries of the config', async () => {
        get.mockResolvedValueOnce(CONFIG_PAYLOAD)
        const config = await social.getConfig()

        expect(config.providers.meta.configured).toBe(true)
        // A configured provider has no notice: the backend sends one exactly
        // when the provider needs setup.
        expect(config.providers.meta.needs_setup).toBeNull()
        expect(config.providers.meta.client_id).toBe('spora-meta-app-id')
        expect(config.providers.meta.config_id).toBe('9876')
        expect(config.providers.linkedin.config_id).toBeNull()
        expect(config.app_url).toBe('https://spora.example.com')
        expect(config.app_url_public).toBe(true)
    })

    it('treats a provider entry that is absent as not configured', async () => {
        get.mockResolvedValueOnce({ app_url: null, app_url_public: false })
        const config = await social.getConfig()

        expect(config.providers.meta).toEqual({
            configured: false,
            client_id: null,
            config_id: null,
            needs_setup: null,
        })
        expect(config.providers.linkedin.configured).toBe(false)
        expect(config.app_url).toBeNull()
        expect(config.app_url_public).toBe(false)
    })

    it('treats a missing field of an entry as not configured', async () => {
        // A malformed entry must not slip through as "configured".
        get.mockResolvedValueOnce({
            providers: { meta: { client_id: 'spora-meta-app-id' } },
        })
        const config = await social.getConfig()

        expect(config.providers.meta.configured).toBe(false)
        expect(config.providers.meta.client_id).toBe('spora-meta-app-id')
    })

    it('reads the setup notice of an unconfigured provider', async () => {
        get.mockResolvedValueOnce(UNCONFIGURED_CONFIG_PAYLOAD)
        const config = await social.getConfig()

        expect(config.providers.meta.configured).toBe(false)
        expect(config.providers.meta.needs_setup?.title).toBe('Meta integration needs setup')
        expect(config.providers.linkedin.needs_setup?.body).toBe(
            'Add the client id, the client secret and the requested permissions in Settings → Plugins.',
        )
    })

    it('reads the rules the backend enforces', async () => {
        get.mockResolvedValueOnce(CONFIG_PAYLOAD)
        const config = await social.getConfig()

        expect(config.rules.instagram.max_text).toBe(2200)
        expect(config.rules.instagram.media_required).toBe(true)
        expect(config.rules.instagram.fetches_media).toBe(true)
        expect(config.rules.linkedin.max_text).toBe(3000)
    })

    it('reads the media assets the backend sent — a bare list', async () => {
        get.mockResolvedValueOnce(MEDIA_PAYLOAD)
        await expect(social.listMedia(3)).resolves.toHaveLength(1)
    })

    it('reads the calendar the backend sent, keyed by post id', async () => {
        get.mockResolvedValueOnce(CALENDAR_PAYLOAD)
        const calendar = await social.getCalendar(3, '2026-11')

        expect(calendar.posts[0]?.post_id).toBe(88)
        // The month carries the posts and nothing else: the `days` key
        // existed for the slot tint, and the static slot is gone.
        expect(Object.keys(calendar)).toEqual(['posts'])
    })

    it('fills an analytics summary that comes back empty', async () => {
        get.mockResolvedValueOnce({})
        const summary = await social.getAnalyticsSummary(3)

        expect(summary.by_network).toEqual([])
        expect(summary.series).toEqual([])
        expect(summary.top_posts).toEqual([])
        expect(summary.notes).toEqual([])
        // Nothing was reported, which is not the same as nothing reached
        // anybody.
        expect(summary.totals.reach).toBeNull()
    })
})
