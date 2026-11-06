import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import ComposerPanel from '../../src/components/ComposerPanel.vue'
import ComposePage from '../../src/pages/ComposePage.vue'
import { useSocialStore } from '../../src/stores/social'
import type { AgentSummary } from '../../src/api/agents'
import { makeAccount, makeConnection, makeMedia, makePost, hostApiError } from '../fixtures'
import { CONFIG_PAYLOAD } from '../recorded'
import { hostContext, mountComponent, mountPage, stubRoutes } from '../mountPage'
import { APP_ROUTES } from '../../src/lib/routes'
import type { PluginHostContext } from '../../src/shims'
import type { SocialPost } from '../../src/types'

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
function mountComposer(context: PluginHostContext = hostContext(), postId?: number): Mounted {
    const pinia = createPinia()
    const social = useSocialStore(pinia)
    social.connections = [
        makeConnection({ accounts: [makeAccount({ id: 12, platform: 'linkedin' })] }),
    ]
    social.config = CONFIG_PAYLOAD

    const wrapper = mountComponent(
        ComposerPanel,
        { principalId: 7, postId },
        { pinia, context, router: stubRoutes() },
    )
    return { wrapper, social, context }
}

/**
 * The composer, editing a post.
 *
 * The post is answered by the API, the way the backend answers it, and the
 * save is answered too — so the composer's own round trip can be watched.
 */
async function mountEditing(post: SocialPost): Promise<Mounted> {
    const context = hostContext()
    context.api.get = vi.fn().mockResolvedValue(post) as never
    context.api.patch = vi.fn().mockResolvedValue(post) as never
    context.api.post = vi.fn().mockResolvedValue(post) as never

    const mounted = mountComposer(context, post.id)
    await flushPromises()
    return mounted
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

        expect(wrapper.find('[data-test="preview-direct:linkedin"] .char-count').text()).toBe('10 / 3000')
    })

    it('flags a body past the limit', async () => {
        const { wrapper } = mountComposer()

        await compose(wrapper, 'a'.repeat(3001))

        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).toContain('Over the limit')
    })

    it('shows the counting note where a number it cannot compute would be', async () => {
        // X counts a URL as 23 characters and an emoji as 2, so the plugin's
        // own count is wrong for it — and a wrong number is worse than none.
        const { wrapper, social } = mountComposer()
        social.connections = [
            makeConnection({
                provider: 'zernio',
                accounts: [makeAccount({ id: 40, platform: 'twitter', via: 'zernio' })],
            }),
        ]
        await wrapper.vm.$nextTick()

        await wrapper.find('[data-test="target-40"]').setValue(true)
        await wrapper.find('#cmp-body').setValue('a'.repeat(10))
        await flushPromises()

        const preview = wrapper.find('[data-test="preview-zernio:twitter"]')
        expect(preview.find('[data-test="counting-note"]').text()).toContain(
            'X counts a URL as 23 characters',
        )
        // No number, and no verdict on it: the network refuses the post and
        // its own message lands on the target.
        expect(preview.find('.char-count').exists()).toBe(false)
        expect(preview.text()).not.toContain('Over the limit')
    })

    it('warns that a network is reached through two routes, and lets it go ahead', async () => {
        // A member profile and an organisation page are two accounts, and
        // the plugin cannot know they are the same page — posting to both is
        // sometimes exactly what the operator meant.
        const { wrapper, social } = mountComposer()
        social.connections = [
            makeConnection({
                accounts: [makeAccount({ id: 12, platform: 'linkedin', via: 'direct' })],
            }),
            makeConnection({
                id: 2,
                provider: 'zernio',
                accounts: [makeAccount({ id: 41, platform: 'linkedin', via: 'zernio' })],
            }),
        ]
        await wrapper.vm.$nextTick()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await wrapper.find('[data-test="target-41"]').setValue(true)
        await wrapper.find('#cmp-body').setValue('We shipped…')
        await flushPromises()

        const warning = wrapper.find('[data-test="two-routes-warning"]')
        expect(warning.exists()).toBe(true)
        expect(warning.text()).toContain('LinkedIn')
        // It is a warning, not a refusal: the post still goes out.
        expect(wrapper.find('[data-test="composer-submit"]').attributes('disabled')).toBeUndefined()
    })

    it('says nothing when each network is reached through one route', async () => {
        const { wrapper } = mountComposer()

        await compose(wrapper)
        await flushPromises()

        expect(wrapper.find('[data-test="two-routes-warning"]').exists()).toBe(false)
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

        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).toContain('No message yet')
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

        expect(wrapper.find('[data-test="preview-direct:instagram"]').text()).toContain('Media required')
    })

    it('says that the media does not fit the network', async () => {
        // Instagram takes JPEG or MP4; the picker handed back a PNG.
        const { wrapper } = await mountWithMedia([asset('asset-1', 'chart.png', 'image/png')])

        expect(wrapper.find('[data-test="preview-direct:instagram"]').text()).toContain(
            'The media does not fit this network',
        )
    })

    it('says that the network fetches the media itself', async () => {
        const { wrapper } = await mountWithMedia([asset('asset-1', 'chart.jpg', 'image/jpeg')])

        expect(wrapper.find('[data-test="preview-direct:instagram"]').text()).toContain('Public URL')
    })

    it('says how many media the network takes', async () => {
        const { wrapper } = await mountWithMedia([
            asset('asset-1', 'one.jpg', 'image/jpeg'),
            asset('asset-2', 'two.jpg', 'image/jpeg'),
        ])

        expect(wrapper.find('[data-test="preview-direct:instagram"]').text()).toContain('1 media max')
    })
})

