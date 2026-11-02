<script setup lang="ts">
/**
 * The composer: the writing surface on the left, the preview and the publish
 * controls on the right.
 *
 * The right column is the part that changes most — the per-platform counters,
 * the media fit, the schedule — so it earns a permanent column.
 *
 * **The counters are per platform, not per post.** The same body fits one
 * network and blows another's limit, so a single counter would say nothing
 * about the post that is about to go out. The limits are the backend's: it
 * is what refuses the publish.
 *
 * **One body, and a network's own only where it differs.** The Message box
 * edits the shared body; a network that needs its own wording gets an
 * override, and the preview always shows what that network will publish.
 *
 * **The same composer edits a post.** With a post id it loads that post
 * instead of writing a new one, and the submit saves the changes rather than
 * creating a second post.
 */
import { computed, inject, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, Image, Link, Send, Sparkles, TriangleAlert } from 'lucide-vue-next'
import MediaStrip from './MediaStrip.vue'
import AccountPicker from './AccountPicker.vue'
import { HOST_CONTEXT_KEY } from '../shims'
import { useSocialStore } from '../stores/social'
import { ApiError, getApi } from '../api/client'
import * as socialApi from '../api/social'
import { agentHasSocialTool, listAgents, type AgentSummary } from '../api/agents'
import {
    agentToolsPath,
    hostLinkAction,
    taskChatPath,
    type HostLinkAction,
    type PluginRouter,
} from '../lib/hostNavigation'
import { charCount, composeText, mediaFit, parseHashtags, platformLabel } from '../lib/platforms'
import { composePath } from '../lib/paths'
import type { ComposerAttachment, Platform, PlatformRules, SocialPost } from '../types'

const props = defineProps<{
    /** The principal the post is written for. */
    principalId: number
    /** The post being edited — absent when a new post is being written. */
    postId?: number
}>()

const { t } = useI18n()
const social = useSocialStore()
const hostContext = inject(HOST_CONTEXT_KEY, null)

const title = ref('')
const body = ref('')
/** A body per platform — the copy that fits LinkedIn does not fit Facebook. */
const platformBodies = ref<Partial<Record<Platform, string>>>({})
/** The hashtags as the operator typed them; the hashes are added on the way out. */
const hashtagInput = ref('')
const attachments = ref<ComposerAttachment[]>([])
const targetIds = ref<number[]>([])
const mode = ref<'draft' | 'schedule' | 'now'>('schedule')
const date = ref(new Date().toISOString().slice(0, 10))
const time = ref('09:00')
const timezone = ref('Europe/Berlin')
const submitting = ref(false)
/** The agent write in flight — the panel's send, not the post's. */
const drafting = ref(false)
/** The platform whose own text the Message box edits — null for the shared body. */
const editingPlatform = ref<Platform | null>(null)
/** The post could not be read, so there is nothing to edit. */
const postError = ref<string | null>(null)
/** The post is being read. */
const loadingPost = ref(false)

const BASE_TIMEZONES = ['Europe/Berlin', 'Europe/London', 'America/New_York', 'UTC']

/**
 * The zones the composer offers.
 *
 * A post's own zone joins the list: the post was written in it, and a select
 * that does not carry it shows nothing at all.
 */
const timezones = computed(() =>
    BASE_TIMEZONES.includes(timezone.value) ? BASE_TIMEZONES : [timezone.value, ...BASE_TIMEZONES],
)

/** The accounts the operator may publish to: the ones with a live token. */
const publishableAccounts = computed(() => social.accounts.filter((account) => account.status === 'active'))

/** The platforms the post currently targets — the media fit is judged on these. */
const targetedPlatforms = computed<Platform[]>(() => {
    const platforms: Platform[] = []
    for (const account of publishableAccounts.value) {
        if (!targetIds.value.includes(account.id)) continue
        if (!platforms.includes(account.platform)) platforms.push(account.platform)
    }
    return platforms
})

const targetSummary = computed(() => {
    const count = targetIds.value.length
    return count === 0 ? t('No account selected') : t('{n} accounts selected', { n: count })
})

/**
 * The message the Message box edits: the shared body, or one network's own.
 *
 * The box is the only writing surface, so it edits whichever of the two the
 * operator picked — what they type is what goes out.
 */
