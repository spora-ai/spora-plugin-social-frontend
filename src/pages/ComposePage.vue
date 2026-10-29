<script setup lang="ts">
/**
 * The composer page — the landing screen, because writing is the plugin's
 * primary verb.
 *
 * The rail below the composer answers two questions without leaving the page:
 * what is already queued, and what needs a human.
 */
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import ComposerPanel from '../components/ComposerPanel.vue'
import { useSocialStore } from '../stores/social'
import { formatWhen } from '../lib/format'
import { needsAttention, providerLabel } from '../lib/providers'
import { postPath } from '../lib/paths'
import type { Platform } from '../types'

const { t } = useI18n()
const route = useRoute()
const social = useSocialStore()

const principalId = computed(() => {
    const raw = route.params.principalId
    const id = Number(raw)
    return Number.isSafeInteger(id) && id > 0 ? id : null
})

/** The next scheduled posts — the queue the operator can see without a detour. */
const upNext = computed(() =>
    social.posts
        .filter((post) => post.status === 'scheduled' && post.scheduled_for !== null)
        .sort((a, b) => (a.scheduled_for ?? '').localeCompare(b.scheduled_for ?? ''))
        .slice(0, 4),
)

/** The connections whose token needs a human. */
const attention = computed(() => social.connections.filter((connection) => needsAttention(connection)))

onMounted(async () => {
    if (principalId.value === null) return
    await social.loadPosts(principalId.value)
})

watch(principalId, async (next, prev) => {
    if (next === null || next === prev) return
    await social.loadPosts(next)
})
</script>

<template>
    <div class="space-y-5" data-test="compose-page">
        <ComposerPanel v-if="principalId !== null" :principal-id="principalId" />

        <div class="grid gap-4 lg:grid-cols-2">
            <section class="surface-card p-4">
                <div class="flex items-center justify-between gap-3">
                    <h2 class="text-sm font-semibold">{{ t('Up next') }}</h2>
                </div>
                <div class="mt-3 space-y-2">
                    <p v-if="upNext.length === 0" class="text-sm text-muted-foreground">{{ t('Nothing scheduled.') }}</p>
                    <template v-for="post in upNext" :key="post.id">
                        <RouterLink
                            v-if="principalId !== null"
                            :to="postPath(principalId, post.id)"
                            class="block w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-muted/50"
                            :data-test="`up-next-${post.id}`"
                        >
                            <div class="flex flex-wrap items-center gap-1">
                                <span
                                    v-for="platform in post.targets.map((target) => target.platform).filter((value, index, all) => all.indexOf(value) === index)"
                                    :key="platform"
                                    class="platform-chip"
                                    :data-platform="platform as Platform"
                                >
                                    {{ platform }}
                                </span>
                            </div>
                            <div class="mt-1.5 truncate text-sm font-medium">{{ post.title }}</div>
                            <div class="mt-0.5 text-[11px] text-muted-foreground">{{ formatWhen(post.scheduled_for) }}</div>
                        </RouterLink>
                    </template>
                </div>
            </section>

            <section class="surface-card p-4">
                <div class="flex items-center justify-between gap-3">
                    <h2 class="text-sm font-semibold">{{ t('Needs attention') }}</h2>
                </div>
                <div class="mt-3 space-y-2">
                    <p v-if="attention.length === 0" class="text-sm text-muted-foreground">
                        {{ t('Every connection has a healthy token.') }}
                    </p>
                    <div
                        v-for="connection in attention"
                        :key="connection.id"
                        class="rounded-lg border border-border p-3"
                        :data-test="`attention-${connection.id}`"
                    >
                        <div class="flex items-center gap-2">
                            <span class="min-w-0 flex-1 truncate text-sm font-medium">
                                {{ providerLabel(connection.provider) }}
                            </span>
                            <span class="pill pill-expiring">
                                <RefreshCw class="h-3 w-3" />
                                {{ t('Reconnect') }}
                            </span>
                        </div>
                        <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                            {{ t('This connection will not publish until it is renewed.') }}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>
