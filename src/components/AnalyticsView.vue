<script setup lang="ts">
/**
 * The analytics view: the counters, the reach-per-day chart, the per-network
 * table and the top posts.
 *
 * Two decisions in here:
 *
 *  - **The networks are kept apart.** Each counts reach its own way, so the
 *    rows stay separate and the summed figure is labelled a rough one — a
 *    combined "total reach" across three networks is not a fact. The caveat
 *    is written under the table, where the numbers are.
 *  - **The chart series are not the platform brand hues.** LinkedIn's and
 *    Facebook's blues are too close to tell apart in a stacked bar, so the
 *    series carry their own colours — and the legend swatches use those too,
 *    because a legend that does not match the bar it labels is worse than no
 *    legend.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { chartColorVar, platformLabel } from '../lib/platforms'
import { formatCounter } from '../lib/metrics'
import { NO_VALUE } from '../lib/format'
import type { AnalyticsPoint, AnalyticsSummary, NetworkTotals, Platform } from '../types'

const props = defineProps<{
    summary: AnalyticsSummary | null
}>()

const { t } = useI18n()

const networks = computed<NetworkTotals[]>(() => props.summary?.by_network ?? [])

const series = computed(() => props.summary?.series ?? [])

const topPosts = computed(() => props.summary?.top_posts ?? [])

/**
 * The reach a network reported that day.
 *
 * An absent key means that network reported nothing — it is not a zero, but
 * for the height of a bar the two are the same amount of nothing.
 */
function dayReach(day: AnalyticsPoint, platform: Platform): number {
    return day[platform] ?? 0
}

/** The day's reach across the networks that reported one. */
function dayTotal(day: AnalyticsPoint): number {
    return dayReach(day, 'linkedin') + dayReach(day, 'facebook') + dayReach(day, 'instagram')
}

/** The tallest day in the series — the chart's scale. */
const peak = computed(() => series.value.reduce((max, day) => Math.max(max, dayTotal(day)), 0))

/**
 * The reach summed over the networks that reported one.
 *
 * Null when no network reported a reach: there is nothing to sum, and a zero
 * would say the post reached nobody.
 */
const summedReach = computed<number | null>(() => {
    const reported = networks.value
        .map((network) => network.reach)
        .filter((reach): reach is number => reach !== null)

    return reported.length === 0
        ? null
        : reported.reduce((sum, reach) => sum + reach, 0)
})

const summedEngagements = computed(() =>
    networks.value.reduce(
        (sum, network) =>
            sum +
            (network.likes ?? 0) +
            (network.comments ?? 0) +
            (network.shares ?? 0) +
            (network.saves ?? 0),
        0,
    ),
)

/** The network with the most reach, among the ones that reported any. */
const bestNetwork = computed<NetworkTotals | null>(() => {
    const reporting = networks.value.filter((network) => network.reach !== null)
    if (reporting.length === 0) return null
    return reporting.reduce((best, network) =>
        (network.reach ?? 0) > (best.reach ?? 0) ? network : best,
    )
})

const publishedPosts = computed(
    () => networks.value.reduce((sum, network) => sum + network.posts, 0),
)

/**
 * The rate, or null when there is no rate to state.
 *
 * A network that reported no reach has no rate, and a reach of zero is 0/0 —
 * which is not a rate either.
 */
function rate(network: NetworkTotals): number | null {
    if (network.reach === null || network.reach === 0) return null
    return (
        (network.likes ?? 0) +
        (network.comments ?? 0) +
        (network.shares ?? 0) +
        (network.saves ?? 0)
    ) / network.reach
}

/** The share of a day's reach that one network holds — the stack's segments. */
function share(day: AnalyticsPoint, platform: Platform): number {
    const total = dayTotal(day)
    if (total <= 0) return 0
    return (dayReach(day, platform) / total) * 100
}

function height(day: AnalyticsPoint): number {
    const total = dayTotal(day)
    if (peak.value <= 0) return 0
    return (total / peak.value) * 100
}
</script>