describe('ComposerPanel — the agent panel', () => {
    /** An agent with the tools it runs with. */
    function agent(id: number, name: string, tools: string[], principalId = 7): AgentSummary {
        return {
            id,
            name,
            description: null,
            principal_id: principalId,
            tools: tools.map((tool_name) => ({ tool_name })),
        }
    }

    /** The composer, with the panel open and the principal's agents loaded. */
    async function mountWithAgents(
        agents: AgentSummary[],
        context: PluginHostContext = hostContext(),
    ): Promise<Mounted> {
        const mounted = mountComposer(context)
        mounted.context.api.get = vi.fn().mockResolvedValue({ agents }) as never

        await mounted.wrapper.find('[data-test="draft-with-agent"]').trigger('click')
        await flushPromises()
        return mounted
    }

    /** The panel, with a prompt written and an agent chosen. */
    async function composeForAgent(
        wrapper: ReturnType<typeof mountComponent>,
        agentId: number,
        prompt = 'A post about our release',
    ): Promise<void> {
        await wrapper.find('[data-test="agent-select"]').setValue(String(agentId))
        await wrapper.find('[data-test="agent-prompt"]').setValue(prompt)
        await flushPromises()
    }

    it('lists the principal’s agents', async () => {
        const { wrapper, context } = await mountWithAgents([
            agent(1, 'The writer', ['social_post']),
            agent(2, 'The reader', ['web_search']),
        ])

        expect(context.api.get).toHaveBeenCalledWith('/agents', { principal_id: 7 })
        expect(wrapper.find('[data-test="agent-select"]').text()).toContain('The writer')
        expect(wrapper.find('[data-test="agent-select"]').text()).toContain('The reader')
    })

    it('takes the writing surface while the brief is open', async () => {
        const { wrapper } = await mountWithAgents([agent(1, 'The writer', ['social_post'])])

        // Writing a post by hand and briefing an agent to write one are two
        // different jobs, and a panel floating over the empty message box
        // would leave the operator looking at a form that is not in use.
        expect(wrapper.find('#cmp-body').exists()).toBe(false)
        expect(wrapper.find('[data-test="agent-panel"]').exists()).toBe(true)
    })

    it('brings the writing surface back, with what the operator had typed', async () => {
        const mounted = mountComposer()
        await mounted.wrapper.find('#cmp-body').setValue('My own words')
        mounted.context.api.get = vi.fn().mockResolvedValue({ agents: [] }) as never

        await mounted.wrapper.find('[data-test="draft-with-agent"]').trigger('click')
        await flushPromises()
        await mounted.wrapper.find('[data-test="agent-back"]').trigger('click')
        await flushPromises()

        expect(mounted.wrapper.find('[data-test="agent-panel"]').exists()).toBe(false)
        expect((mounted.wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe(
            'My own words',
        )
    })

    it('starts from a brief that says what the agent is to do', async () => {
        const { wrapper } = await mountWithAgents([agent(1, 'The writer', ['social_post'])])

        // A prompt the operator has to write from nothing is a prompt they
        // will not write.
        const prompt = (wrapper.find('[data-test="agent-prompt"]').element as HTMLTextAreaElement)
            .value

        expect(prompt).toBe(
            'Draft a post for social media and create a draft with the social_post tool.',
        )
    })

    it('will not send without a prompt', async () => {
        const { wrapper } = await mountWithAgents([agent(1, 'The writer', ['social_post'])])

        await wrapper.find('[data-test="agent-select"]').setValue('1')
        await wrapper.find('[data-test="agent-prompt"]').setValue('')
        await flushPromises()

        expect(wrapper.find('[data-test="agent-send"]').attributes('disabled')).toBeDefined()
    })

    it('will not send to an agent without the social_post tool', async () => {
        const { wrapper } = await mountWithAgents([agent(2, 'The reader', ['web_search'])])

        await composeForAgent(wrapper, 2)

        expect(wrapper.find('[data-test="agent-send"]').attributes('disabled')).toBeDefined()
        expect(wrapper.find('[data-test="agent-note"]').text()).toContain('social_post')
    })

    it('starts a task for the chosen agent', async () => {
        const post = vi.fn().mockResolvedValue({ task: { id: 42 } })
        const { wrapper, context, social } = await mountWithAgents([
            agent(1, 'The writer', ['social_post']),
        ])
        context.api.post = post as never

        await composeForAgent(wrapper, 1)
        await wrapper.find('[data-test="agent-send"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith('/tasks', {
            agent_id: 1,
            prompt: 'A post about our release',
        })
        // What the plugin knows is that the prompt was sent — not that the
        // agent is writing a post, which is the agent's business.
        expect(social.notice).toBe('Prompt sent')
    })

    it('offers the chat link after the send', async () => {
        const push = vi.fn().mockResolvedValue(undefined)
        const context = hostContext({
            router: { push, currentRoute: { value: { path: '/' } } },
        })
        const post = vi.fn().mockResolvedValue({ task: { id: 42 } })
        const { wrapper } = await mountWithAgents([agent(1, 'The writer', ['social_post'])], context)
        context.api.post = post as never

        await composeForAgent(wrapper, 1)
        await wrapper.find('[data-test="agent-send"]').trigger('click')
        await flushPromises()

        const link = wrapper.find('[data-test="agent-chat-link"]')
        expect(link.exists()).toBe(true)
        expect(link.text()).toBe('See progress here')
        await link.trigger('click')
        expect(push).toHaveBeenCalledWith('/tasks/42')
    })

    it('offers the agent’s tools page when the agent cannot post', async () => {
        const push = vi.fn().mockResolvedValue(undefined)
        const context = hostContext({
            router: { push, currentRoute: { value: { path: '/' } } },
        })
        const { wrapper } = await mountWithAgents([agent(2, 'The reader', ['web_search'])], context)

        await composeForAgent(wrapper, 2)

        const link = wrapper.find('[data-test="agent-tools-link"]')
        expect(link.exists()).toBe(true)
        await link.trigger('click')
        expect(push).toHaveBeenCalledWith('/agents/2/tools')
    })

    it('says what went wrong when the task could not be started', async () => {
        const post = vi.fn().mockRejectedValue(hostApiError('The agent is busy.', 'busy', 409))
        const { wrapper, context } = await mountWithAgents([agent(1, 'The writer', ['social_post'])])
        context.api.post = post as never

        await composeForAgent(wrapper, 1)
        await wrapper.find('[data-test="agent-send"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="agent-error"]').text()).toBe('The agent is busy.')
    })

    it('says the failure itself when the request failed for another reason', async () => {
        const post = vi.fn().mockRejectedValue(new Error('the network is gone'))
        const { wrapper, context } = await mountWithAgents([agent(1, 'The writer', ['social_post'])])
        context.api.post = post as never

        await composeForAgent(wrapper, 1)
        await wrapper.find('[data-test="agent-send"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="agent-error"]').text()).toBe('the network is gone')
    })

    it('falls back to its own wording when the failure carried no message', async () => {
        const post = vi.fn().mockRejectedValue('boom')
        const { wrapper, context } = await mountWithAgents([agent(1, 'The writer', ['social_post'])])
        context.api.post = post as never

        await composeForAgent(wrapper, 1)
        await wrapper.find('[data-test="agent-send"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="agent-error"]').text()).toBe('The prompt could not be sent.')
    })

    it('says so when the agents could not be read', async () => {
        const mounted = mountComposer()
        mounted.context.api.get = vi
            .fn()
            .mockRejectedValue(hostApiError('The backend is down.', 'down', 503)) as never

        await mounted.wrapper.find('[data-test="draft-with-agent"]').trigger('click')
        await flushPromises()

        // Not "this principal has no agent" — that would be a claim the read
        // never made.
        expect(mounted.wrapper.find('[data-test="agent-note"]').text()).toBe('The backend is down.')
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
            hashtags: [],
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

    it('keeps the title with the post', async () => {
        const post = vi.fn().mockResolvedValue(makePost({ id: 88 }))
        const { wrapper, context } = mountComposer()
        context.api.post = post as never

        await compose(wrapper)
        await wrapper.find('#cmp-title').setValue('Q4 release')
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({ title: 'Q4 release' }),
        )
    })

    it('sends the moment in the operator’s own clock', async () => {
        const post = vi.fn().mockResolvedValue(makePost({ id: 88 }))
        const { wrapper, context } = mountComposer()
        context.api.post = post as never

        await compose(wrapper)
        await wrapper.find('#cmp-date').setValue('2026-11-09')
        await wrapper.find('#cmp-time').setValue('08:30')
        await wrapper.find('#cmp-timezone').setValue('UTC')
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({
                scheduled_for: new Date('2026-11-09T08:30:00').toISOString(),
                timezone: 'UTC',
            }),
        )
    })
})