const message = computed({
    get: (): string => {
        if (editingPlatform.value === null) return body.value
        return platformBodies.value[editingPlatform.value] ?? ''
    },
    set: (value: string): void => {
        if (editingPlatform.value === null) {
            body.value = value
            return
        }
        platformBodies.value = { ...platformBodies.value, [editingPlatform.value]: value }
    },
})

/** The tags the post carries — the hashes are added when it is composed. */
const hashtags = computed(() => parseHashtags(hashtagInput.value))

/** The tags as they will read under the message. */
const hashtagText = computed(() => hashtags.value.map((tag) => `#${tag}`).join(' '))

/** Whether a network has a wording of its own — the shared one is not its own. */
function hasOwnText(platform: Platform): boolean {
    const own = platformBodies.value[platform]
    return own !== undefined && own !== ''
}

/**
 * The text a network will publish — its own wording when it has one.
 *
 * An empty own wording is no wording: the backend falls back to the shared
 * body for it, so the preview must not show an empty post either.
 */
function bodyFor(platform: Platform): string {
    if (!hasOwnText(platform)) return body.value
    return platformBodies.value[platform] ?? ''
}

/**
 * The rule the backend enforces for one platform.
 *
 * Undefined until the config has been read, and undefined for good when it
 * could not be: the composer says so rather than judging the body against a
 * limit of its own.
 */
function ruleFor(platform: Platform): PlatformRules | undefined {
    return social.rules[platform]
}

/**
 * One row of the preview: the network, its rule and what the rule says
 * about this post.
 *
 * The count is null while the rules are unknown, and the media is judged
 * only once the rule is there.
 */
const previews = computed(() =>
    targetedPlatforms.value.map((platform) => {
        const rule = ruleFor(platform)
        // The count is on the composed text: the hashtags go out with the
        // body, so they are part of what the limit is checked against.
        const count =
            rule === undefined
                ? null
                : charCount(composeText(bodyFor(platform), hashtags.value), rule.max_text)

        return {
            platform,
            label: platformLabel(platform),
            rule,
            count,
            ownText: hasOwnText(platform),
            mediaRequired: rule?.media_required === true,
            mediaCount: rule?.media_count ?? null,
            fetchesMedia: rule?.fetches_media === true,
            mediaFits:
                rule === undefined ||
                attachments.value.every((attachment) => mediaFit(attachment, rule).fits),
        }
    }),
)

/**
 * Whether the post may go out.
 *
 * The backend's rule: a post needs a message — the shared one or a network's
 * own — or media. The title never counts: it never reaches the network.
 */
const canPublish = computed(
    () =>
        targetIds.value.length > 0 &&
        (body.value.trim() !== '' ||
            Object.values(platformBodies.value).some(
                (own) => own !== undefined && own.trim() !== '',
            ) ||
            attachments.value.length > 0),
)

/**
 * Give a network a wording of its own.
 *
 * It starts as a copy of the shared body, so the operator edits the text
 * they already wrote rather than writing it again.
 */
function giveOwnText(platform: Platform): void {
    platformBodies.value = { ...platformBodies.value, [platform]: body.value }
    editingPlatform.value = platform
}

/** Edit the wording a network already has of its own. */
function editOwnText(platform: Platform): void {
    editingPlatform.value = platform
}

/**
 * Drop a network's own wording and go back to the shared body.
 *
 * The wording is gone, not merely hidden: the network publishes the shared
 * body again, the way it did before.
 */
function useSharedText(platform: Platform): void {
    const next = { ...platformBodies.value }
    delete next[platform]
    platformBodies.value = next
    editingPlatform.value = null
}

/** Leave the network's own wording without dropping it. */
function editSharedText(): void {
    editingPlatform.value = null
}

/**
 * What the composer says once the post was accepted.
 *
 * The mode decides what happened, so the mode decides the words: a notice
 * that read "Draft saved" after a publish would be worse than none.
 */
function outcomeNotice(next: 'draft' | 'schedule' | 'now'): string {
    if (next === 'now') return t('Published')
    if (next === 'schedule') return t('Scheduled')
    return t('Draft saved')
}

/** The submit button's own label — it names what the button will do. */
const submitLabel = computed(() => {
    if (mode.value === 'now') return t('Publish now')
    if (mode.value === 'schedule') return t('Schedule post')
    return t('Save draft')
})

function removeAttachment(mediaAssetId: string): void {
    attachments.value = attachments.value.filter((item) => item.media_asset_id !== mediaAssetId)
}