<template>
    <div class="space-y-5" data-test="analytics-view">
        <p v-if="summary === null" class="surface-card px-6 py-10 text-center text-sm font-medium">
            {{ t('No numbers yet — the platforms report them a while after publishing.') }}
        </p>

        <template v-else>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="surface-card p-3.5" data-test="kpi-reach">
                    <div class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ t('Reach') }}</div>
                    <div class="mt-1 text-xl font-semibold tabular-nums" data-test="kpi-reach-value">
                        {{ formatCounter(summedReach) }}
                    </div>
                    <div class="mt-0.5 text-[11px] text-muted-foreground">
                        {{ t('summed across networks — a rough figure') }}
                    </div>
                </div>
                <div class="surface-card p-3.5" data-test="kpi-engagements">
                    <div class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ t('Engagements') }}</div>
                    <div class="mt-1 text-xl font-semibold tabular-nums">{{ summedEngagements.toLocaleString() }}</div>
                    <div class="mt-0.5 text-[11px] text-muted-foreground">
                        <template v-if="summedReach === null">{{ NO_VALUE }}</template>
                        <template v-else>
                            {{ t('{n}% of the summed reach', { n: summedReach > 0 ? ((summedEngagements / summedReach) * 100).toFixed(1) : '0.0' }) }}
                        </template>
                    </div>
                </div>
                <div class="surface-card p-3.5" data-test="kpi-posts">
                    <div class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ t('Posts published') }}</div>
                    <div class="mt-1 text-xl font-semibold tabular-nums">{{ publishedPosts }}</div>
                    <div class="mt-0.5 text-[11px] text-muted-foreground">{{ t('with numbers on at least one network') }}</div>
                </div>
                <div class="surface-card p-3.5" data-test="kpi-best-network">
                    <div class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ t('Best network') }}</div>
                    <div class="mt-1 text-xl font-semibold">
                        {{ bestNetwork === null ? '—' : platformLabel(bestNetwork.platform) }}
                    </div>
                    <div class="mt-0.5 text-[11px] text-muted-foreground">{{ t('by reach') }}</div>
                </div>
            </div>

            <div class="surface-card p-4" data-test="reach-chart">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-sm font-semibold">{{ t('Reach per day') }}</h2>
                        <p class="text-xs text-muted-foreground">{{ t('Stacked by network, last 30 days.') }}</p>
                    </div>
                    <div class="flex items-center gap-2" data-test="chart-legend">
                        <span
                            v-for="network in networks"
                            :key="network.platform"
                            class="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                            :data-test="`legend-${network.platform}`"
                        >
                            <span
                                class="h-2.5 w-2.5 rounded-sm"
                                :style="{ background: `hsl(${chartColorVar(network.platform)})` }"
                            />
                            {{ platformLabel(network.platform) }}
                        </span>
                    </div>
                </div>

                <div class="mt-4 flex h-40 items-end gap-[3px]">
                    <div
                        v-for="day in series"
                        :key="day.date"
                        class="group relative flex h-full flex-1 flex-col justify-end overflow-hidden rounded-sm"
                        :title="`${day.date} · ${dayTotal(day).toLocaleString()} reach`"
                        :data-test="`chart-day-${day.date}`"
                    >
                        <div class="flex flex-col justify-end" :style="{ height: `${height(day)}%` }">
                            <span
                                v-for="platform in (['linkedin', 'facebook', 'instagram'] as Platform[])"
                                :key="platform"
                                class="block w-full"
                                :style="{
                                    height: `${share(day, platform)}%`,
                                    background: `hsl(${chartColorVar(platform)})`,
                                }"
                            />
                        </div>
                    </div>
                </div>

                <div class="mt-2 flex justify-between text-[10px] text-muted-foreground">
                    <span>{{ series.length > 0 ? series[0]?.date : '' }}</span>
                    <span>{{ t('peak {n} · {date}', { n: peak.toLocaleString(), date: series.length > 0 ? series[series.length - 1]?.date : '' }) }}</span>
                </div>
            </div>

            <div class="surface-card overflow-hidden" data-test="network-table">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-border bg-muted/40 text-left">
                            <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Network') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Reach') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Impressions') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Engagements') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Rate') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="network in networks"
                            :key="network.platform"
                            class="border-b border-border last:border-b-0"
                            :data-test="`network-row-${network.platform}`"
                        >
                            <td class="px-3 py-2.5">
                                <span class="platform-chip" :data-platform="network.platform">
                                    {{ platformLabel(network.platform) }}
                                </span>
                            </td>
                            <td
                                class="px-3 py-2.5 text-right tabular-nums"
                                :data-test="`network-reach-${network.platform}`"
                            >
                                {{ formatCounter(network.reach) }}
                            </td>
                            <td
                                class="px-3 py-2.5 text-right tabular-nums"
                                :data-test="`network-impressions-${network.platform}`"
                            >
                                {{ formatCounter(network.impressions) }}
                            </td>
                            <td class="px-3 py-2.5 text-right tabular-nums">
                                {{ ((network.likes ?? 0) + (network.comments ?? 0) + (network.shares ?? 0) + (network.saves ?? 0)).toLocaleString() }}
                            </td>
                            <td class="px-3 py-2.5 text-right tabular-nums">
                                {{ rate(network) === null ? NO_VALUE : `${(rate(network)! * 100).toFixed(1)}%` }}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground" data-test="network-caveat">
                    {{ t('The rows are kept apart, because each network counts reach its own way — LinkedIn’s share statistics only exist for organisation pages, and Instagram’s impressions are not Facebook’s impressions. The totals above sum them anyway, which makes them a rough figure rather than a comparable one.') }}
                </p>

                <ul v-if="summary.notes.length > 0" class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground" data-test="analytics-notes">
                    <li v-for="note in summary.notes" :key="note">{{ note }}</li>
                </ul>
            </div>

            <div v-if="topPosts.length > 0">
                <h2 class="mb-3 text-sm font-semibold">{{ t('Top posts') }}</h2>
                <div class="surface-card overflow-hidden">
                    <table class="w-full text-sm">
                        <tbody>
                            <tr
                                v-for="post in topPosts"
                                :key="post.post_id"
                                class="border-b border-border last:border-b-0 transition-colors hover:bg-muted/30"
                            >
                                <td class="px-3 py-2.5">
                                    <div class="font-medium">{{ post.title }}</div>
                                    <div class="mt-0.5 text-[11px] text-muted-foreground">
                                        {{ platformLabel(post.platform) }}
                                    </div>
                                </td>
                                <td
                                    class="px-3 py-2.5 text-right tabular-nums"
                                    :data-test="`top-post-reach-${post.post_id}`"
                                >
                                    {{ formatCounter(post.reach) }}
                                </td>
                                <td class="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                                    {{ formatCounter(post.likes) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </template>
    </div>
</template>
