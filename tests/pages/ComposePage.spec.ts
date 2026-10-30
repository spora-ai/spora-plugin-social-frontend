import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ComposePage from '../../src/pages/ComposePage.vue'
import { APP_ROUTES } from '../../src/lib/routes'
import { useSocialStore } from '../../src/stores/social'
import { makeAccount, makeConnection, makePost, makeTarget } from '../fixtures'
import { CONFIG_PAYLOAD } from '../recorded'
import { hostContext, mountPage } from '../mountPage'

function makeRouter() {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

describe('ComposePage', () => {
    it('renders the composer', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="composer"]').exists()).toBe(true)
    })

    it('opens the host’s media picker rather than a dialog of its own', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const openMediaPicker = vi.fn().mockResolvedValue([])
        const wrapper = mountPage(ComposePage, pinia, router, hostContext({ openMediaPicker }))
        await flushPromises()

        await wrapper.find('[data-test="attach-media"]').trigger('click')
        await flushPromises()

        // The host's picker lists the Media Archive and uploads; the plugin
        // ships no upload dialog of its own.
        expect(openMediaPicker).toHaveBeenCalledWith({ multi: true, mediaKind: 'image' })
    })

    it('lists the accounts the operator may publish to', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.connections = [
            makeConnection({
                accounts: [
                    makeAccount({ id: 12, display_name: 'Fabeat GmbH' }),
                    makeAccount({ id: 13, platform: 'instagram', display_name: '@fabeat.gmbh' }),
                ],
            }),
        ]

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="target-12"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="target-13"]').exists()).toBe(true)
    })

    it('shows the accounts that need a human', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.connections = [
            makeConnection({
                status: 'expired',
                needs_reconnect: true,
                expires_at: new Date(Date.now() - 3 * 86400000).toISOString(),
                accounts: [makeAccount({ id: 12, status: 'expired' })],
            }),
        ]

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="attention-1"]').exists()).toBe(true)
    })

    it('counts against the limit the backend enforces', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.connections = [
            makeConnection({ accounts: [makeAccount({ id: 13, platform: 'instagram' })] }),
        ]
        // A limit the frontend never carried: the counter has to follow the
        // backend, not a copy of it.
        social.config = {
            ...CONFIG_PAYLOAD,
            rules: {
                ...CONFIG_PAYLOAD.rules,
                instagram: { ...CONFIG_PAYLOAD.rules.instagram!, max_text: 1234 },
            },
        }

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        await wrapper.find('[data-test="target-13"]').setValue(true)
        await flushPromises()

        expect(wrapper.find('[data-test="preview-instagram"] .char-count').text()).toBe('0 / 1234')
    })

    it('says the limits are unknown while the rules have not arrived', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.connections = [makeConnection({ accounts: [makeAccount({ id: 12 })] })]

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()

        // No rule, no counter: the frontend does not guess a limit.
        expect(wrapper.find('[data-test="preview-linkedin"] .char-count').exists()).toBe(false)
        expect(wrapper.find('[data-test="count-unknown"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="rule-note"]').exists()).toBe(false)
    })

    it('shows the rule the backend sent', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.connections = [
            makeConnection({ accounts: [makeAccount({ id: 13, platform: 'instagram' })] }),
        ]
        social.config = CONFIG_PAYLOAD

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        await wrapper.find('[data-test="target-13"]').setValue(true)
        await flushPromises()

        expect(wrapper.find('[data-test="rule-note"]').text()).toBe(
            'Instagram accepts JPEG or MP4, up to 100 MB.',
        )
    })

    it('says so when the config could not be read', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.connections = [makeConnection({ accounts: [makeAccount({ id: 12 })] })]
        social.configError = 'Could not read the plugin configuration.'

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="rules-unavailable"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="rules-unavailable"]').text()).toContain(
            'The platform limits could not be read, so they are not checked.',
        )
    })
})

describe('ComposePage — the queue below the composer', () => {
    it('lists the scheduled posts, soonest first', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [
            makePost({ id: 89, status: 'scheduled', scheduled_for: '2026-11-20T09:00:00+00:00' }),
            makePost({ id: 88, status: 'scheduled', scheduled_for: '2026-11-09T09:00:00+00:00' }),
            makePost({ id: 90, status: 'published', scheduled_for: null }),
        ]

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        const links = wrapper.findAll('[data-test^="up-next-"]')
        expect(links.map((link) => link.attributes('data-test'))).toEqual([
            'up-next-88',
            'up-next-89',
        ])
    })

    it('names the networks a scheduled post goes to, once each', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [
            makePost({
                id: 88,
                status: 'scheduled',
                scheduled_for: '2026-11-09T09:00:00+00:00',
                targets: [
                    makeTarget({ id: 501, platform: 'linkedin' }),
                    makeTarget({ id: 502, platform: 'linkedin' }),
                    makeTarget({ id: 503, platform: 'instagram' }),
                ],
            }),
        ]

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        const link = wrapper.find('[data-test="up-next-88"]')
        expect(link.findAll('[data-platform="linkedin"]')).toHaveLength(1)
        expect(link.findAll('[data-platform="instagram"]')).toHaveLength(1)
    })

    it('says so when nothing is scheduled', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        expect(wrapper.text()).toContain('Nothing scheduled.')
    })

    it('reloads the posts when the principal changes', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const get = vi.fn().mockResolvedValue({ items: [], total: 0 })
        const context = hostContext()
        context.api.get = get as never

        mountPage(ComposePage, pinia, router, context)
        await flushPromises()
        get.mockClear()

        await router.push('/p/8/compose')
        await flushPromises()

        expect(get).toHaveBeenCalledWith('/plugins/social/posts', { principal_id: 8 })
    })

    it('shows no composer without a principal', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/')
        await router.isReady()

        const wrapper = mountPage(ComposePage, pinia, router)
        await flushPromises()

        // The composer publishes under a scope, so it waits for one.
        expect(wrapper.find('[data-test="composer"]').exists()).toBe(false)
    })
})