/**
 * Open the host's media picker.
 *
 * The host's picker lists the Media Archive *and* uploads, so the plugin ships
 * no upload dialog of its own. Its own two-step shape is kept: a tile click
 * chooses, the Attach button commits.
 */
async function attachMedia(): Promise<void> {
    if (hostContext === null) return
    const assets = await hostContext.openMediaPicker({ multi: true, mediaKind: 'image' })
    if (assets.length === 0) return

    for (const asset of assets) {
        if (attachments.value.some((item) => item.media_asset_id === asset.id)) continue
        attachments.value.push({
            media_asset_id: asset.id,
            filename: asset.filename ?? asset.id,
            mime_type: asset.mime_type ?? '',
            size_bytes: asset.byte_size ?? 0,
            asset_url: asset.asset_url,
        })
    }
}

/**
 * The agent brief: the operator's prompt, the agent that writes the post.
 *
 * The plugin does not write the post itself and does not wait for the agent
 * — it hands the prompt over and lets the operator watch the agent in the
 * host's own chat. The brief therefore ends at a task, not at a post.
 *
 * **The brief takes the composer's surface while it is open.** Writing a
 * post by hand and briefing an agent to write one are two different jobs,
 * and a panel floating over the empty message box would leave the operator
 * looking at a form that is not the one in use.
 */
const view = ref<'write' | 'agent'>('write')

/**
 * The brief the operator starts from.
 *
 * A prompt the operator has to write from nothing is a prompt they will not
 * write: the brief says what the agent is for and names the tool it writes
 * the post with, so the first send is one click and the second is a change
 * to the same brief.
 */
const DEFAULT_AGENT_PROMPT = t(
    'Draft a post for social media and create a draft with the social_post tool.',
)

const agentPrompt = ref(DEFAULT_AGENT_PROMPT)
const agents = ref<AgentSummary[]>([])
const selectedAgentId = ref<number | null>(null)
/** What went wrong, said in the API's own words. */
const agentError = ref<string | null>(null)
/** The agents could not be read — which is not the same as there being none. */
const agentsError = ref<string | null>(null)
/** The task the agent runs in — the chat the operator watches it in. */
const sentTaskId = ref<number | null>(null)

/** The chosen agent, when there is one. */
const selectedAgent = computed<AgentSummary | null>(
    () => agents.value.find((agent) => agent.id === selectedAgentId.value) ?? null,
)

/** Whether the chosen agent can write posts at all. */
const selectedAgentCanPost = computed(
    () => selectedAgent.value !== null && agentHasSocialTool(selectedAgent.value),
)

/**
 * What the panel says about the chosen agent.
 *
 * The three states are three different instructions: there is no agent to
 * write with, the agent cannot write posts yet, or the way to use it.
 */
const agentNote = computed(() => {
    if (agentsError.value !== null) return agentsError.value
    if (agents.value.length === 0) {
        return t('This principal has no agent yet. Create one, and give it the social_post tool.')
    }
    if (selectedAgent.value !== null && !selectedAgentCanPost.value) {
        return t('This agent cannot create posts — it needs the social_post tool.')
    }
    return t(
        'The agent writes the post and saves it as a draft. You find it in Posts, where you can edit it and publish it.',
    )
})

/** The tools page belongs to the note that says the agent cannot post. */
const showToolsLink = computed(
    () => selectedAgent.value !== null && !selectedAgentCanPost.value,
)

/** The send needs a prompt, an agent, and an agent that can write posts. */
const canSend = computed(
    () =>
        agentPrompt.value.trim() !== '' &&
        selectedAgent.value !== null &&
        selectedAgentCanPost.value,
)

/** The host's router, when the host published one. */
function hostRouter(): PluginRouter | null {
    return hostContext?.router ?? null
}

/** The agent's tools page, where the operator enables the social_post tool. */
const agentToolsLink = computed<HostLinkAction>(() => {
    const agent = selectedAgent.value
    if (agent === null || agentHasSocialTool(agent)) return { kind: 'disabled' }
    return hostLinkAction(hostRouter(), agentToolsPath(agent.id))
})

/** The chat the agent runs in, once there is a task. */
const taskChatLink = computed<HostLinkAction>(() =>
    sentTaskId.value === null
        ? { kind: 'disabled' }
        : hostLinkAction(hostRouter(), taskChatPath(sentTaskId.value)),
)

