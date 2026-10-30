<script setup lang="ts">
/**
 * The calendar: what goes out when.
 *
 * The grid shows the month's posts on the day they go out. The fixed slots
 * that used to tint the days they fired on are gone with the static slot.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import CalendarGrid from '../components/CalendarGrid.vue'
import { useSocialStore } from '../stores/social'

const route = useRoute()
const social = useSocialStore()

const month = ref(new Date().toISOString().slice(0, 7))

const principalId = computed(() => {
    const raw = route.params.principalId
    const id = Number(raw)
    return Number.isSafeInteger(id) && id > 0 ? id : null
})

const posts = computed(() => social.calendar?.posts ?? [])

onMounted(async () => {
    if (principalId.value === null) return
    await social.loadCalendar(principalId.value, month.value)
})

watch(principalId, async (next, prev) => {
    if (next === null || next === prev) return
    await social.loadCalendar(next, month.value)
})

async function changeMonth(next: string): Promise<void> {
    month.value = next
    if (principalId.value === null) return
    await social.loadCalendar(principalId.value, next)
}
</script>

<template>
    <div data-test="calendar-page">
        <CalendarGrid :month="month" :posts="posts" @month-change="changeMonth" />
    </div>
</template>
