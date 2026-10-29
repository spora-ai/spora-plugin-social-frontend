<script setup lang="ts">
/**
 * The post list.
 *
 * **One reach column, and the breakdown in the drawer.** The table answers
 * "how did this post do"; the drawer answers "where did the numbers come
 * from", because each network counts reach its own way.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Image } from 'lucide-vue-next'
import PostImage from './PostImage.vue'
import { measuredTargets, formatCounter, postEngagementRate, postPlatforms, postReach } from '../lib/metrics'
import { awaitingAgent, sourceLabel } from '../lib/postSource'
import { statusLabel, statusPill } from '../lib/postStatus'
import { formatWhen, NO_VALUE } from '../lib/format'
import { postPath } from '../lib/paths'
import { platformLabel } from '../lib/platforms'
import type { Platform, PostMedia, SocialPost } from '../types'

const props = defineProps<{
    posts: SocialPost[]
    principalId: number
}>()

const { t } = useI18n()
const router = useRouter()

const failedTargets = computed(() => (post: SocialPost) => post.targets.filter((target) => target.status === 'failed').length)

/**
 * The attachment the thumbnail shows.
 *
 * The first one in `position` order that still has an asset — a post whose
 * image is gone shows no thumbnail at all rather than a placeholder box, so
 * the row reads exactly as it did before.
 */
function thumbnail(post: SocialPost): PostMedia | null {
    const ordered = [...post.media].sort((a, b) => a.position - b.position)
    return ordered.find((item) => item.asset_url !== null) ?? null
}

function openPost(post: SocialPost): void {
    void router.push(postPath(props.principalId, post.id))
}

/**
 * The rate, or a dash when there is no rate to state.
 *
 * A post whose reach was never reported has no rate either, and a rate over
 * an unknown reach would be a rate over nothing.
 */
function rateLabel(post: SocialPost): string {
    const rate = postEngagementRate(post)
    if (rate === null) return NO_VALUE
    return `${(rate * 100).toFixed(1)}% ${t('engagement')}`
}

/**
 * When the post happened: the moment it went out, or the moment it is due.
 *
 * A post that went out on one target and failed on another has a publish
 * time, and the old rule — "published, or else the scheduled date" — left
 * it with no date at all.
 */
function postWhen(post: SocialPost): string | null {
    return post.published_at ?? post.scheduled_for
}

</script>

<template>
    <div class="surface-card overflow-hidden" data-test="posts-table">
        <p v-if="posts.length === 0" class="px-6 py-10 text-center text-sm font-medium">
            {{ t('Nothing here yet') }}
        </p>

        <table v-else class="w-full text-sm">
            <thead>
                <tr class="border-b border-border bg-muted/40 text-left">
                    <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Post') }}</th>
                    <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Status') }}</th>
                    <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Targets') }}</th>
                    <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Reach') }}</th>
                    <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('When') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr
                    v-for="post in posts"
                    :key="post.id"
                    class="cursor-pointer border-b border-border align-top transition-colors last:border-b-0 hover:bg-muted/30"
                    :data-test="`post-row-${post.id}`"
                    @click="openPost(post)"
                >
                    <td class="px-3 py-2.5">
                        <div class="flex items-start gap-3">
                            <!-- Decorative: the title beside it describes the post. -->
                            <PostImage
                                v-if="thumbnail(post) !== null"
                                :media="thumbnail(post)!"
                                alt=""
                                variant="thumb"
                            />
                            <div class="min-w-0 flex-1">
                                <div class="font-medium">{{ post.title || t('Untitled draft') }}</div>
                                <div class="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span class="rounded bg-muted px-1.5 py-0.5">{{ sourceLabel(post.source) }}</span>
                                    <span v-if="post.media.length > 0" class="inline-flex items-center gap-1">
                                        <Image class="h-3 w-3" />
                                        {{ post.media.length }}
                                    </span>
                                    <span v-if="failedTargets(post) > 0" class="text-amber-600 dark:text-amber-400">
                                        {{ t('{n} target failed', { n: failedTargets(post) }) }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="px-3 py-2.5">
                        <span class="pill" :class="statusPill(post.status)">{{ statusLabel(post.status) }}</span>
                        <p
                            v-if="awaitingAgent(post)"
                            class="mt-1 text-[10px] leading-snug text-muted-foreground"
                            :data-test="`post-agent-hint-${post.id}`"
                        >
                            {{ t('The agent will publish this.') }}
                        </p>
                    </td>
                    <td class="px-3 py-2.5">
                        <div class="flex flex-wrap gap-1">
                            <span
                                v-for="platform in postPlatforms(post)"
                                :key="platform"
                                class="platform-chip"
                                :data-platform="platform"
                            >
                                {{ platformLabel(platform as Platform) }}
                            </span>
                        </div>
                    </td>
                    <td class="px-3 py-2.5 text-right">
                        <template v-if="measuredTargets(post) > 0">
                            <div
                                class="text-sm font-medium tabular-nums"
                                :data-test="`post-reach-${post.id}`"
                            >
                                {{ formatCounter(postReach(post)) }}
                            </div>
                            <div
                                class="text-[11px] tabular-nums text-muted-foreground"
                                :data-test="`post-rate-${post.id}`"
                            >
                                {{ rateLabel(post) }}
                            </div>
                        </template>
                        <span v-else class="text-xs text-muted-foreground">—</span>
                    </td>
                    <td class="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                        {{ formatWhen(postWhen(post)) }}
                        <div class="text-[10px] opacity-70">{{ post.timezone }}</div>
                    </td>
                </tr>
            </tbody>
        </table>

        <p v-if="posts.length > 0" class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
            {{ t('The reach is summed across the networks a post went to — a rough figure, because each network counts reach its own way.') }}
        </p>
    </div>
</template>