/**
 * Leave the plugin for a host screen.
 *
 * The router is the host's, and it can be null — the standalone entry passes
 * one — so the link renders disabled rather than broken.
 */
function goToHost(action: HostLinkAction): void {
    const router = hostRouter()
    if (action.kind !== 'push' || router === null) return
    void router.push(action.to)
}

/**
 * What went wrong, in the API's own words.
 *
 * The backend's message names the part that was refused; a generic one would
 * hide it.
 */
function failureMessage(e: unknown, fallback: string): string {
    if (e instanceof ApiError) return e.message
    if (e instanceof Error && e.message !== '') return e.message
    return fallback
}

/**
 * Read the principal's agents.
 *
 * The list is the host's, and it changes: an agent may have gained the
 * social_post tool since the brief was last open. A chosen agent that is no
 * longer on the list is dropped — it belongs to a principal the operator has
 * left.
 */
async function loadAgents(): Promise<void> {
    agentsError.value = null
    try {
        agents.value = await listAgents(props.principalId)
    } catch (e) {
        agents.value = []
        agentsError.value = failureMessage(e, t('The agents could not be read.'))
    }

    if (selectedAgent.value === null) {
        selectedAgentId.value = null
    }
}

/**
 * Brief an agent instead of writing the post.
 *
 * The agents are read on the way in, because the brief is the only place
 * they are needed.
 */
async function openAgentView(): Promise<void> {
    view.value = 'agent'
    await loadAgents()
}

/**
 * Back to the writing surface.
 *
 * What the operator had typed is still there: the brief never touched it.
 */
function closeAgentView(): void {
    view.value = 'write'
}

/**
 * Hand the prompt to the agent.
 *
 * The task is a first-class Spora task: the agent runs in its own chat, and
 * the operator watches it there. The plugin neither polls nor reads the
 * answer back.
 *
 * **What the plugin knows is that the prompt was sent** — not that the agent
 * is writing a post. Whether it does is the agent's business, and the notice
 * says what happened.
 */
async function sendToAgent(): Promise<void> {
    if (drafting.value) return
    const agent = selectedAgent.value
    if (agent === null || !canSend.value) return

    drafting.value = true
    agentError.value = null
    try {
        const result = await getApi().post<{ task?: { id?: number } }>('/tasks', {
            agent_id: agent.id,
            prompt: agentPrompt.value,
        })
        sentTaskId.value = result.task?.id ?? null
        social.setNotice(t('Prompt sent'))
        agentPrompt.value = DEFAULT_AGENT_PROMPT
    } catch (e) {
        agentError.value = failureMessage(e, t('The prompt could not be sent.'))
    } finally {
        drafting.value = false
    }
}

/**
 * Put the post into the composer.
 *
 * Everything the composer shows comes from the post: the copy, the tags, the
 * accounts, the attachments and the moment it goes out.
 */
function applyPost(post: SocialPost): void {
    title.value = post.title
    body.value = post.body
    platformBodies.value = { ...post.platform_bodies }
    hashtagInput.value = post.hashtags.map((tag) => `#${tag}`).join(' ')
    targetIds.value = post.accounts.map((account) => account.id)
    attachments.value = post.media.map((media) => ({
        media_asset_id: media.media_asset_id,
        filename: media.filename ?? media.media_asset_id,
        mime_type: media.mime_type ?? '',
        // The post's own media carries no size: the archive holds it, and
        // the composer only needs it to judge the file against the limit.
        size_bytes: 0,
        asset_url: media.asset_url,
    }))
    timezone.value = post.timezone

    if (post.scheduled_for !== null) {
        // The box holds wall-clock time in the operator's own clock, and that
        // is the clock the composer sends — so the moment is shown the way it
        // will be written back.
        const when = new Date(post.scheduled_for)
        const local = new Date(when.getTime() - when.getTimezoneOffset() * 60_000)
        date.value = local.toISOString().slice(0, 10)
        time.value = local.toISOString().slice(11, 16)
    }

    mode.value = post.status === 'scheduled' ? 'schedule' : 'draft'
}

/**
 * The empty surface — a new post, and the composer after an edit is left.
 *
 * The route without a post id is the plain composer, so the surface has to
 * be empty there: a post the operator just left would otherwise be saved
 * again as a new one.
 */
function resetSurface(): void {
    title.value = ''
    body.value = ''
    platformBodies.value = {}
    hashtagInput.value = ''
    attachments.value = []
    targetIds.value = []
    editingPlatform.value = null
    mode.value = 'schedule'
    date.value = new Date().toISOString().slice(0, 10)
    time.value = '09:00'
    timezone.value = 'Europe/Berlin'
}

