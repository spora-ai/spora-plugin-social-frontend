import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import PostsPage from '../../src/pages/PostsPage.vue'
import AnalyticsView from '../../src/components/AnalyticsView.vue'
import PostsTable from '../../src/components/PostsTable.vue'
import { APP_ROUTES } from '../../src/lib/routes'
import { useSocialStore } from '../../src/stores/social'
import { makeMedia, makeMetrics, makePost, makeTarget } from '../fixtures'
import { SUMMARY_PAYLOAD } from '../recorded'
import { mountPage } from '../mountPage'

function makeRouter() {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

/** Whether `first` comes before `second` in the document. */
function appearsBefore(first: Element, second: Element): boolean {
    return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

describe('PostsPage — the two views of the Posts tab', () => {
    it('shows the posts list by default', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.findComponent(PostsTable).exists()).toBe(true)
        expect(wrapper.findComponent(AnalyticsView).exists()).toBe(false)
    })

    it('offers Analytics as a route, not a flag', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        const segment = wrapper.find('[data-test="segment-analytics"]')
        expect(segment.exists()).toBe(true)
        expect(segment.attributes('href')).toBe('/p/7/posts/analytics')
    })

    it('shows the analytics view when the route names it', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.analytics = SUMMARY_PAYLOAD

        const router = makeRouter()
        await router.push('/p/7/posts/analytics')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.findComponent(AnalyticsView).exists()).toBe(true)
        expect(wrapper.findComponent(PostsTable).exists()).toBe(false)
    })

    it('keeps the posts list on the other segment', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="segment-posts"]').attributes('href')).toBe('/p/7/posts')
        expect(wrapper.find('[data-test="segment-analytics"]').attributes('aria-selected')).toBe('false')
    })

    it('marks the analytics segment as the current one', async () => {
        const pinia = createPinia()
        const router = makeRouter()
        await router.push('/p/7/posts/analytics')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="segment-analytics"]').attributes('aria-selected')).toBe('true')
    })

    it('opens a post as a drawer over the list, with its per-target results', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [
            makePost({
                id: 88,
                targets: [
                    {
                        id: 501,
                        account_id: 12,
                        platform: 'linkedin',
                        status: 'published',
                        external_id: 'urn:li:share:9',
                        external_url: 'https://www.linkedin.com/feed/update/urn:li:share:9',
                        error: null,
                        published_at: '2026-11-02T09:00:04+00:00',
                        metrics: null,
                    },
                    {
                        id: 502,
                        account_id: 13,
                        platform: 'instagram',
                        status: 'failed',
                        external_id: null,
                        external_url: null,
                        error: 'Instagram only accepts JPEG for image posts.',
                        published_at: null,
                        metrics: null,
                    },
                ],
            }),
        ]

        const router = makeRouter()
        await router.push('/p/7/post/88')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        const drawer = wrapper.find('[data-test="post-drawer"]')
        expect(drawer.exists()).toBe(true)
        expect(drawer.find('[data-test="target-result-501"]').exists()).toBe(true)
        expect(drawer.find('[data-test="target-result-502"]').exists()).toBe(true)
        // The failure the platform reported is shown on the target it belongs to.
        expect(drawer.text()).toContain('Instagram only accepts JPEG')
    })

    it('names a target’s outcome in words, not in the raw enum', async () => {
        // The post's own status was translated; the target's status was the
        // one English word left on the screen.
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [
            makePost({
                id: 88,
                targets: [
                    {
                        id: 501,
                        account_id: 12,
                        platform: 'linkedin',
                        status: 'published',
                        external_id: 'urn:li:share:9',
                        external_url: null,
                        error: null,
                        published_at: '2026-11-02T09:00:04+00:00',
                        metrics: null,
                    },
                ],
            }),
        ]

        const router = makeRouter()
        await router.push('/p/7/post/88')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        const target = wrapper.find('[data-test="target-result-501"]')
        expect(target.text()).toContain('Published')
        expect(target.text()).not.toContain('published')
    })
})

