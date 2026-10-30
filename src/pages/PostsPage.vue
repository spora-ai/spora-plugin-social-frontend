<script setup lang="ts">
/**
 * The Posts tab holds **two views**: the list of posts, and how they did.
 *
 * They are one job — "what happened to the posts" — so they share a tab
 * behind a segmented control. A sixth rail item would make the navigation
 * worse for no gain.
 *
 * **The analytics view is a route, not a flag.** It is a place the operator
 * can be sent to, so it gets a path: `/apps/social/p/{pid}/posts/analytics`.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ExternalLink, RefreshCw, Send, Trash, Trash2, X } from 'lucide-vue-next'
import PostsTable from '../components/PostsTable.vue'
import AnalyticsView from '../components/AnalyticsView.vue'
import PostImage from '../components/PostImage.vue'
import { useSocialStore } from '../stores/social'
import * as socialApi from '../api/social'
import { analyticsPath, postsPath } from '../lib/paths'
import { platformLabel } from '../lib/platforms'
import { formatDateTime } from '../lib/format'
import { formatCounter } from '../lib/metrics'
import { awaitingAgent, sourceLabel } from '../lib/postSource'
import { statusLabel, statusPill } from '../lib/postStatus'
import type { Platform, PostMedia, PostStatus, PostTarget, SocialPost } from '../types'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const social = useSocialStore()

const STATUSES: PostStatus[] = ['draft', 'scheduled', 'published', 'partial', 'failed', 'cancelled']

const status = ref<'all' | PostStatus>('all')

const principalId = computed(() => {
    const raw = route.params.principalId
    const id = Number(raw)
    return Number.isSafeInteger(id) && id > 0 ? id : null
})

const isAnalytics = computed(() => route.name === 'analytics')

const drawerPostId = computed(() => {
    const raw = route.params.postId
    const id = Number(raw)
    return Number.isSafeInteger(id) && id > 0 ? id : null
})

const drawerPost = ref<SocialPost | null>(null)

/**
 * The attachments in the order they were published.
 *
 * `position` is the publish order, and it is what decides which one leads.
 */
const drawerMedia = computed<PostMedia[]>(() =>
    drawerPost.value === null
        ? []
        : [...drawerPost.value.media].sort((a, b) => a.position - b.position),
)

/** The alt of an attachment: its filename, or nothing when there is none. */
function mediaAlt(media: PostMedia): string {
    return media.filename ?? ''
}

function countFor(next: PostStatus | 'all'): number {
    if (next === 'all') return social.posts.length
    return social.posts.filter((post) => post.status === next).length
}

/**
 * The target's own outcome, in words.
 *
 * The post's status above it is translated; a target's status that stayed an
 * English enum was the one English word left on the screen. A literal call
 * per status rather than a lookup table: a table would make the key dynamic,
 * and a dynamic key is not harvestable — the German catalogue would never
 * learn the word.
 */
function targetStatusLabel(status: PostTarget['status']): string {
    switch (status) {
        case 'pending': return t('Pending')
        case 'publishing': return t('Publishing')
        case 'published': return t('Published')
        case 'failed': return t('Failed')
        case 'deleted': return t('Taken down')
    }
}

async function loadPosts(): Promise<void> {
    if (principalId.value === null) return
    await social.loadPosts(principalId.value, status.value === 'all' ? {} : { status: status.value })
}

async function chooseStatus(next: PostStatus | 'all'): Promise<void> {
    status.value = next
    await loadPosts()
}

async function closeDrawer(): Promise<void> {
    if (principalId.value === null) return
    await router.push(postsPath(principalId.value))
}

async function publishNow(): Promise<void> {
    if (drawerPost.value === null || principalId.value === null) return
    await social.publishPost(principalId.value, drawerPost.value.id)
    drawerPost.value = social.posts.find((post) => post.id === drawerPost.value?.id) ?? drawerPost.value
}

async function retryFailed(): Promise<void> {
    if (drawerPost.value === null || principalId.value === null) return
    await social.retryPost(principalId.value, drawerPost.value.id)
    drawerPost.value = social.posts.find((post) => post.id === drawerPost.value?.id) ?? drawerPost.value
}

/**
 * Take the published post back down.
 *
 * The outcome comes back on the post's targets: a network that cannot
 * delete — Instagram — leaves its target published and says why.
 */
async function takeDown(): Promise<void> {
    if (drawerPost.value === null || principalId.value === null) return
    await social.unpublishPost(principalId.value, drawerPost.value.id)
    drawerPost.value = social.posts.find((post) => post.id === drawerPost.value?.id) ?? drawerPost.value
}