describe('ComposerPanel — one body, and a network’s own only where it differs', () => {
    /** The composer, with two networks to publish to. */
    function mountTwoNetworks(): Mounted {
        const mounted = mountComposer()
        mounted.social.connections = [
            makeConnection({
                accounts: [
                    makeAccount({ id: 12, platform: 'linkedin' }),
                    makeAccount({ id: 13, platform: 'facebook' }),
                ],
            }),
        ]
        return mounted
    }

    /** Choose both networks and write the shared message. */
    async function writeShared(wrapper: ReturnType<typeof mountComponent>): Promise<void> {
        await wrapper.find('[data-test="target-12"]').setValue(true)
        await wrapper.find('[data-test="target-13"]').setValue(true)
        await wrapper.find('#cmp-body').setValue('We shipped…')
        await flushPromises()
    }

    it('edits the shared body, and says so', async () => {
        const { wrapper } = mountTwoNetworks()

        await writeShared(wrapper)

        expect(wrapper.find('[data-test="message-label"]').text()).toBe('Shared message')
        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).toContain('We shipped…')
        expect(wrapper.find('[data-test="preview-direct:facebook"]').text()).toContain('We shipped…')
    })

    it('gives a network a text of its own, and leaves the others the shared one', async () => {
        const { wrapper } = mountTwoNetworks()
        await writeShared(wrapper)

        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()
        await wrapper.find('#cmp-body').setValue('The LinkedIn wording.')
        await flushPromises()

        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).toContain('The LinkedIn wording.')
        expect(wrapper.find('[data-test="preview-direct:facebook"]').text()).toContain('We shipped…')
    })

    it('names the network whose own text the box edits', async () => {
        const { wrapper } = mountTwoNetworks()
        await writeShared(wrapper)

        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="message-label"]').text()).toBe('Message for LinkedIn')
        // The own text starts as the shared one, so it is edited and not written again.
        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe('We shipped…')
    })

    it('goes back to the shared message without dropping the network’s own text', async () => {
        const { wrapper } = mountTwoNetworks()
        await writeShared(wrapper)

        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()
        await wrapper.find('#cmp-body').setValue('The LinkedIn wording.')
        await flushPromises()
        await wrapper.find('[data-test="back-to-shared"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="message-label"]').text()).toBe('Shared message')
        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe('We shipped…')
        expect(wrapper.find('[data-test="platform-edit-direct:linkedin"]').exists()).toBe(true)
    })

    it('drops the network’s own text and goes back to the shared message', async () => {
        const { wrapper } = mountTwoNetworks()
        await writeShared(wrapper)

        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()
        await wrapper.find('#cmp-body').setValue('The LinkedIn wording.')
        await flushPromises()
        await wrapper.find('[data-test="platform-use-shared-direct:linkedin"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="platform-own-text-direct:linkedin"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).toContain('We shipped…')
        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).not.toContain('The LinkedIn wording.')
    })

    it('sends the network’s own text with the post', async () => {
        const post = vi.fn().mockResolvedValue(makePost({ id: 88 }))
        const { wrapper, context } = mountTwoNetworks()
        context.api.post = post as never
        await writeShared(wrapper)

        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()
        await wrapper.find('#cmp-body').setValue('The LinkedIn wording.')
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({
                body: 'We shipped…',
                platform_bodies: { 'direct:linkedin': 'The LinkedIn wording.' },
            }),
        )
    })

    it('publishes on a network’s own text alone', async () => {
        const { wrapper } = mountTwoNetworks()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()
        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()
        await wrapper.find('#cmp-body').setValue('The LinkedIn wording.')
        await flushPromises()

        // The shared body is empty, and the post can still go out.
        expect(wrapper.find('[data-test="composer-submit"]').attributes('disabled')).toBeUndefined()
    })

    it('switches the box to the network’s own text', async () => {
        const { wrapper } = mountTwoNetworks()
        await writeShared(wrapper)

        await wrapper.find('[data-test="platform-own-text-direct:linkedin"]').trigger('click')
        await flushPromises()
        await wrapper.find('#cmp-body').setValue('The LinkedIn wording.')
        await flushPromises()
        await wrapper.find('[data-test="back-to-shared"]').trigger('click')
        await flushPromises()

        await wrapper.find('[data-test="platform-edit-direct:linkedin"]').trigger('click')
        await flushPromises()

        expect(wrapper.find('[data-test="message-label"]').text()).toBe('Message for LinkedIn')
        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe(
            'The LinkedIn wording.',
        )
    })
})

