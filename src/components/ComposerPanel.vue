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
 */
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar, Image, Link, Send, Sparkles, TriangleAlert } from 'lucide-vue-next'
import MediaStrip from './MediaStrip.vue'
import AccountPicker from './AccountPicker.vue'
import { HOST_CONTEXT_KEY } from '../shims'
import { useSocialStore } from '../stores/social'
import * as socialApi from '../api/social'
import { charCount, mediaFit, platformLabel } from '../lib/platforms'
import type { ComposerAttachment, Platform, PlatformRules } from '../types'

const props = defineProps<{
    /** The principal the post is written for. */
    principalId: number
}>()

const { t } = useI18n()
const social = useSocialStore()
const hostContext = inject(HOST_CONTEXT_KEY, null)

const title = ref('')
const body = ref('')
/** A body per platform — the AI draft produces genuinely different copy per network. */
const platformBodies = ref<Partial<Record<Platform, string>>>({})
const attachments = ref<ComposerAttachment[]>([])
const targetIds = ref<number[]>([])
const mode = ref<'draft' | 'schedule' | 'now'>('schedule')
const date = ref(new Date().toISOString().slice(0, 10))
const time = ref('09:00')
const timezone = ref('Europe/Berlin')
const submitting = ref(false)
const drafting = ref(false)

const TIMEZONES = ['Europe/Berlin', 'Europe/London', 'America/New_York', 'UTC']

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

/** The body a network will publish — its own draft when there is one. */
function bodyFor(platform: Platform): string {
    return platformBodies.value[platform] ?? body.value
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
        const count = rule === undefined ? null : charCount(bodyFor(platform), rule.max_text)

        return {
            platform,
            label: platformLabel(platform),
            rule,
            count,
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
 * The title is internal — it never reaches the network — so it must not gate
 * publishing. What the platforms require is a message or media.
 */
const canPublish = computed(
    () => targetIds.value.length > 0 && (body.value.trim() !== '' || attachments.value.length > 0),
)

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
 * Ask the backend for a draft.
 *
 * The drafts that work for LinkedIn and Facebook are genuinely different, so
 * the answer is a body *per platform* — the shared body stays what the
 * operator typed.
 */
async function generateDraft(): Promise<void> {
    if (drafting.value) return
    drafting.value = true
    try {
        const draft = await socialApi.generateDraft({
            principal_id: props.principalId,
            brief: title.value,
            platforms: targetedPlatforms.value,
            account_ids: targetIds.value,
        })
        if (draft.title !== '') title.value = draft.title
        platformBodies.value = { ...draft.bodies }
        if (body.value === '' && targetedPlatforms.value.length > 0) {
            const first = targetedPlatforms.value[0]
            body.value = first === undefined ? '' : (draft.bodies[first] ?? '')
        }
    } catch {
        social.setNotice(t('The draft could not be generated.'))
    } finally {
        drafting.value = false
    }
}

async function submit(): Promise<void> {
    submitting.value = true
    try {
        const scheduledFor =
            mode.value === 'schedule' ? new Date(`${date.value}T${time.value}:00`).toISOString() : null

        const created = await social.createPost({
            principal_id: props.principalId,
            title: title.value,
            body: body.value,
            platform_bodies: platformBodies.value,
            account_ids: targetIds.value,
            scheduled_for: scheduledFor,
            timezone: timezone.value,
            publish_now: mode.value === 'now',
            media: attachments.value.map((attachment, position) => ({
                media_asset_id: attachment.media_asset_id,
                position,
            })),
        })

        if (created === null) return

        social.setNotice(outcomeNotice(mode.value))
        title.value = ''
        body.value = ''
        platformBodies.value = {}
        attachments.value = []
        targetIds.value = []
    } finally {
        submitting.value = false
    }
}
</script>

<template>
    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]" data-test="composer">
        <div class="space-y-4">
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
                        type="button"
                        class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
                        :disabled="drafting"
                        data-test="draft-with-ai"
                        @click="generateDraft"
                    >
                        <Sparkles class="h-3.5 w-3.5" />
                        {{ drafting ? t('Drafting…') : t('Draft with AI') }}
                    </button>
                </div>
            </div>

            <div class="surface-card p-4">
                <label class="field-label" for="cmp-body">{{ t('Message') }}</label>
                <textarea
                    id="cmp-body"
                    v-model="body"
                    class="compose-surface text-sm"
                    :placeholder="t('Write the post. Per-platform limits and media fit are checked as you type.')"
                />
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

                        <p
                            v-if="preview.rule !== undefined"
                            class="mt-1 text-[11px] leading-relaxed text-muted-foreground"
                            data-test="rule-note"
                        >
                            {{ preview.rule.media_note }}
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
                            <option v-for="zone in TIMEZONES" :key="zone" :value="zone">{{ zone }}</option>
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
    </div>
</template>