/**
 * Read the post the operator is editing.
 *
 * The post belongs to the principal in the URL: one of another principal is a
 * 404, and the composer says so rather than showing an empty draft that
 * would be saved over it.
 */
async function loadPost(): Promise<void> {
    const id = props.postId
    postError.value = null

    if (id === undefined) {
        resetSurface()
        return
    }

    loadingPost.value = true
    try {
        const post = await socialApi.getPost(props.principalId, id)

        // A post that has been out on the network cannot be edited into
        // something else: the copy is already published, and an edit that
        // changes only the stored copy would look like it changed nothing.
        if (post.status === 'published' || post.status === 'partial') {
            postError.value = t('This post has been published — its copy is on the network.')
            return
        }

        applyPost(post)
    } catch (e) {
        postError.value = failureMessage(e, t('The post could not be loaded.'))
    } finally {
        loadingPost.value = false
    }
}

onMounted(() => {
    void loadPost()
})

watch(
    () => props.principalId,
    () => {
        // The agents belong to the principal the operator is working as, so
        // a switch of principal is a switch of agents.
        if (view.value === 'agent') {
            void loadAgents()
        }
    },
)

watch(
    () => props.postId,
    () => {
        void loadPost()
    },
)

async function submit(): Promise<void> {
    submitting.value = true
    try {
        const scheduledFor =
            mode.value === 'schedule' ? new Date(`${date.value}T${time.value}:00`).toISOString() : null

        const payload = {
            principal_id: props.principalId,
            title: title.value,
            body: body.value,
            platform_bodies: platformBodies.value,
            hashtags: hashtags.value,
            account_ids: targetIds.value,
            scheduled_for: scheduledFor,
            timezone: timezone.value,
            media: attachments.value.map((attachment, position) => ({
                media_asset_id: attachment.media_asset_id,
                position,
            })),
        }

        const postId = props.postId
        if (postId !== undefined) {
            const saved = await social.updatePost(props.principalId, postId, payload)
            if (saved === null) return

            // Saving does not publish: going out is a second step, and the
            // operator asked for it with the button they pressed.
            if (mode.value === 'now') {
                const published = await social.publishPost(props.principalId, postId)
                if (published === null) return
            }

            social.setNotice(outcomeNotice(mode.value))
            return
        }

        const created = await social.createPost({ ...payload, publish_now: mode.value === 'now' })
        if (created === null) return

        social.setNotice(outcomeNotice(mode.value))
        resetSurface()
    } finally {
        submitting.value = false
    }
}
</script>