describe('ComposerPanel — the hashtags', () => {
    it('sends the tags without their hashes', async () => {
        const post = vi.fn().mockResolvedValue(makePost({ id: 88 }))
        const { wrapper, context } = mountComposer()
        context.api.post = post as never

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await wrapper.find('#cmp-body').setValue('We shipped…')
        await wrapper.find('[data-test="hashtags-input"]').setValue('#one, #two')
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(post).toHaveBeenCalledWith(
            '/plugins/social/posts',
            expect.objectContaining({ hashtags: ['one', 'two'] }),
        )
    })

    it('counts the tags against the limit, because they go out with the text', async () => {
        const { wrapper } = mountComposer()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await wrapper.find('#cmp-body').setValue('a'.repeat(10))
        await wrapper.find('[data-test="hashtags-input"]').setValue('#one')
        await flushPromises()

        // The composed text is the body, a blank line and the tag.
        expect(wrapper.find('[data-test="preview-direct:linkedin"] .char-count').text()).toBe('16 / 3000')
    })

    it('shows the tags in the preview, where the counter is', async () => {
        const { wrapper } = mountComposer()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await wrapper.find('[data-test="hashtags-input"]').setValue('#one #two')
        await flushPromises()

        const preview = wrapper.find('[data-test="preview-direct:linkedin"]')
        expect(preview.find('[data-test="preview-hashtags"]').text()).toBe('#one #two')
    })

    it('says how many characters the network shows', async () => {
        const { wrapper } = mountComposer()

        await wrapper.find('[data-test="target-12"]').setValue(true)
        await flushPromises()

        // The number is the backend's; the wording around it is the
        // composer's, so there is one rule and one sentence.
        expect(
            wrapper.find('[data-test="preview-direct:linkedin"] [data-test="visible-chars"]').text(),
        ).toBe('Only the first ~200 characters show.')
    })
})

