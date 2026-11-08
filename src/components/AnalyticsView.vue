<script setup lang="ts">
/**
 * The analytics view: the counters, the reach-per-day chart, the per-channel
 * table and the top posts.
 *
 * Three decisions in here:
 *
 *  - **The channels are kept apart.** Each network counts reach its own
 *    way, so the rows stay separate and the summed figure is labelled a
 *    rough one — a combined "total reach" across three networks is not a
 *    fact. The caveat is written under the table, where the numbers are.
 *  - **A row is a channel, not a network.** The same network reached
 *    through two routes is two accounts with two sets of numbers, so it is
 *    two rows — and the route is named on every row, because a row that
 *    says only "linkedin" says nothing about which of the two it is.
 *  - **The chart series are not the platform brand hues.** LinkedIn's and
 *    Facebook's blues are too close to tell apart in a stacked bar, so the
 *    series carry their own colours — and the legend swatches use those too,
 *    because a legend that does not match the bar it labels is worse than no
 *    legend.
 *  - **A post that went to two places is one post.** The backend's rows are
 *    one per target, so the top posts table names the post once and gives
 *    each place it reached a row of its own, with that place's numbers.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    brandColorVar,
    chartColorVar,
    channelFromKey,
    channelOf,
    networkLabel,
    routeLabel,
} from '../lib/platforms'
import { formatCounter, topPostGroups } from '../lib/metrics'
import { NO_VALUE } from '../lib/format'
import type { AnalyticsPoint, AnalyticsSummary, Channel, NetworkTotals, SocialConfig } from '../types'

const props = defineProps<{
    summary: AnalyticsSummary | null
    /** The plugin's configuration — it carries the networks' names. */
    config: SocialConfig | null
}>()

const { t } = useI18n()

/** The rows — one per channel, so two routes to one network are two rows. */
const rows = computed<NetworkTotals[]>(() => props.summary?.by_network ?? [])

const series = computed(() => props.summary?.series ?? [])

/**
 * The top posts, grouped by the post they belong to.
 *
 * The backend's rows are one per target, so a post that went to two places
 * arrives twice — and the two rows are one post going to two places, not
 * two posts. The group is what says so.
 */
const topPosts = computed(() => topPostGroups(props.summary?.top_posts ?? []))

const rules = computed(() => props.config?.rules ?? {})

const aggregators = computed(() => props.config?.aggregators ?? {})

/**
 * The channel a row is about.
 *
 * The row's own fields, so the route is the one the backend sent and not
 * one read back out of the key.
 */
function channelOfRow(row: NetworkTotals): Channel {
    return channelOf(row.via, row.platform)
}

/**
 * The channels the chart stacks.
 *
 * The series is keyed by the channel's key, and the days carry whichever
 * channels reported that day — so the stack follows the data rather than a
 * fixed list of networks, which the aggregator's fifteen would outgrow.
 */
const seriesChannels = computed<string[]>(() => {
    const keys = new Set<string>()

    for (const day of series.value) {
        for (const key of Object.keys(day)) {
            if (key !== 'date') keys.add(key)
        }
    }

    return [...keys]
})

/**
 * The reach a channel reported that day.
 *
 * An absent key means that channel reported nothing — it is not a zero, but
 * for the height of a bar the two are the same amount of nothing.
 */
function dayReach(day: AnalyticsPoint, channel: string): number {
    const reach = day[channel]
    return typeof reach === 'number' ? reach : 0
}

/** The day's reach across the channels that reported one. */
function dayTotal(day: AnalyticsPoint): number {
    return seriesChannels.value.reduce((sum, channel) => sum + dayReach(day, channel), 0)
}

/** The tallest day in the series — the chart's scale. */
const peak = computed(() => series.value.reduce((max, day) => Math.max(max, dayTotal(day)), 0))

/**
 * The reach summed over the channels that reported one.
 *
 * Null when no channel reported a reach: there is nothing to sum, and a zero
 * would say the post reached nobody.
 */
const summedReach = computed<number | null>(() => {
    const reported = rows.value
        .map((row) => row.reach)
        .filter((reach): reach is number => reach !== null)

    return reported.length === 0
        ? null
        : reported.reduce((sum, reach) => sum + reach, 0)
})

