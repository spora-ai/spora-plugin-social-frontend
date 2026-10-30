import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ComposerPanel from '../../src/components/ComposerPanel.vue'
import { useSocialStore } from '../../src/stores/social'
import { makeAccount, makeConnection, makePost } from '../fixtures'
import { CONFIG_PAYLOAD } from '../recorded'
import { hostContext, mountComponent } from '../mountPage'
import type { PluginHostContext } from '../../src/shims'

interface Mounted {
    wrapper: ReturnType<typeof mountComponent>
    social: ReturnType<typeof useSocialStore>
    context: PluginHostContext
}

/** An asset the host's media picker hands back. */
function asset(id: string, filename: string, mime_type: string) {
    return { id, filename, mime_type, byte_size: 1000, asset_url: `/api/v1/assets/${id}` }
}

/** The composer, with one account to publish to and the backend's rules. */
function mountComposer(context: PluginHostContext = hostContext()): Mounted {
    const pinia = createPinia()
    const social = useSocialStore(pinia)
    social.connections = [
        makeConnection({ accounts: [makeAccount({ id: 12, platform: 'linkedin' })] }),
    ]
    social.config = CONFIG_PAYLOAD

    const wrapper = mountComponent(ComposerPanel, { principalId: 7 }, { pinia, context })
    return { wrapper, social, context }
}

/** The composer, publishing to an Instagram account, with the given media attached. */
async function mountWithMedia(
    assets: ReturnType<typeof asset>[],
): Promise<Mounted> {
    const openMediaPicker = vi.fn().mockResolvedValue(assets)
    const mounted = mountComposer(hostContext({ openMediaPicker }))
    mounted.social.connections = [
        makeConnection({ accounts: [makeAccount({ id: 13, platform: 'instagram' })] }),
    ]
    await mounted.wrapper.vm.$nextTick()

    await mounted.wrapper.find('[data-test="target-13"]').setValue(true)
    await flushPromises()
    await mounted.wrapper.find('[data-test="attach-media"]').trigger('click')
    await flushPromises()

    return mounted
}

/** Choose the account and write something worth publishing. */
async function compose(wrapper: ReturnType<typeof mountComponent>, body = 'We shipped…'): Promise<void> {
    await wrapper.find('[data-test="target-12"]').setValue(true)
    await wrapper.find('#cmp-body').setValue(body)
    await flushPromises()
}

describe('ComposerPanel — the writing surface', () => {
    it('counts the body against the limit the backend enforces', async () => {
        const { wrapper } = mountComposer()

        await compose(wrapper, 'a'.repeat(10))

        expect(wrapper.find('[data-test="preview-linkedin"] .char-count').text()).toBe('10 / 3000')
    })

    it('flags a body past the limit', async () => {
        const { wrapper } = mountComposer()

        await compose(wrapper, 'a'.repeat(3001))

        expect(wrapper.find('[data-test="preview-linkedin"]').text()).toContain('Over the limit')
    })

    it('counts the accounts the operator picked', async () => {
        const { wrapper } = mountComposer()

        expect(wrapper.find('[data-test="target-summary"]').text()).toBe('No account selected')
        await wrapper.find('[data-test="target-12"]').setValue(true)
        expect(wrapper.find('[data-test="target-summary"]').text()).toBe('1 accounts selected')
    })

    it('says that there is no message yet', async () => {
        const { wrapper } = mountComposer()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()

        expect(wrapper.find('[data-test="preview-linkedin"]').text()).toContain('No message yet')
    })

    it('will not publish a post with neither a message nor media', async () => {
        const { wrapper } = mountComposer()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()

        expect(wrapper.find('[data-test="composer-submit"]').attributes('disabled')).toBeDefined()
    })

    it('labels the date, the time and the timezone', () => {
        const { wrapper } = mountComposer()

        // A field nobody can name is a field nobody can fill in.
        for (const [id, label] of [
            ['cmp-date', 'Date'],
            ['cmp-time', 'Time'],
            ['cmp-timezone', 'Timezone'],
        ]) {
            const field = wrapper.find(`#${id}`)
            expect(field.exists()).toBe(true)
            expect(wrapper.find(`label[for="${id}"]`).text()).toBe(label)
        }
    })
})

describe('ComposerPanel — the media', () => {
    it('attaches what the host’s picker returned', async () => {
        const openMediaPicker = vi.fn().mockResolvedValue([asset('asset-1', 'chart.png', 'image/png')])
        const { wrapper } = mountComposer(hostContext({ openMediaPicker }))

        await wrapper.find('[data-test="attach-media"]').trigger('click')
        await flushPromises()

        expect(openMediaPicker).toHaveBeenCalledWith({ multi: true, mediaKind: 'image' })
        expect(wrapper.text()).toContain('chart.png')
    })

    it('attaches nothing when the operator cancels the picker', async () => {
        const openMediaPicker = vi.fn().mockResolvedValue([])
        const { wrapper } = mountComposer(hostContext({ openMediaPicker }))

        await wrapper.find('[data-test="attach-media"]').trigger('click')
        await flushPromises()

        expect(wrapper.text()).not.toContain('chart.png')
    })

    it('removes an attachment', async () => {
        const openMediaPicker = vi.fn().mockResolvedValue([asset('asset-1', 'chart.png', 'image/png')])
        const { wrapper } = mountComposer(hostContext({ openMediaPicker }))

        await wrapper.find('[data-test="attach-media"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-test="media-remove-asset-1"]').trigger('click')
        await flushPromises()

        expect(wrapper.text()).not.toContain('chart.png')
    })

    it('says that the network needs media', async () => {
        const { wrapper } = await mountWithMedia([])

        expect(wrapper.find('[data-test="preview-instagram"]').text()).toContain('Media required')
    })

    it('says that the media does not fit the network', async () => {
        // Instagram takes JPEG or MP4; the picker handed back a PNG.
        const { wrapper } = await mountWithMedia([asset('asset-1', 'chart.png', 'image/png')])

        expect(wrapper.find('[data-test="preview-instagram"]').text()).toContain(
            'The media does not fit this network',
        )
    })

    it('says that the network fetches the media itself', async () => {
        const { wrapper } = await mountWithMedia([asset('asset-1', 'chart.jpg', 'image/jpeg')])

        expect(wrapper.find('[data-test="preview-instagram"]').text()).toContain('Public URL')
    })

    it('says how many media the network takes', async () => {
        const { wrapper } = await mountWithMedia([
            asset('asset-1', 'one.jpg', 'image/jpeg'),
            asset('asset-2', 'two.jpg', 'image/jpeg'),
        ])

        expect(wrapper.find('[data-test="preview-instagram"]').text()).toContain('1 media max')
    })
})