describe('ComposerPanel — editing a post', () => {
    it('says which post it is editing, and how to get back to a new one', async () => {
        const { wrapper } = await mountEditing(makePost({ id: 12, status: 'draft' }))

        expect(wrapper.find('[data-test="editing-heading"]').text()).toBe('Editing post #12')
        expect(wrapper.find('[data-test="back-to-composer"]').attributes('href')).toBe('/p/7/compose')
    })

    it('refuses to edit a post that has been published', async () => {
        const { wrapper } = await mountEditing(makePost({ id: 12, status: 'published' }))

        expect(wrapper.find('[data-test="post-load-error"]').text()).toBe(
            'This post has been published — its copy is on the network.',
        )
    })

    it('offers no new draft while a post is being edited', async () => {
        const { wrapper } = await mountEditing(makePost({ id: 12, status: 'draft' }))

        // The panel starts a NEW post; the operator is editing one.
        expect(wrapper.find('[data-test="draft-with-agent"]').exists()).toBe(false)
    })

    it('fills the surface with the post', async () => {
        const { wrapper } = await mountEditing(
            makePost({
                id: 12,
                status: 'draft',
                title: 'Q4 release',
                body: 'We shipped…',
                platform_bodies: { 'direct:linkedin': 'The LinkedIn wording.' },
                hashtags: ['one', 'two'],
                accounts: [{ id: 12, platform: 'linkedin', via: 'direct', display_name: 'Fabeat GmbH' }],
            }),
        )

        expect((wrapper.find('#cmp-title').element as HTMLInputElement).value).toBe('Q4 release')
        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe('We shipped…')
        expect((wrapper.find('#cmp-hashtags').element as HTMLInputElement).value).toBe('#one #two')
        expect(wrapper.find('[data-test="target-summary"]').text()).toBe('1 accounts selected')
        // The network's own text is what that network publishes.
        expect(wrapper.find('[data-test="preview-direct:linkedin"]').text()).toContain('The LinkedIn wording.')
    })

    it('carries the attachments of the post', async () => {
        const { wrapper } = await mountEditing(
            makePost({
                id: 12,
                status: 'draft',
                media: [makeMedia({ media_asset_id: 'asset-1', filename: 'chart.png' })],
            }),
        )

        expect(wrapper.find('[data-test="media-item-asset-1"]').exists()).toBe(true)
    })

    it('opens a scheduled post in the schedule, and a draft as a draft', async () => {
        const scheduled = await mountEditing(
            makePost({ id: 12, status: 'scheduled', scheduled_for: '2026-11-09T09:00:00+00:00' }),
        )
        expect((scheduled.wrapper.find('input[value="schedule"]').element as HTMLInputElement).checked).toBe(
            true,
        )

        const draft = await mountEditing(makePost({ id: 13, status: 'draft' }))
        expect((draft.wrapper.find('input[value="draft"]').element as HTMLInputElement).checked).toBe(true)
    })

    it('fills the date and the time with the moment the post goes out', async () => {
        const { wrapper } = await mountEditing(
            makePost({ id: 12, status: 'scheduled', scheduled_for: '2026-11-09T09:00:00+00:00' }),
        )

        // The box holds the operator's own wall clock, which is the clock the
        // composer sends — so the moment is not shifted by opening the post.
        const when = new Date('2026-11-09T09:00:00+00:00')
        const local = new Date(when.getTime() - when.getTimezoneOffset() * 60_000)
        expect((wrapper.find('#cmp-date').element as HTMLInputElement).value).toBe(
            local.toISOString().slice(0, 10),
        )
        expect((wrapper.find('#cmp-time').element as HTMLInputElement).value).toBe(
            local.toISOString().slice(11, 16),
        )
    })

    it('saves the post instead of creating one', async () => {
        const { wrapper, context } = await mountEditing(makePost({ id: 12, status: 'draft' }))

        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(context.api.patch).toHaveBeenCalledWith(
            '/plugins/social/posts/12',
            expect.objectContaining({ principal_id: 7, body: 'We shipped…' }),
        )
        expect(context.api.post).not.toHaveBeenCalled()
    })

    it('does not publish when it saves', async () => {
        const { wrapper, context } = await mountEditing(
            makePost({ id: 12, status: 'scheduled', scheduled_for: '2026-11-09T09:00:00+00:00' }),
        )

        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(context.api.patch).toHaveBeenCalled()
        expect(context.api.post).not.toHaveBeenCalled()
    })

    it('saves the post and then publishes it when the operator says publish now', async () => {
        const { wrapper, context } = await mountEditing(makePost({ id: 12, status: 'draft' }))

        await wrapper.find('input[value="now"]').setValue(true)
        await flushPromises()
        await wrapper.find('[data-test="composer-submit"]').trigger('click')
        await flushPromises()

        expect(context.api.patch).toHaveBeenCalled()
        expect(context.api.post).toHaveBeenCalledWith('/plugins/social/posts/12/publish', {
            principal_id: 7,
        })
    })

    it('says so when the post could not be loaded', async () => {
        const context = hostContext()
        context.api.get = vi.fn().mockRejectedValue(
            hostApiError('Post 12 was not found for this principal.', 'not_found', 404),
        ) as never

        const mounted = mountComposer(context, 12)
        await flushPromises()

        expect(mounted.wrapper.find('[data-test="post-load-error"]').text()).toBe(
            'Post 12 was not found for this principal.',
        )
    })

    it('reads the post again when the post id changes', async () => {
        const { wrapper, context } = await mountEditing(makePost({ id: 12, status: 'draft' }))
        context.api.get = vi.fn().mockResolvedValue(
            makePost({ id: 13, status: 'draft', title: 'The other one' }),
        ) as never

        await wrapper.setProps({ postId: 13 })
        await flushPromises()

        expect((wrapper.find('#cmp-title').element as HTMLInputElement).value).toBe('The other one')
    })

    it('empties the surface when the post is left', async () => {
        const { wrapper } = await mountEditing(
            makePost({ id: 12, status: 'draft', title: 'Q4 release' }),
        )

        await wrapper.setProps({ postId: undefined })
        await flushPromises()

        // The route without a post id is the plain composer: a post left
        // behind in the surface would be saved again as a new one.
        expect((wrapper.find('#cmp-title').element as HTMLInputElement).value).toBe('')
        expect((wrapper.find('#cmp-body').element as HTMLTextAreaElement).value).toBe('')
        expect(wrapper.find('[data-test="editing-heading"]').exists()).toBe(false)
    })
})

describe('ComposerPanel — the route that names the post', () => {
    it('opens the composer on the post the route names', async () => {
        const router = createRouter({
            history: createMemoryHistory(),
            routes: APP_ROUTES.map(({ path, name }) => ({
                path,
                name,
                component: { template: '<div />' },
            })),
        })
        await router.push('/p/7/compose/88')
        await router.isReady()

        const context = hostContext()
        context.api.get = vi.fn().mockResolvedValue(
            makePost({ id: 88, status: 'draft', title: 'Q4 release' }),
        ) as never

        const wrapper = mountPage(ComposePage, createPinia(), router, context)
        await flushPromises()

        expect((wrapper.find('#cmp-title').element as HTMLInputElement).value).toBe('Q4 release')
    })
})