const summedEngagements = computed(() =>
    rows.value.reduce(
        (sum, row) =>
            sum +
            (row.likes ?? 0) +
            (row.comments ?? 0) +
            (row.shares ?? 0) +
            (row.saves ?? 0),
        0,
    ),
)

/** The channel with the most reach, among the ones that reported any. */
const bestRow = computed<NetworkTotals | null>(() => {
    const reporting = rows.value.filter((row) => row.reach !== null)
    const first = reporting[0]
    if (first === undefined) return null
    return reporting.reduce(
        (best, row) => ((row.reach ?? 0) > (best.reach ?? 0) ? row : best),
        first,
    )
})

const publishedPosts = computed(() => rows.value.reduce((sum, row) => sum + row.posts, 0))

/**
 * The rate, or null when there is no rate to state.
 *
 * A channel that reported no reach has no rate, and a reach of zero is 0/0 —
 * which is not a rate either.
 */
function rate(row: NetworkTotals): number | null {
    if (row.reach === null || row.reach === 0) return null
    return (
        (row.likes ?? 0) +
        (row.comments ?? 0) +
        (row.shares ?? 0) +
        (row.saves ?? 0)
    ) / row.reach
}

/** The share of a day's reach that one channel holds — the stack's segments. */
function share(day: AnalyticsPoint, channel: string): number {
    const total = dayTotal(day)
    if (total <= 0) return 0
    return (dayReach(day, channel) / total) * 100
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
                <div class="surface-card p-3.5" data-test="kpi-best-channel">
                    <div class="text-[11px] uppercase tracking-wide text-muted-foreground">{{ t('Best channel') }}</div>
                    <div class="mt-1 flex items-baseline gap-2">
                        <span class="text-xl font-semibold">
                            {{ bestRow === null ? '—' : networkLabel(bestRow.platform, rules) }}
                        </span>
                        <span
                            v-if="bestRow !== null"
                            class="text-[11px] text-muted-foreground"
                            data-test="kpi-best-route"
                        >
                            {{ routeLabel(bestRow.via, aggregators) }}
                        </span>
                    </div>
                    <div class="mt-0.5 text-[11px] text-muted-foreground">{{ t('by reach') }}</div>
                </div>
            </div>
            <div class="surface-card p-4" data-test="reach-chart">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 class="text-sm font-semibold">{{ t('Reach per day') }}</h2>
                        <p class="text-xs text-muted-foreground">{{ t('Stacked by channel, last 30 days.') }}</p>
                    </div>
                    <div class="flex items-center gap-2" data-test="chart-legend">
                        <span
                            v-for="row in rows"
                            :key="row.channel"
                            class="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                            :data-test="`legend-${row.channel}`"
                        >
                            <span
                                class="h-2.5 w-2.5 rounded-sm"
                                :style="{ background: chartColorVar(channelOfRow(row)) }"
                            />
                            {{ networkLabel(row.platform, rules) }}
                            <span class="opacity-70">{{ routeLabel(row.via, aggregators) }}</span>
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
                                v-for="channel in seriesChannels"
                                :key="channel"
                                class="block w-full"
                                :style="{
                                    height: `${share(day, channel)}%`,
                                    background: chartColorVar(channelFromKey(channel)),
                                }"
                                :data-test="`chart-segment-${channel}`"
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
                            <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Channel') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Reach') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Impressions') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Engagements') }}</th>
                            <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Rate') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="row in rows"
                            :key="row.channel"
                            class="border-b border-border last:border-b-0"
                            :data-test="`network-row-${row.channel}`"
                        >
                            <td class="px-3 py-2.5">
                                <span class="inline-flex items-center gap-1">
                                    <span
                                        class="platform-chip"
                                        :data-network="row.platform"
                                        :style="{ '--network-color': brandColorVar(row.platform) }"
                                    >
                                        {{ networkLabel(row.platform, rules) }}
                                    </span>
                                    <span
                                        class="text-[10px] text-muted-foreground"
                                        :data-test="`network-route-${row.channel}`"
                                    >
                                        {{ routeLabel(row.via, aggregators) }}
                                    </span>
                                </span>
                            </td>
                            <td
                                class="px-3 py-2.5 text-right tabular-nums"
                                :data-test="`network-reach-${row.channel}`"
                            >
                                {{ formatCounter(row.reach) }}
                            </td>
                            <td
                                class="px-3 py-2.5 text-right tabular-nums"
                                :data-test="`network-impressions-${row.channel}`"
                            >
                                {{ formatCounter(row.impressions) }}
                            </td>
                            <td class="px-3 py-2.5 text-right tabular-nums">
                                {{ ((row.likes ?? 0) + (row.comments ?? 0) + (row.shares ?? 0) + (row.saves ?? 0)).toLocaleString() }}
                            </td>
                            <td class="px-3 py-2.5 text-right tabular-nums">
                                {{ rate(row) === null ? NO_VALUE : `${(rate(row)! * 100).toFixed(1)}%` }}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <p class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground" data-test="network-caveat">
                    {{ t('The rows are kept apart, because each network counts reach its own way — LinkedIn’s share statistics only exist for organisation pages, and Instagram’s impressions are not Facebook’s impressions. The same network on two routes is two rows, with two sets of numbers. The totals above sum them anyway, which makes them a rough figure rather than a comparable one.') }}
                </p>

                <ul v-if="summary.notes.length > 0" class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground" data-test="analytics-notes">
                    <li v-for="note in summary.notes" :key="note">{{ note }}</li>
                </ul>
            </div>

            <div v-if="topPosts.length > 0">
                <h2 class="mb-3 text-sm font-semibold">{{ t('Top posts') }}</h2>
                <div class="surface-card overflow-hidden">
                    <table class="w-full text-sm" data-test="top-posts-table">
                        <thead>
                            <tr class="border-b border-border bg-muted/40 text-left">
                                <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Post') }}</th>
                                <th class="px-3 py-2 font-medium text-muted-foreground">{{ t('Channel') }}</th>
                                <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Reach') }}</th>
                                <th class="px-3 py-2 text-right font-medium text-muted-foreground">{{ t('Likes') }}</th>
                            </tr>
                        </thead>
                        <!--
                            One tbody per post: the title spans the post's rows,
                            so a post that reached two places reads as one post
                            and the rows under the title are the places.
                        -->
                        <tbody
                            v-for="group in topPosts"
                            :key="group.key"
                            class="border-b border-border last:border-b-0"
                        >
                            <tr
                                v-for="(row, index) in group.rows"
                                :key="row.key"
                                class="transition-colors hover:bg-muted/30"
                                :data-test="`top-post-${row.key}`"
                            >
                                <td
                                    v-if="index === 0"
                                    :rowspan="group.rows.length"
                                    class="px-3 py-2.5 align-top font-medium"
                                    :data-test="`top-post-title-${group.post_id}`"
                                >
                                    {{ group.title }}
                                </td>
                                <td class="px-3 py-2.5 align-top">
                                    <span class="inline-flex items-center gap-1">
                                        <span
                                            class="platform-chip"
                                            :data-network="row.platform"
                                            :style="{ '--network-color': brandColorVar(row.platform) }"
                                        >
                                            {{ networkLabel(row.platform, rules) }}
                                        </span>
                                        <span
                                            class="text-[10px] text-muted-foreground"
                                            :data-test="`top-post-route-${row.key}`"
                                        >
                                            {{ routeLabel(row.via, aggregators) }}
                                        </span>
                                    </span>
                                </td>
                                <td
                                    class="px-3 py-2.5 text-right align-top tabular-nums"
                                    :data-test="`top-post-reach-${row.key}`"
                                >
                                    {{ formatCounter(row.reach) }}
                                </td>
                                <td class="px-3 py-2.5 text-right align-top tabular-nums text-muted-foreground">
                                    {{ formatCounter(row.likes) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <p class="border-t border-border px-3 py-2 text-[11px] text-muted-foreground" data-test="top-post-caveat">
                        {{ t('The backend sends one row per target, so a post that reached two places is one post with a row for each place — the numbers are each place’s own.') }}
                    </p>
                </div>
            </div>
        </template>
    </div>
</template>