describe('ComposerPanel — the draft', () => {
    /** The composer, with a backend that answers the draft request. */
    function mountWithDraft(post: ReturnType<typeof vi.fn>): Mounted {
        const mounted = mountComposer()
        mounted.context.api.post = post as never
        return mounted
    }

    it('fills the body with the draft the backend wrote', async () => {
        const post = vi.fn().mockResolvedValue({
            title: 'Q4 release',
            bodies: { linkedin: 'The Q4 release is out.' },
            hashtags: [],
        })
        const { wrapper } = mountWithDraft(post)

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()
        await wrapper.find('[data-test="draft-with-ai"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith('/plugins/social/drafts/generate', {
            principal_id: 7,
            brief: '',
            platforms: ['linkedin'],
            account_ids: [12],
        })
        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe(
            'The Q4 release is out.',
        )
    })

    it('keeps the body the operator wrote', async () => {
        const post = vi.fn().mockResolvedValue({
            title: 'Q4 release',
            bodies: { linkedin: 'The Q4 release is out.' },
            hashtags: [],
        })
        const { wrapper } = mountWithDraft(post)

        await compose(wrapper, 'My own words')
        await wrapper.find('[data-test="draft-with-ai"]').trigger('click')
        await flushPromises()

        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe('My own words')
    })

    it('says so when the draft could not be generated', async () => {
        const post = vi.fn().mockRejectedValue(new Error('boom'))
        const { wrapper, social } = mountWithDraft(post)

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()
        await wrapper.find('[data-test="draft-with-ai"]').trigger('click')
        await flushPromises()

        expect(social.notice).toBe('The draft could not be generated.')
    })
})

describe('ComposerPanel — the publish', () => {
    /** The composer, with a body written and a backend that accepts the post. */
    async function mountReadyToPublish(): Promise<Mounted> {
        const post = vi.fn().mockResolvedValue(makePost({ id: 88 }))
        const mounted = mountComposer()
        mounted.context.api.post = post as never
        await compose(mounted.wrapper)
        return mounted
    }

    it('schedules the post the operator wrote', async () => {
        const { wrapper, context, social } = await mountReadyToPublish()

        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(context.api.post).toHaveBeenCalledWith('/plugins/social/posts', {
            principal_id: 7,
            title: '',
            body: 'We shipped…',
            platform_bodies: {},
            account_ids: [12],
            scheduled_for: expect.any(String),
            timezone: 'Europe/Berlin',
            publish_now: false,
            media: [],
        })
        expect(social.notice).toBe('Scheduled')
    })

    it('publishes straight away when the operator says so', async () => {
        const { wrapper, context, social } = await mountReadyToPublish()

        await wrapper.find('input[value="now"]').setValue(true)
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(context.api.post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({ publish_now: true, scheduled_for: null }),
        )
        expect(social.notice).toBe('Published')
    })

    it('saves a draft when the operator says so', async () => {
        const { wrapper, context, social } = await mountReadyToPublish()

        await wrapper.find('input[value="draft"]').setValue(true)
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(context.api.post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({ publish_now: false, scheduled_for: null }),
        )
        expect(social.notice).toBe('Draft saved')
    })

    it('empties the writing surface afterwards', async () => {
        const { wrapper } = await mountReadyToPublish()

        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe('')
        expect(wrapper.find('[data-test="target-summary"]').text()).toBe('No account selected')
    })

    it('says nothing when the post was not accepted', async () => {
        const post = vi.fn().mockRejectedValue(new Error('boom'))
        const { wrapper, context, social } = mountComposer()
        context.api.post = post as never

        await compose(wrapper)
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(social.notice).toBeNull()
    })

    it('sends the attachments with the post, in the order they were added', async () => {
        const openMediaPicker = vi.fn().mockResolvedValue([
            asset('asset-1', 'one.jpg', 'image/jpeg'),
            asset('asset-2', 'two.jpg', 'image/jpeg'),
        ])
        const post = vi.fn().mockResolvedValue(makePost({ id: 88 }))
        const { wrapper, context } = mountComposer(hostContext({ openMediaPicker }))
        context.api.post = post as never

        await compose(wrapper)
        await wrapper.find('[data-test="attach-media"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({
                media: [
                    { media_asset_id: 'asset-1', position: 0 },
                    { media_asset_id: 'asset-2', position: 1 },
                ],
            }),
        )
    })
})
