/**
 * The shell's messages.
 *
 * The store's `notice` was raised by the connect flow and by the composer and
 * **nothing rendered it** — the operator pressed "Connect" on a platform that
 * is not set up on this instance, and the app said nothing at all. The store
 * carried the reason; the screen did not show it.
 */
import { describe, it, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../src/App.vue'
import { useSocialStore } from '../src/stores/social'
import { HOST_CONTEXT_KEY } from '../src/shims'
import { hostContext, stubRoutes } from './mountPage'

function mountShell(pinia: ReturnType<typeof createPinia>) {
    const context = hostContext()
    return mount(App, {
        props: { hostContext: context },
        global: {
            plugins: [pinia, stubRoutes()],
            provide: { [HOST_CONTEXT_KEY as symbol]: context },
        },
    })
}

describe('the app shell', () => {
    it('shows the notice the store carries', async () => {
        const pinia = createPinia()
        const social = useSocialStore(pinia)
        social.setNotice('That platform is not configured on this instance yet.')

        const wrapper = mountShell(pinia)
        await flushPromises()

        expect(wrapper.find('[data-test="app-notice"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="app-notice"]').text()).toContain('not configured')
    })

    it('shows no notice when there is none', async () => {
        const pinia = createPinia()

        const wrapper = mountShell(pinia)
        await flushPromises()

        expect(wrapper.find('[data-test="app-notice"]').exists()).toBe(false)
    })
})
