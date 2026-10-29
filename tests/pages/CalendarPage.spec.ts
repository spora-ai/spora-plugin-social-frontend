import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import CalendarPage from '../../src/pages/CalendarPage.vue'
import { APP_ROUTES } from '../../src/lib/routes'
import { hostContext, mountPage } from '../mountPage'

function makeRouter() {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

describe('CalendarPage', () => {
    it('reads the month for the principal', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/calendar')
        await router.isReady()

        // The page shows the current month, so the post has to be in it.
        const now = new Date()
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

        const get = vi.fn().mockImplementation((path: string) => {
            if (path.includes('/plugins/social/calendar')) {
                return Promise.resolve({
                    posts: [
                        {
                            post_id: 88,
                            title: 'Q4 release',
                            status: 'scheduled',
                            scheduled_for: `${month}-15T09:00:00+00:00`,
                            published_at: null,
                        },
                    ],
                })
            }
            return Promise.resolve({})
        })
        const context = hostContext()
        context.api.get = get as never

        const wrapper = mountPage(CalendarPage, pinia, router, context)
        await flushPromises()

        expect(get).toHaveBeenCalledWith('/plugins/social/calendar', {
            principal_id: 7,
            month: expect.any(String),
        })
        expect(wrapper.find('[data-test="calendar-post-88"]').exists()).toBe(true)
    })

    it('never asks for the fixed slots', async () => {
        const pinia = createPinia()

        const router = makeRouter()
        await router.push('/p/7/calendar')
        await router.isReady()

        const get = vi.fn().mockResolvedValue({ posts: [] })
        const context = hostContext()
        context.api.get = get as never

        mountPage(CalendarPage, pinia, router, context)
        await flushPromises()

        // The static slot was cut, and with it the routes that carried it.
        const paths = get.mock.calls.map((call) => String(call[0]))
        expect(paths.some((path) => path.includes('/plans'))).toBe(false)
        expect(paths.some((path) => path.includes('/schedules'))).toBe(false)
    })
})
