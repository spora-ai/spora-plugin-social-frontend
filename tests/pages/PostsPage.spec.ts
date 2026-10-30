import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import type { Router } from 'vue-router'
import PostsPage from '../../src/pages/PostsPage.vue'
import AnalyticsView from '../../src/components/AnalyticsView.vue'
import PostsTable from '../../src/components/PostsTable.vue'
import { useSocialStore } from '../../src/stores/social'
import { makeMedia, makeMetrics, makePost, makeTarget } from '../fixtures'
import { SUMMARY_PAYLOAD } from '../recorded'
import { hostContext, mountPage, stubRoutes } from '../mountPage'
import type { PluginHostContext } from '../../src/shims'
import type { SocialPost } from '../../src/types'

/**
 * A host context that answers the post routes.
 *
 * The drawer acts on the post the API hands back, so a stub that answers
 * nothing would leave the drawer without a post to show.
 */
function contextWithPost(post: SocialPost): PluginHostContext {
    const context = hostContext()
    context.api.get = vi.fn().mockImplementation((path: string) => {
        if (path.includes('/plugins/social/posts/')) return Promise.resolve(post)
        if (path.includes('/plugins/social/posts')) return Promise.resolve({ items: [], total: 0 })
        return Promise.resolve({})
    }) as never
    context.api.post = vi.fn().mockResolvedValue(post) as never
    context.api.delete = vi.fn().mockResolvedValue({ deleted: true }) as never
    return context
}