describe('PostsPage — the post drawer', () => {
    async function openDrawer(post: ReturnType<typeof makePost>) {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [post]

        const router = makeRouter()
        await router.push(`/p/7/post/${post.id}`)
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()
        return wrapper
    }

    it('offers to take a published post back down', async () => {
        const wrapper = await openDrawer(makePost({ status: 'published' }))

        const button = wrapper.find('[data-test="drawer-take-down"]')
        expect(button.exists()).toBe(true)
        expect(button.text()).toContain('Take down')
    })

    it('does not offer to take down a post that never went out', async () => {
        const wrapper = await openDrawer(makePost({ status: 'draft' }))

        expect(wrapper.find('[data-test="drawer-take-down"]').exists()).toBe(false)
    })

    it('puts the image above the text', async () => {
        const wrapper = await openDrawer(makePost({ media: [makeMedia({ media_asset_id: 'asset-1' })] }))

        const drawer = wrapper.find('[data-test="post-drawer"]')
        const image = drawer.find('[data-test="post-image-asset-1"]').element
        const text = drawer.find('[data-test="drawer-text"]').element

        expect(image).not.toBeNull()
        // A post reads like a post: the picture, then the words.
        expect(appearsBefore(image, text)).toBe(true)
    })

    it('spans the width of the drawer’s content area', async () => {
        const wrapper = await openDrawer(makePost({ media: [makeMedia({ media_asset_id: 'asset-1' })] }))

        const image = wrapper.find('[data-test="post-drawer"]').find('[data-test="post-image-asset-1"]')
        expect(image.classes()).toContain('w-full')
        // Bounded, so a tall image cannot push the text off the screen.
        expect(image.classes()).toContain('max-h-[420px]')
    })

    it('keeps the layout when the post has no image', async () => {
        const wrapper = await openDrawer(makePost({ media: [] }))
        const drawer = wrapper.find('[data-test="post-drawer"]')

        expect(drawer.find('[data-test="drawer-media"]').exists()).toBe(false)
        expect(drawer.find('[data-test="drawer-text"]').exists()).toBe(true)
    })

    it('leads with the first attachment and strips the rest', async () => {
        const wrapper = await openDrawer(
            makePost({
                media: [
                    makeMedia({
                        media_asset_id: 'asset-2',
                        position: 1,
                        filename: 'second.png',
                        asset_url: '/api/v1/assets/asset-2.png',
                    }),
                    makeMedia({
                        media_asset_id: 'asset-1',
                        position: 0,
                        filename: 'first.png',
                        asset_url: '/api/v1/assets/asset-1.png',
                    }),
                ],
            }),
        )

        const drawer = wrapper.find('[data-test="post-drawer"]')

        // The prominent one is the lowest `position`, whatever order the
        // payload listed them in.
        expect(drawer.find('[data-test="post-image-asset-1"]').exists()).toBe(true)
        expect(drawer.find('[data-test="drawer-media-strip"]').exists()).toBe(true)

        const strip = drawer.find('[data-test="drawer-media-strip"]')
        expect(strip.find('[data-test="post-image-asset-2"]').exists()).toBe(true)
        expect(strip.find('[data-test="post-image-asset-2"]').attributes('src')).toBe(
            '/api/v1/assets/asset-2.png',
        )
        expect(strip.find('[data-test="post-image-asset-1"]').exists()).toBe(false)
    })

    it('renders a placeholder for an asset that is gone, not a broken image', async () => {
        const wrapper = await openDrawer(
            makePost({ media: [makeMedia({ media_asset_id: 'asset-1', asset_url: null })] }),
        )

        const drawer = wrapper.find('[data-test="post-drawer"]')

        expect(drawer.find('img').exists()).toBe(false)
        expect(drawer.find('[data-test="post-image-placeholder-asset-1"]').exists()).toBe(true)
    })

    it('renders a target whose reach was never reported, and does not throw', async () => {
        // A LinkedIn member post reports reactions and nothing else: no reach,
        // no impressions. Reading them as numbers crashed the drawer.
        const errors: unknown[][] = []
        const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
            errors.push(args)
        })

        const wrapper = await openDrawer(
            makePost({
                targets: [
                    makeTarget({
                        metrics: makeMetrics({
                            reach: null,
                            impressions: null,
                            likes: 12,
                            comments: 3,
                            shares: 1,
                            saves: null,
                            clicks: null,
                        }),
                    }),
                ],
            }),
        )

        const drawer = wrapper.find('[data-test="post-drawer"]')
        spy.mockRestore()

        // Vue logs a render error instead of throwing it, so the absence of an
        // error is what proves the drawer did not fall over.
        expect(errors).toEqual([])
        expect(drawer.exists()).toBe(true)
        expect(drawer.find('[data-test="target-reach-501"]').text()).toBe('—')
        expect(drawer.find('[data-test="target-impressions-501"]').text()).toBe('—')
        // The counters that *were* reported still read as numbers.
        expect(drawer.text()).toContain('12')
    })
})
