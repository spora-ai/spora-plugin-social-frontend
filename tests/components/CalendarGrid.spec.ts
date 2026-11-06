import { describe, it, expect } from 'vitest'
import CalendarGrid from '../../src/components/CalendarGrid.vue'
import { CONFIG_PAYLOAD } from '../recorded'
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
                    channels: [],
                },
            ],
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
        expect(wrapper.findAll('[data-recurring="true"]')).toHaveLength(0)
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
                    channels: [],
                },
            ],
        })

        expect(wrapper.find('[data-day="2026-11-16"] [data-test="calendar-post-89"]').exists()).toBe(true)
    })

    it.each([
        ['the previous month', 'calendar-prev', '2026-11', '2026-10'],
        ['the next month', 'calendar-next', '2026-11', '2026-12'],
        ['the month before January', 'calendar-prev', '2026-01', '2025-12'],
    ])('moves to %s', async (_what, button, month, expected) => {
        const wrapper = mountComponent(CalendarGrid, { month, posts: [] })

        await wrapper.find(`[data-test="${button}"]`).trigger('click')

        expect(wrapper.emitted('month-change')).toEqual([[expected]])
    })
})

describe('CalendarGrid — the channels a post goes to', () => {
    it('draws one chip per channel, with the network and the route', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            config: CONFIG_PAYLOAD,
            posts: [
                {
                    post_id: 88,
                    title: 'Q4 release',
                    status: 'scheduled',
                    scheduled_for: '2026-11-09T09:00:00+00:00',
                    published_at: null,
                    channels: [
                        { key: 'direct:linkedin', network: 'linkedin', via: 'direct' },
                        { key: 'zernio:bluesky', network: 'bluesky', via: 'zernio' },
                    ],
                },
            ],
        })

        // The calendar answers what is going out and where, so the chip says
        // which network and which route to it.
        const linkedin = wrapper.find('[data-test="calendar-channel-direct:linkedin"]')
        expect(linkedin.text()).toContain('LinkedIn')
        expect(linkedin.text()).toContain('Direct')

        const bluesky = wrapper.find('[data-test="calendar-channel-zernio:bluesky"]')
        expect(bluesky.text()).toContain('Bluesky')
        expect(bluesky.text()).toContain('Zernio')
    })

    it('draws one chip for two accounts on one channel', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            config: CONFIG_PAYLOAD,
            posts: [
                {
                    post_id: 88,
                    title: 'Q4 release',
                    status: 'scheduled',
                    scheduled_for: '2026-11-09T09:00:00+00:00',
                    published_at: null,
                    // The backend sends one entry per target, and a target is
                    // an account: two accounts on one channel are one
                    // channel.
                    channels: [
                        { key: 'direct:linkedin', network: 'linkedin', via: 'direct' },
                        { key: 'direct:linkedin', network: 'linkedin', via: 'direct' },
                    ],
                },
            ],
        })

        expect(wrapper.findAll('[data-test="calendar-channel-direct:linkedin"]')).toHaveLength(1)
    })

    it('draws two chips for two routes to one network', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            config: CONFIG_PAYLOAD,
            posts: [
                {
                    post_id: 88,
                    title: 'Q4 release',
                    status: 'scheduled',
                    scheduled_for: '2026-11-09T09:00:00+00:00',
                    published_at: null,
                    channels: [
                        { key: 'direct:linkedin', network: 'linkedin', via: 'direct' },
                        { key: 'zernio:linkedin', network: 'linkedin', via: 'zernio' },
                    ],
                },
            ],
        })

        // One chip for the plugin's own route and one for the aggregator's —
        // the same network, reached twice.
        expect(wrapper.findAll('[data-test^="calendar-channel-"]')).toHaveLength(2)
    })

    it('draws no chip for a post with no channel', () => {
        const wrapper = mountComponent(CalendarGrid, {
            month: '2026-11',
            config: CONFIG_PAYLOAD,
            posts: [
                {
                    post_id: 88,
                    title: 'Q4 release',
                    status: 'draft',
                    scheduled_for: '2026-11-09T09:00:00+00:00',
                    published_at: null,
                    channels: [],
                },
            ],
        })

        expect(wrapper.findAll('[data-test^="calendar-channel-"]')).toHaveLength(0)
    })
})