/** Whether `first` comes before `second` in the document. */
function appearsBefore(first: Element, second: Element): boolean {
    return (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

/** The posts the drawer tests open on. */
const PUBLISHED_POST = makePost({ id: 88, status: 'published' })
const DRAFT_POST = makePost({ id: 88, status: 'draft' })

/**
 * The page with the drawer open on a post.
 *
 * The drawer opens over the list, so the post has to be in the store before
 * the page mounts — a drawer that reads the post from the API is the deep
 * link's path, not the list's.
 */
async function mountDrawer(
    post: SocialPost,
    options: { context?: PluginHostContext } = {},
): Promise<{
    wrapper: ReturnType<typeof mountPage>
    router: Router
    context: PluginHostContext
    social: ReturnType<typeof useSocialStore>
}> {
    const pinia = createPinia()
    const social = useSocialStore(pinia)
    social.posts = [post]

    const router = stubRoutes()
    await router.push(`/p/7/post/${post.id}`)
    await router.isReady()

    const context = options.context ?? contextWithPost(post)
    const wrapper = mountPage(PostsPage, pinia, router, context)
    await flushPromises()
    return { wrapper, router, context, social }
}

describe('PostsPage — the two views of the Posts tab', () => {
    it('shows the posts list by default', async () => {
        const pinia = createPinia()
        const router = stubRoutes()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.findComponent(PostsTable).exists()).toBe(true)
        expect(wrapper.findComponent(AnalyticsView).exists()).toBe(false)
    })

    it('offers Analytics as a route, not a flag', async () => {
        const pinia = createPinia()
        const router = stubRoutes()
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

        const router = stubRoutes()
        await router.push('/p/7/posts/analytics')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.findComponent(AnalyticsView).exists()).toBe(true)
        expect(wrapper.findComponent(PostsTable).exists()).toBe(false)
    })

    it('keeps the posts list on the other segment', async () => {
        const pinia = createPinia()
        const router = stubRoutes()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="segment-posts"]').attributes('href')).toBe('/p/7/posts')
        expect(wrapper.find('[data-test="segment-analytics"]').attributes('aria-selected')).toBe('false')
    })

    it('marks the analytics segment as the current one', async () => {
        const pinia = createPinia()
        const router = stubRoutes()
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

        const router = stubRoutes()
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

        const router = stubRoutes()
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
    it('offers to take a published post back down', async () => {
        const { wrapper } = await mountDrawer(makePost({ status: 'published' }))

        const button = wrapper.find('[data-test="drawer-take-down"]')
        expect(button.exists()).toBe(true)
        expect(button.text()).toContain('Take down')
    })

    it('does not offer to take down a post that never went out', async () => {
        const { wrapper } = await mountDrawer(makePost({ status: 'draft' }))

        expect(wrapper.find('[data-test="drawer-take-down"]').exists()).toBe(false)
    })

    it('puts the image above the text', async () => {
        const { wrapper } = await mountDrawer(makePost({ media: [makeMedia({ media_asset_id: 'asset-1' })] }))

        const drawer = wrapper.find('[data-test="post-drawer"]')
        const image = drawer.find('[data-test="post-image-asset-1"]').element
        const text = drawer.find('[data-test="drawer-text"]').element

        expect(image).not.toBeNull()
        // A post reads like a post: the picture, then the words.
        expect(appearsBefore(image, text)).toBe(true)
    })

    it('spans the width of the drawer’s content area', async () => {
        const { wrapper } = await mountDrawer(makePost({ media: [makeMedia({ media_asset_id: 'asset-1' })] }))

        const image = wrapper.find('[data-test="post-drawer"]').find('[data-test="post-image-asset-1"]')
        expect(image.classes()).toContain('w-full')
        // Bounded, so a tall image cannot push the text off the screen.
        expect(image.classes()).toContain('max-h-[420px]')
    })

    it('keeps the layout when the post has no image', async () => {
        const { wrapper } = await mountDrawer(makePost({ media: [] }))
        const drawer = wrapper.find('[data-test="post-drawer"]')

        expect(drawer.find('[data-test="drawer-media"]').exists()).toBe(false)
        expect(drawer.find('[data-test="drawer-text"]').exists()).toBe(true)
    })

    it('leads with the first attachment and strips the rest', async () => {
        const { wrapper } = await mountDrawer(
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
        const { wrapper } = await mountDrawer(
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

        const { wrapper } = await mountDrawer(
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

describe('PostsPage — the drawer acts on the post', () => {
    it('publishes the post', async () => {
        const { wrapper, context } = await mountDrawer(DRAFT_POST)

        await wrapper.find('[data-test="drawer-publish"]').trigger('click')
        await flushPromises()

        expect(context.api.post).toHaveBeenCalledWith('/plugins/social/posts/88/publish', {
            principal_id: 7,
        })
    })

    it('retries the failed targets', async () => {
        const { wrapper, context } = await mountDrawer(makePost({ id: 88, status: 'partial' }))

        await wrapper.find('[data-test="drawer-retry"]').trigger('click')
        await flushPromises()

        expect(context.api.post).toHaveBeenCalledWith('/plugins/social/posts/88/retry', {
            principal_id: 7,
        })
    })

    it('takes the published post back down', async () => {
        const { wrapper, context } = await mountDrawer(PUBLISHED_POST)

        await wrapper.find('[data-test="drawer-take-down"]').trigger('click')
        await flushPromises()

        expect(context.api.delete).toHaveBeenCalledWith(
            '/plugins/social/posts/88/published?principal_id=7',
        )
    })

    it('deletes the post and closes the drawer', async () => {
        const { wrapper, router, context } = await mountDrawer(DRAFT_POST)

        await wrapper.find('[data-test="drawer-delete"]').trigger('click')
        await flushPromises()

        expect(context.api.delete).toHaveBeenCalledWith('/plugins/social/posts/88?principal_id=7')
        expect(router.currentRoute.value.path).toBe('/p/7/posts')
    })

    it('closes the drawer without touching the post', async () => {
        const { wrapper, router, context } = await mountDrawer(DRAFT_POST)

        await wrapper.find('[data-test="drawer-close"]').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/p/7/posts')
        expect(context.api.delete).not.toHaveBeenCalled()
    })

    it('closes the drawer on Escape', async () => {
        const { wrapper, router } = await mountDrawer(DRAFT_POST)

        await wrapper.find('[data-test="post-drawer"]').trigger('keydown.esc')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/p/7/posts')
    })
})

describe('PostsPage — the list', () => {
    it('filters the list by status', async () => {
        const pinia = createPinia()

        const router = stubRoutes()
        await router.push('/p/7/posts')
        await router.isReady()

        const get = vi.fn().mockResolvedValue({ items: [], total: 0 })
        const context = hostContext()
        context.api.get = get as never

        const wrapper = mountPage(PostsPage, pinia, router, context)
        await flushPromises()

        await wrapper.find('[data-test="filter-draft"]').trigger('click')
        await flushPromises()

        expect(get).toHaveBeenCalledWith('/plugins/social/posts', {
            principal_id: 7,
            status: 'draft',
        })
    })

    it('counts the posts of each status', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [makePost({ id: 88, status: 'published' }), makePost({ id: 89, status: 'draft' })]

        const router = stubRoutes()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        expect(wrapper.find('[data-test="filter-published"]').text()).toContain('1')
        expect(wrapper.find('[data-test="filter-draft"]').text()).toContain('1')
    })

    it('reads the post a deep link names', async () => {
        const pinia = createPinia()
        const post = makePost({ id: 99 })

        const router = stubRoutes()
        await router.push('/p/7/post/99')
        await router.isReady()

        const context = contextWithPost(post)
        const wrapper = mountPage(PostsPage, pinia, router, context)
        await flushPromises()

        expect(context.api.get).toHaveBeenCalledWith('/plugins/social/posts/99', { principal_id: 7 })
        expect(wrapper.find('[data-test="post-drawer"]').exists()).toBe(true)
    })

    it('reloads the posts when the principal changes', async () => {
        const pinia = createPinia()

        const router = stubRoutes()
        await router.push('/p/7/posts')
        await router.isReady()

        const get = vi.fn().mockResolvedValue({ items: [], total: 0 })
        const context = hostContext()
        context.api.get = get as never

        mountPage(PostsPage, pinia, router, context)
        await flushPromises()
        get.mockClear()

        await router.push('/p/8/posts')
        await flushPromises()

        expect(get).toHaveBeenCalledWith('/plugins/social/posts', { principal_id: 8 })
    })
})

describe('PostsPage — a target’s outcome', () => {
    it.each([
        ['pending', 'Pending'],
        ['publishing', 'Publishing'],
        ['deleted', 'Taken down'],
    ] as const)('names a target that is %s', async (status, label) => {
        const { wrapper } = await mountDrawer(
            makePost({ id: 88, targets: [makeTarget({ id: 501, status })] }),
        )

        expect(wrapper.find('[data-test="target-result-501"]').text()).toContain(label)
    })
})

describe('PostsPage — without a principal', () => {
    it('asks for nothing', async () => {
        const pinia = createPinia()

        const router = stubRoutes()
        await router.push('/')
        await router.isReady()

        const get = vi.fn().mockResolvedValue({ items: [], total: 0 })
        const context = hostContext()
        context.api.get = get as never

        mountPage(PostsPage, pinia, router, context)
        await flushPromises()

        // A path without a principal names no scope, so there is nothing to
        // ask the backend about.
        expect(get).not.toHaveBeenCalled()
    })

    it('shows the per-platform bodies in the drawer', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.posts = [
            makePost({
                id: 88,
                platform_bodies: { linkedin: 'The LinkedIn wording.' },
            }),
        ]

        const router = stubRoutes()
        await router.push('/p/7/post/88')
        await router.isReady()

        const wrapper = mountPage(PostsPage, pinia, router)
        await flushPromises()

        const drawer = wrapper.find('[data-test="post-drawer"]')
        expect(drawer.text()).toContain('The LinkedIn wording.')
        expect(drawer.text()).toContain('LinkedIn')
    })
})