async function removePost(): Promise<void> {
    if (drawerPost.value === null || principalId.value === null) return
    await social.deletePost(principalId.value, drawerPost.value.id)
    await closeDrawer()
}

/**
 * The post the drawer shows.
 *
 * The list usually carries it already — the drawer opens over the list — so
 * the read only happens for a deep link.
 */
async function loadDrawerPost(): Promise<void> {
    const id = drawerPostId.value
    if (id === null) {
        drawerPost.value = null
        return
    }
    const known = social.posts.find((post) => post.id === id)
    drawerPost.value = known ?? (await socialApi.getPost(principalId.value ?? 0, id))
}

onMounted(async () => {
    await loadPosts()
    if (principalId.value !== null) await social.loadAnalytics(principalId.value)
    await loadDrawerPost()
})

watch(principalId, async (next, prev) => {
    if (next === null || next === prev) return
    await loadPosts()
    await social.loadAnalytics(next)
})

watch(drawerPostId, () => {
    void loadDrawerPost()
})
</script>

<template>
    <div class="space-y-3" data-test="posts-page">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <nav
                class="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5"
                role="tablist"
                :aria-label="t('Post views')"
            >
                <RouterLink
                    :to="principalId === null ? postsPath(0) : postsPath(principalId)"
                    role="tab"
                    class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="isAnalytics ? 'text-muted-foreground hover:text-foreground' : 'bg-background text-foreground shadow-sm'"
                    :aria-selected="!isAnalytics"
                    data-test="segment-posts"
                >
                    {{ t('Posts') }}
                </RouterLink>
                <RouterLink
                    :to="principalId === null ? analyticsPath(0) : analyticsPath(principalId)"
                    role="tab"
                    class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="isAnalytics ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                    :aria-selected="isAnalytics"
                    data-test="segment-analytics"
                >
                    {{ t('Analytics') }}
                </RouterLink>
            </nav>

            <div v-if="!isAnalytics" class="flex flex-wrap gap-1.5">
                <button
                    v-for="entry in ['all', ...STATUSES] as const"
                    :key="entry"
                    type="button"
                    class="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
                    :class="status === entry
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'"
                    :data-test="`filter-${entry}`"
                    @click="chooseStatus(entry)"
                >
                    {{ entry === 'all' ? t('All') : entry }}
                    <span class="tabular-nums opacity-60">{{ countFor(entry) }}</span>
                </button>
            </div>
        </div>

        <AnalyticsView v-if="isAnalytics" :summary="social.analytics" />
        <PostsTable v-else :posts="social.posts" :principal-id="principalId ?? 0" />

        <div
            v-if="drawerPost !== null"
            class="fixed inset-0 z-40 flex justify-end bg-foreground/35"
            data-test="post-drawer"
            @click.self="closeDrawer"
            @keydown.esc="closeDrawer"
        >
            <aside class="h-full w-full max-w-md overflow-y-auto border-l border-border bg-background shadow-xl">
                <div class="flex items-start justify-between gap-3 border-b border-border p-4">
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <span class="pill pill-neutral">{{ sourceLabel(drawerPost.source) }}</span>
                            <span class="pill" :class="statusPill(drawerPost.status)">
                                {{ statusLabel(drawerPost.status) }}
                            </span>
                        </div>
                        <p
                            v-if="awaitingAgent(drawerPost)"
                            class="mt-1.5 text-[11px] text-muted-foreground"
                            data-test="drawer-agent-hint"
                        >
                            {{ t('The agent will publish this.') }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-muted"
                        :aria-label="t('Close')"
                        data-test="drawer-close"
                        @click="closeDrawer"
                    >
                        <X class="h-4 w-4" />
                    </button>
                </div>

                <div class="space-y-4 p-4">
                    <!-- The image first, the text under it: a post reads like a post. -->
                    <div v-if="drawerMedia.length > 0" class="space-y-2" data-test="drawer-media">
                        <PostImage
                            :media="drawerMedia[0]!"
                            :alt="mediaAlt(drawerMedia[0]!)"
                            variant="feature"
                        />
                        <div v-if="drawerMedia.length > 1" class="flex flex-wrap gap-2" data-test="drawer-media-strip">
                            <PostImage
                                v-for="item in drawerMedia.slice(1)"
                                :key="item.media_asset_id"
                                :media="item"
                                :alt="mediaAlt(item)"
                                variant="strip"
                            />
                        </div>
                    </div>

                    <div data-test="drawer-text">
                        <h2 class="text-sm font-semibold">{{ drawerPost.title || t('Untitled draft') }}</h2>

                        <div class="mt-3">
                            <span class="field-label">{{ t('Message') }}</span>
                            <p class="whitespace-pre-wrap rounded-lg border border-border p-3 text-sm leading-relaxed">
                                {{ drawerPost.body || t('No message') }}
                            </p>
                        </div>

                        <div
                            v-for="(platformBody, platform) in drawerPost.platform_bodies"
                            :key="platform"
                            class="mt-3"
                        >
                            <span class="field-label">
                                {{ platformLabel(platform as Platform) }}
                            </span>
                            <p class="whitespace-pre-wrap rounded-lg border border-border p-3 text-sm leading-relaxed">
                                {{ platformBody }}
                            </p>
                        </div>
                    </div>

                    <div>
                        <span class="field-label">{{ t('Targets') }}</span>
                        <div class="space-y-2">
                            <div
                                v-for="target in drawerPost.targets"
                                :key="target.id"
                                class="rounded-lg border border-border p-2.5"
                                :data-test="`target-result-${target.id}`"
                            >
                                <div class="flex items-center gap-2">
                                    <div class="min-w-0 flex-1">
                                        <div class="truncate text-xs font-medium">
                                            {{ drawerPost.accounts.find((account) => account.id === target.account_id)?.display_name ?? target.platform }}
                                        </div>
                                        <div class="text-[10px] text-muted-foreground">
                                            {{ platformLabel(target.platform as Platform) }}
                                        </div>
                                    </div>
                                    <span class="pill pill-neutral">{{ targetStatusLabel(target.status) }}</span>
                                </div>

                                <p
                                    v-if="target.error"
                                    class="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
                                >
                                    {{ target.error }}
                                </p>

                                <a
                                    v-if="target.external_url"
                                    :href="target.external_url"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="mt-2 inline-flex items-center gap-1 text-[11px] underline underline-offset-2"
                                >
                                    <ExternalLink class="h-3 w-3" />
                                    {{ t('View on {platform}', { platform: platformLabel(target.platform as Platform) }) }}
                                </a>

                                <div v-if="target.metrics" class="mt-2.5 border-t border-border pt-2">
                                    <div class="flex items-baseline gap-4">
                                        <span>
                                            <span class="block text-[10px] uppercase tracking-wide text-muted-foreground">{{ t('Reach') }}</span>
                                            <span
                                                class="text-sm font-semibold tabular-nums"
                                                :data-test="`target-reach-${target.id}`"
                                            >
                                                {{ formatCounter(target.metrics.reach) }}
                                            </span>
                                        </span>
                                        <span>
                                            <span class="block text-[10px] uppercase tracking-wide text-muted-foreground">{{ t('Impressions') }}</span>
                                            <span
                                                class="text-sm font-semibold tabular-nums"
                                                :data-test="`target-impressions-${target.id}`"
                                            >
                                                {{ formatCounter(target.metrics.impressions) }}
                                            </span>
                                        </span>
                                    </div>
                                    <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                        <span>{{ t('Likes') }} <span class="font-medium tabular-nums text-foreground">{{ formatCounter(target.metrics.likes) }}</span></span>
                                        <span>{{ t('Comments') }} <span class="font-medium tabular-nums text-foreground">{{ formatCounter(target.metrics.comments) }}</span></span>
                                        <span>{{ t('Shares') }} <span class="font-medium tabular-nums text-foreground">{{ formatCounter(target.metrics.shares) }}</span></span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <dl class="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
                        <div>
                            <dt class="text-muted-foreground">{{ t('Scheduled') }}</dt>
                            <dd class="font-medium">{{ formatDateTime(drawerPost.scheduled_for) }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted-foreground">{{ t('Timezone') }}</dt>
                            <dd class="font-medium">{{ drawerPost.timezone }}</dd>
                        </div>
                    </dl>

                    <div class="flex flex-wrap gap-2 border-t border-border pt-3">
                        <button
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                            data-test="drawer-publish"
                            @click="publishNow"
                        >
                            <Send class="h-3.5 w-3.5" />
                            {{ t('Publish now') }}
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                            data-test="drawer-retry"
                            @click="retryFailed"
                        >
                            <RefreshCw class="h-3.5 w-3.5" />
                            {{ t('Retry failed') }}
                        </button>
                        <button
                            v-if="drawerPost.status === 'published' || drawerPost.status === 'partial'"
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                            data-test="drawer-take-down"
                            @click="takeDown"
                        >
                            <Trash2 class="h-3.5 w-3.5" />
                            {{ t('Take down') }}
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-muted"
                            data-test="drawer-delete"
                            @click="removePost"
                        >
                            <Trash class="h-3.5 w-3.5" />
                            {{ t('Delete') }}
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    </div>
</template>
