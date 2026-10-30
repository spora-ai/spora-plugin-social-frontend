import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import PostsTable from '../../src/components/PostsTable.vue'
import { makeMedia, makeMetrics, makePost, makeTarget } from '../fixtures'
import { mountComponent, stubRoutes } from '../mountPage'

describe('PostsTable', () => {
    it('shows the reach of a measured post', () => {
        const wrapper = mountComponent(PostsTable, { posts: [makePost()], principalId: 7 })

        // The reach column is the number the operator scans for.
        expect(wrapper.find('tbody').text()).toContain('4,820')
    })

    it('shows the engagement rate next to it', () => {
        const wrapper = mountComponent(PostsTable, { posts: [makePost()], principalId: 7 })
        expect(wrapper.find('tbody').text()).toContain('engagement')
    })

    it('shows no number for a post that has not been measured', () => {
        const post = makePost({
            targets: [
                {
                    id: 501,
                    account_id: 12,
                    platform: 'linkedin',
                    status: 'pending',
                    external_id: null,
                    external_url: null,
                    error: null,
                    published_at: null,
                    metrics: null,
                },
            ],
        })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })

        // A zero would read as "nobody saw it", which is a different claim
        // from "nothing has been measured".
        expect(wrapper.find('tbody').text()).not.toContain('0%')
    })

    it('says that the reach is a rough figure', () => {
        const wrapper = mountComponent(PostsTable, { posts: [makePost()], principalId: 7 })
        expect(wrapper.text()).toContain('a rough figure')
    })

    it('names the platforms a post went to', () => {
        const wrapper = mountComponent(PostsTable, { posts: [makePost()], principalId: 7 })
        expect(wrapper.find('[data-platform="linkedin"]').exists()).toBe(true)
    })

    it('counts the failed targets', () => {
        const post = makePost({
            status: 'partial',
            targets: [
                {
                    id: 501,
                    account_id: 12,
                    platform: 'linkedin',
                    status: 'published',
                    external_id: 'urn:li:share:9',
                    external_url: null,
                    error: null,
                    published_at: null,
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
        })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })

        expect(wrapper.find('tbody').text()).toContain('1 target failed')
    })

    it('shows a thumbnail when the post has an image', () => {
        const post = makePost({ media: [makeMedia({ media_asset_id: 'asset-1' })] })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })

        const image = wrapper.find('[data-test="post-image-asset-1"]')
        expect(image.exists()).toBe(true)
        expect(image.attributes('src')).toBe('/api/v1/assets/asset-1.png')
        // Decorative: the title beside it describes the post.
        expect(image.attributes('alt')).toBe('')
    })

    it('renders exactly as before when the post has no image', () => {
        const post = makePost({ media: [] })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })
        const row = wrapper.find('[data-test="post-row-88"]')

        // No thumbnail, and no placeholder box left behind in its place.
        expect(row.find('img').exists()).toBe(false)
        expect(row.find('[data-test^="post-image"]').exists()).toBe(false)
        expect(row.text()).toContain('Q4 release')
    })

    it('shows no thumbnail when the image’s asset is gone', () => {
        const post = makePost({ media: [makeMedia({ media_asset_id: 'asset-1', asset_url: null })] })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })
        const row = wrapper.find('[data-test="post-row-88"]')

        // A row with a dead asset reads as it did before the thumbnail existed,
        // rather than carrying an empty box.
        expect(row.find('img').exists()).toBe(false)
        expect(row.find('[data-test^="post-image"]').exists()).toBe(false)
        // The badge still says how many attachments there are.
        expect(row.text()).toContain('1')
    })

    it('keeps the media-count badge next to the thumbnail', () => {
        const post = makePost({
            media: [
                makeMedia({ media_asset_id: 'asset-1', position: 0 }),
                makeMedia({ media_asset_id: 'asset-2', position: 1 }),
            ],
        })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })
        const row = wrapper.find('[data-test="post-row-88"]')

        expect(row.find('[data-test="post-image-asset-1"]').exists()).toBe(true)
        expect(row.text()).toContain('2')
    })

    it('shows a dash for a reach that was never reported', () => {
        // A LinkedIn member post reports reactions and nothing else — a zero
        // here would read as "nobody saw it".
        const post = makePost({
            targets: [makeTarget({ metrics: makeMetrics({ reach: null, impressions: null }) })],
        })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })

        expect(wrapper.find('[data-test="post-reach-88"]').text()).toBe('—')
        expect(wrapper.find('[data-test="post-rate-88"]').text()).toBe('—')
    })

    it('shows a counted zero as a zero', () => {
        const post = makePost({
            targets: [makeTarget({ metrics: makeMetrics({ reach: 0, impressions: 0 }) })],
        })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })

        expect(wrapper.find('[data-test="post-reach-88"]').text()).toBe('0')
        // A counted zero is still no rate: 0/0 is not a rate.
        expect(wrapper.find('[data-test="post-rate-88"]').text()).toBe('—')
    })

    it('shows the reach and the rate of a measured post', () => {
        const wrapper = mountComponent(PostsTable, { posts: [makePost()], principalId: 7 })

        expect(wrapper.find('[data-test="post-reach-88"]').text()).toBe('4,820')
        expect(wrapper.find('[data-test="post-rate-88"]').text()).toContain('engagement')
    })

    it('dates a partly published post by the moment it went out', () => {
        // The post went out on one target and failed on another, so it has a
        // publish time. The old rule — "published, or else the scheduled
        // date" — left it with no date at all.
        const post = makePost({
            status: 'partial',
            scheduled_for: null,
            published_at: '2026-11-02T09:00:04+00:00',
        })
        const wrapper = mountComponent(PostsTable, { posts: [post], principalId: 7 })

        const row = wrapper.find('[data-test="post-row-88"]')
        expect(row.text()).not.toContain('—')
    })

    it('tells an agent-written post from a manual one', () => {
        const manual = mountComponent(PostsTable, { posts: [makePost({ source: 'manual' })], principalId: 7 })
        const agent = mountComponent(PostsTable, { posts: [makePost({ source: 'ai' })], principalId: 7 })

        expect(manual.find('[data-test="post-row-88"]').text()).toContain('Manual')
        expect(agent.find('[data-test="post-row-88"]').text()).toContain('By an agent')
        expect(agent.find('[data-test="post-row-88"]').text()).not.toContain('Manual')
    })

    it('says that the agent will publish a scheduled post', () => {
        const wrapper = mountComponent(PostsTable, {
            posts: [
                makePost({ source: 'ai', status: 'scheduled', scheduled_for: '2026-11-09T09:00:00+00:00' }),
            ],
            principalId: 7,
        })

        expect(wrapper.find('[data-test="post-agent-hint-88"]').text()).toContain(
            'The agent will publish this.',
        )
    })

    it('says nothing about an agent that already published', () => {
        const wrapper = mountComponent(PostsTable, {
            posts: [makePost({ source: 'ai', status: 'published' })],
            principalId: 7,
        })

        expect(wrapper.find('[data-test="post-agent-hint-88"]').exists()).toBe(false)
    })
})

describe('PostsTable — opening a post', () => {
    /** The table, with a router — the row opens the post's drawer. */
    function mountTable() {
        const router = stubRoutes()
        const wrapper = mountComponent(
            PostsTable,
            { posts: [makePost()], principalId: 7 },
            { router },
        )
        return { wrapper, router }
    }

    it.each([
        ['a click', 'click'],
        ['Enter', 'keydown.enter'],
        ['the space bar', 'keydown.space'],
    ])('opens the post on %s', async (_how, event) => {
        const { wrapper, router } = mountTable()

        await wrapper.find('[data-test="post-row-88"]').trigger(event)
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/p/7/post/88')
    })

    it('makes the row reachable with the keyboard', () => {
        const { wrapper } = mountTable()

        expect(wrapper.find('[data-test="post-row-88"]').attributes('tabindex')).toBe('0')
    })
})