<template>
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" data-test="composer">
        <div
            v-if="postError !== null"
            class="surface-card p-4 lg:col-span-2"
            data-test="post-load-error"
        >
            <p class="text-sm text-destructive">{{ postError }}</p>
        </div>

        <div
            v-else-if="view === 'agent'"
            class="surface-card space-y-4 p-4 lg:col-span-2"
            data-test="agent-panel"
        >
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                    <h2 class="text-sm font-semibold">{{ t('Draft with an agent') }}</h2>
                    <p class="mt-0.5 text-xs text-muted-foreground">
                        {{ t('The agent writes the post and saves it as a draft. You find it in Posts, where you can edit it and publish it.') }}
                    </p>
                </div>
                <button
                    type="button"
                    class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                    data-test="agent-back"
                    @click="closeAgentView"
                >
                    {{ t('Write it myself') }}
                </button>
            </div>

            <div>
                <label class="field-label" for="cmp-agent-prompt">{{ t('The prompt') }}</label>
                <textarea
                    id="cmp-agent-prompt"
                    v-model="agentPrompt"
                    :placeholder="t('What should the post say?')"
                    class="w-full rounded-lg border border-border bg-background p-2.5 text-sm outline-0 placeholder:text-muted-foreground/70"
                    data-test="agent-prompt"
                />
            </div>

            <div>
                <label class="field-label" for="cmp-agent">{{ t('The agent') }}</label>
                <select
                    id="cmp-agent"
                    v-model="selectedAgentId"
                    class="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                    data-test="agent-select"
                >
                    <option :value="null">{{ t('Choose an agent') }}</option>
                    <option v-for="agent in agents" :key="agent.id" :value="agent.id">
                        {{ agent.name }}
                    </option>
                </select>
            </div>

            <p class="text-xs text-muted-foreground" data-test="agent-note">
                {{ agentNote }}
                <button
                    v-if="showToolsLink"
                    type="button"
                    class="underline disabled:cursor-default disabled:no-underline"
                    :disabled="agentToolsLink.kind !== 'push'"
                    data-test="agent-tools-link"
                    @click="goToHost(agentToolsLink)"
                >
                    {{ t('Give the agent the tool') }}
                </button>
            </p>

            <p v-if="agentError !== null" class="text-xs text-destructive" data-test="agent-error">
                {{ agentError }}
            </p>

            <button
                type="button"
                class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors"
                :class="canSend
                    ? 'bg-primary text-primary-foreground hover:opacity-90'
                    : 'cursor-not-allowed bg-muted text-muted-foreground'"
                :disabled="!canSend || drafting"
                data-test="agent-send"
                @click="sendToAgent"
            >
                <Send class="h-3.5 w-3.5" />
                {{ drafting ? t('Sending…') : t('Send to the agent') }}
            </button>

            <p v-if="sentTaskId !== null" class="text-xs text-muted-foreground" data-test="agent-sent">
                {{ t('The prompt is with the agent. The post appears in Posts when the agent writes one.') }}
                <button
                    type="button"
                    class="underline disabled:cursor-default disabled:no-underline"
                    :disabled="taskChatLink.kind !== 'push'"
                    data-test="agent-chat-link"
                    @click="goToHost(taskChatLink)"
                >
                    {{ t('See progress here') }}
                </button>
            </p>
        </div>

        <template v-else>
            <div class="space-y-4">
                <div
                    v-if="postId !== undefined"
                    class="surface-card flex flex-wrap items-center justify-between gap-3 p-4"
                    data-test="editing-banner"
                >
                    <div class="min-w-0">
                        <h2 class="text-sm font-semibold" data-test="editing-heading">
                            {{ t('Editing post #{id}', { id: postId }) }}
                        </h2>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                            {{ t('Change the post, then save it or publish it.') }}
                        </p>
                    </div>
                    <RouterLink
                        :to="composePath(principalId)"
                        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                        data-test="back-to-composer"
                    >
                        {{ t('Write a new post') }}
                    </RouterLink>
                </div>

                <p v-if="loadingPost" class="text-xs text-muted-foreground" data-test="post-loading">
                    {{ t('Loading the post…') }}
                </p>

                <div class="surface-card p-4">
                    <div class="flex items-start gap-3">
                        <div class="min-w-0 flex-1">
                            <label class="field-label" for="cmp-title">
                                {{ t('Title') }}
                                <span class="font-normal normal-case tracking-normal text-muted-foreground/70">
                                    {{ t('(internal — not posted)') }}
                                </span>
                            </label>
                            <input
                                id="cmp-title"
                                v-model="title"
                                type="text"
                                :placeholder="t('What is this post about?')"
                                class="w-full bg-transparent text-lg font-semibold outline-0 placeholder:text-muted-foreground/60"
                            />
                        </div>
                        <button
                            v-if="postId === undefined"
                            type="button"
                            class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                            data-test="draft-with-agent"
                            @click="openAgentView"
                        >
                            <Sparkles class="h-3.5 w-3.5" />
                            {{ t('Draft with an agent') }}
                        </button>
                    </div>
                </div>

                <div class="surface-card p-4">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <label class="field-label" for="cmp-body" data-test="message-label">
                            {{
                                editingPlatform === null
                                    ? t('Shared message')
                                    : t('Message for {platform}', { platform: platformLabel(editingPlatform) })
                            }}
                        </label>
                        <button
                            v-if="editingPlatform !== null"
                            type="button"
                            class="text-[11px] underline underline-offset-2"
                            data-test="back-to-shared"
                            @click="editSharedText"
                        >
                            {{ t('Back to the shared message') }}
                        </button>
                    </div>
                    <p class="mt-1 text-[11px] text-muted-foreground" data-test="message-hint">
                        {{
                            editingPlatform === null
                                ? t('Every network publishes this text.')
                                : t('This network publishes this text instead of the shared one.')
                        }}
                    </p>
                    <textarea
                        id="cmp-body"
                        v-model="message"
                        class="compose-surface text-sm"
                        :placeholder="t('Write the post. Per-platform limits and media fit are checked as you type.')"
                    />

                    <div class="mt-3">
                        <label class="field-label" for="cmp-hashtags">{{ t('Hashtags') }}</label>
                        <input
                            id="cmp-hashtags"
                            v-model="hashtagInput"
                            type="text"
                            class="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                            :placeholder="t('Hashtags, separated by spaces or commas')"
                            data-test="hashtags-input"
                        />
                        <p class="mt-1 text-[11px] text-muted-foreground">
                            {{ t('The tags go under the message, on every network.') }}
                        </p>
                    </div>

                    <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <button
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                            data-test="attach-media"
                            @click="attachMedia"
                        >
                            <Image class="h-3.5 w-3.5" />
                            {{ t('Attach media') }}
                        </button>
                    </div>
                    <MediaStrip
                        :attachments="attachments"
                        :platforms="targetedPlatforms"
                        :rules="social.rules"
                        @remove="removeAttachment"
                    />
                </div>

                <div class="surface-card p-4">
                    <div class="flex items-center justify-between gap-3">
                        <span class="field-label mb-0">{{ t('Publish to') }}</span>
                        <span class="text-xs text-muted-foreground" data-test="target-summary">{{ targetSummary }}</span>
                    </div>

                    <div class="mt-3">
                        <AccountPicker v-model="targetIds" :accounts="publishableAccounts" />
                    </div>
                </div>
            </div>

            <div class="space-y-4">
                <div class="surface-card p-4">
                    <span class="field-label">{{ t('Platform preview') }}</span>
                    <div class="space-y-3">
                        <p v-if="targetedPlatforms.length === 0" class="text-xs text-muted-foreground">
                            {{ t('Pick at least one account to see the per-platform preview — limits, media fit, and whether the media needs converting.') }}
                        </p>

                        <p
                            v-if="social.configError !== null"
                            class="text-xs text-destructive"
                            data-test="rules-unavailable"
                        >
                            {{ t('The platform limits could not be read, so they are not checked.') }}
                        </p>

                        <div
                            v-for="preview in previews"
                            :key="preview.platform"
                            class="rounded-lg border border-border p-2.5"
                            :data-test="`preview-${preview.platform}`"
                        >
                            <div class="flex items-center justify-between gap-2">
                                <span class="platform-chip" :data-platform="preview.platform">
                                    {{ preview.label }}
                                </span>
                                <div class="flex items-center gap-2">
                                    <span
                                        v-if="hashtags.length > 0"
                                        class="max-w-[8rem] truncate text-[11px] text-muted-foreground"
                                        data-test="preview-hashtags"
                                    >
                                        {{ hashtagText }}
                                    </span>
                                    <span
                                        v-if="preview.count !== null"
                                        class="char-count text-[11px] tabular-nums text-muted-foreground"
                                        :data-over="preview.count.over"
                                        :data-near="preview.count.near"
                                    >
                                        {{ preview.count.n }} / {{ preview.count.limit }}
                                    </span>
                                    <span v-else class="text-[11px] tabular-nums text-muted-foreground" data-test="count-unknown">
                                        &mdash;
                                    </span>
                                </div>
                            </div>

                            <p
                                v-if="preview.rule !== undefined"
                                class="mt-1 text-[11px] leading-relaxed text-muted-foreground"
                                data-test="rule-note"
                            >
                                {{ preview.rule.media_note }}
                            </p>

                            <p
                                v-if="preview.rule !== undefined && preview.rule.visible_chars > 0"
                                class="mt-1 text-[11px] leading-relaxed text-muted-foreground"
                                data-test="visible-chars"
                            >
                                {{ t('Only the first ~{n} characters show.', { n: preview.rule.visible_chars }) }}
                            </p>

                            <p class="mt-1.5 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                                <span v-if="bodyFor(preview.platform) === ''" class="italic">{{ t('No message yet') }}</span>
                                <span v-else>{{ bodyFor(preview.platform) }}</span>
                            </p>

                            <div class="mt-2 flex flex-wrap gap-1">
                                <span v-if="preview.count !== null && preview.count.over" class="pill pill-failed">
                                    <TriangleAlert class="h-3 w-3" />
                                    {{ t('Over the limit') }}
                                </span>
                                <span
                                    v-if="preview.mediaRequired && attachments.length === 0"
                                    class="pill pill-partial"
                                >
                                    <Image class="h-3 w-3" />
                                    {{ t('Media required') }}
                                </span>
                                <span
                                    v-if="!preview.mediaFits"
                                    class="pill pill-partial"
                                >
                                    <TriangleAlert class="h-3 w-3" />
                                    {{ t('The media does not fit this network') }}
                                </span>
                                <span
                                    v-if="preview.mediaCount !== null && attachments.length > preview.mediaCount"
                                    class="pill pill-partial"
                                >
                                    <Image class="h-3 w-3" />
                                    {{ t('{n} media max', { n: preview.mediaCount }) }}
                                </span>
                                <span
                                    v-if="preview.fetchesMedia && attachments.length > 0"
                                    class="pill pill-scheduled"
                                >
                                    <Link class="h-3 w-3" />
                                    {{ t('Public URL') }}
                                </span>
                            </div>

                            <div class="mt-2 flex flex-wrap gap-1">
                                <button
                                    v-if="!preview.ownText"
                                    type="button"
                                    class="inline-flex h-7 items-center rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                                    :data-test="`platform-own-text-${preview.platform}`"
                                    @click="giveOwnText(preview.platform)"
                                >
                                    {{ t('Its own text') }}
                                </button>
                                <button
                                    v-else
                                    type="button"
                                    class="inline-flex h-7 items-center rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                                    :data-test="`platform-edit-${preview.platform}`"
                                    @click="editOwnText(preview.platform)"
                                >
                                    {{ t('Edit') }}
                                </button>
                                <button
                                    v-if="preview.ownText"
                                    type="button"
                                    class="inline-flex h-7 items-center rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                                    :data-test="`platform-use-shared-${preview.platform}`"
                                    @click="useSharedText(preview.platform)"
                                >
                                    {{ t('Use the shared message') }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="surface-card space-y-3 p-4">
                    <span class="field-label">{{ t('When') }}</span>
                    <div class="space-y-2">
                        <label class="flex cursor-pointer items-center gap-2 text-sm">
                            <input v-model="mode" type="radio" value="draft" class="h-3.5 w-3.5" />
                            {{ t('Save as draft') }}
                        </label>
                        <label class="flex cursor-pointer items-center gap-2 text-sm">
                            <input v-model="mode" type="radio" value="schedule" class="h-3.5 w-3.5" />
                            {{ t('Schedule') }}
                        </label>
                        <label class="flex cursor-pointer items-center gap-2 text-sm">
                            <input v-model="mode" type="radio" value="now" class="h-3.5 w-3.5" />
                            {{ t('Publish now') }}
                        </label>

                        <div v-if="mode === 'schedule'" class="grid grid-cols-2 gap-2 pt-1">
                            <div>
                                <label class="field-label" for="cmp-date">{{ t('Date') }}</label>
                                <input
                                    id="cmp-date"
                                    v-model="date"
                                    type="date"
                                    class="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                                />
                            </div>
                            <div>
                                <label class="field-label" for="cmp-time">{{ t('Time') }}</label>
                                <input
                                    id="cmp-time"
                                    v-model="time"
                                    type="time"
                                    class="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                                />
                            </div>
                        </div>
                        <div v-if="mode === 'schedule'">
                            <label class="field-label" for="cmp-timezone">{{ t('Timezone') }}</label>
                            <select
                                id="cmp-timezone"
                                v-model="timezone"
                                class="h-8 rounded-lg border border-border bg-background px-2 text-xs"
                            >
                                <option v-for="zone in timezones" :key="zone" :value="zone">{{ zone }}</option>
                            </select>
                        </div>
                    </div>

                    <div class="flex flex-col gap-2 pt-1">
                        <button
                            type="button"
                            class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors"
                            :class="canPublish
                                ? 'bg-primary text-primary-foreground hover:opacity-90'
                                : 'cursor-not-allowed bg-muted text-muted-foreground'"
                            :disabled="!canPublish || submitting"
                            data-test="composer-submit"
                            @click="submit"
                        >
                            <Send v-if="mode === 'now'" class="h-3.5 w-3.5" />
                            <Calendar v-else-if="mode === 'schedule'" class="h-3.5 w-3.5" />
                            <Sparkles v-else class="h-3.5 w-3.5" />
                            {{ submitLabel }}
                        </button>
                        <p v-if="mode !== 'draft'" class="text-[11px] text-muted-foreground">
                            {{ t('Publishing is irreversible on the target networks. The agent path asks for approval; a direct publish from here does not.') }}
                        </p>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
