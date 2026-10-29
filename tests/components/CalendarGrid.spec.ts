import { describe, it, expect } from 'vitest'
import CalendarGrid from '../../src/components/CalendarGrid.vue'
import { mountComponent } from '../mountPage'

describe('CalendarGrid', () => {
    it('shows the month’s posts on their day', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            // The backend keys a calendar post by `post_id`.
            posts: [
                {
                    post_id: 88,
                    title: 'Q4 release',
                    status: 'scheduled',
                    scheduled_for: '2026-11-09T09:00:00+00:00',
                    published_at: null,
                },
            ],
            slots: [],
        })

        expect(wrapper.find('[data-test="calendar-post-88"]').exists()).toBe(true)
    })

    it('tints no day — the static slot is gone', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            posts: [],
        })

        // The tint came from the fixed slots' cron; with the slot cut there is
        // nothing to tint, and a leftover tint would claim a recurrence the
        // plugin no longer has.
        expect(wrapper.findAll('[data-recurring="true"]').length).toBe(0)
        expect(wrapper.html()).not.toContain('data-recurring')
    })

    it('says nothing about a tinted day', () => {
        const wrapper = mountComponent(CalendarGrid, { month: '2026-11', posts: [] })

        expect(wrapper.text()).not.toContain('A tinted day')
    })

    it('puts a published post on its published day', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            posts: [
                {
                    post_id: 89,
                    title: 'Studio launch',
                    status: 'published',
                    scheduled_for: null,
                    published_at: '2026-11-16T09:00:00+00:00',
                },
            ],
        })

        expect(wrapper.find('[data-day="2026-11-16"] [data-test="calendar-post-89"]').exists()).toBe(true)
    })
})
