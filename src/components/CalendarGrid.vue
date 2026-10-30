<script setup lang="ts">
/**
 * The month grid.
 *
 * **The grid shows the posts and nothing else.** A fixed slot used to tint
 * the days its cron fired on — but the static slot was cut: it posted the
 * same words every week, its template only knew date and time variables, and
 * LinkedIn and Meta ship native scheduled posts anyway. What remains is what
 * is actually going out, on the day it goes out.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatWhen } from '../lib/format'
import type { CalendarPost } from '../types'

const props = defineProps<{
    /** `YYYY-MM`. */
    month: string
    posts: CalendarPost[]
}>()

const emit = defineEmits<{
    'month-change': [month: string]
}>()

const { t } = useI18n()

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${date.getFullYear()}-${month}-${day}`
}

/** The first day of the month, at local midnight. */
const first = computed(() => {
    const [year, month] = props.month.split('-').map(Number)
    return new Date(year ?? 1970, (month ?? 1) - 1, 1)
})

const cells = computed(() => {
    const start = first.value
    const year = start.getFullYear()
    const month = start.getMonth()
    // Monday-first: the grid starts on Monday, so the offset is the first
    // day's weekday shifted by one.
    const startOffset = (start.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const count = Math.ceil((startOffset + daysInMonth) / 7) * 7

    const today = dateKey(new Date())

    const result: {
        key: string
        day: number
        outside: boolean
        today: boolean
        posts: CalendarPost[]
    }[] = []

    for (let index = 0; index < count; index += 1) {
        const dayNumber = index - startOffset + 1
        const date = new Date(year, month, dayNumber)
        const key = dateKey(date)

        result.push({
            key,
            day: date.getDate(),
            outside: dayNumber < 1 || dayNumber > daysInMonth,
            today: key === today,
            posts: props.posts.filter((post) => {
                const when = post.scheduled_for ?? post.published_at
                return when !== null && when !== undefined && when.slice(0, 10) === key
            }),
        })
    }

    return result
})

const monthLabel = computed(() =>
    first.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
)

function shiftMonth(delta: number): void {
    const date = new Date(first.value.getFullYear(), first.value.getMonth() + delta, 1)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    emit('month-change', `${date.getFullYear()}-${month}`)
}
</script>

<template>
    <div class="surface-card overflow-hidden" data-test="calendar-grid">
        <div class="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
                <h2 class="text-sm font-semibold">{{ monthLabel }}</h2>
            </div>
            <div class="flex items-center gap-1">
                <button
                    type="button"
                    class="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                    data-test="calendar-prev"
                    @click="shiftMonth(-1)"
                >
                    {{ t('Previous month') }}
                </button>
                <button
                    type="button"
                    class="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                    data-test="calendar-next"
                    @click="shiftMonth(1)"
                >
                    {{ t('Next month') }}
                </button>
            </div>
        </div>

        <div class="grid grid-cols-7 border-b border-border bg-muted/40">
            <div
                v-for="weekday in WEEKDAYS"
                :key="weekday"
                class="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
                {{ weekday }}
            </div>
        </div>

        <div class="cal-grid">
            <div
                v-for="cell in cells"
                :key="cell.key"
                class="cal-cell"
                :data-day="cell.key"
                :data-outside="cell.outside"
                :data-today="cell.today"
            >
                <div class="flex items-center justify-between">
                    <span
                        class="text-[11px] font-semibold tabular-nums"
                        :class="cell.outside ? 'text-muted-foreground/50' : 'text-muted-foreground'"
                    >
                        {{ cell.day }}
                    </span>
                    <span v-if="cell.posts.length > 0" class="text-[10px] tabular-nums text-muted-foreground">
                        {{ cell.posts.length }}
                    </span>
                </div>

                <div
                    v-for="post in cell.posts"
                    :key="post.post_id"
                    class="pill pill-scheduled w-full justify-start gap-1 truncate text-left"
                    :data-test="`calendar-post-${post.post_id}`"
                >
                    <span class="truncate">{{ post.title }}</span>
                </div>

                <span v-if="cell.posts.length > 0" class="text-[10px] text-muted-foreground">
                    {{ formatWhen(cell.posts[0]?.scheduled_for ?? cell.posts[0]?.published_at ?? null) }}
                </span>
            </div>
        </div>
    </div>
</template>
