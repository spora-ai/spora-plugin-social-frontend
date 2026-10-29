import { describe, it, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { useConnectedNotice } from '../../src/composables/useConnectedNotice'

async function mountNotice(path: string): Promise<{ notice: () => string | null; router: Router }> {
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:pathMatch(.*)*', name: 'any', component: { template: '<div />' } }],
    })
    await router.push(path)
    await router.isReady()

    const wrapper = mount(
        {
            setup() {
                const { notice, announce } = useConnectedNotice()
                void announce()
                return { notice }
            },
            template: '<div />',
        },
        { global: { plugins: [router] } },
    )
    await flushPromises()

    return { notice: () => wrapper.vm.notice, router }
}

describe('useConnectedNotice', () => {
    it('announces the provider the callback connected', async () => {
        const { notice } = await mountNotice('/p/7/accounts?connected=meta')

        expect(notice()).toBe('Meta is connected.')
    })

    it('drops the query it has read', async () => {
        const { router } = await mountNotice('/p/7/accounts?connected=meta')

        // The query has said what it had to say: a reload must not repeat it.
        expect(router.currentRoute.value.query.connected).toBeUndefined()
    })

    it('keeps the other query keys', async () => {
        const { router } = await mountNotice('/p/7/accounts?connected=meta&ref=host')

        expect(router.currentRoute.value.query.ref).toBe('host')
    })

    it('says nothing for a provider this app does not know', async () => {
        // A notice about a connection that does not exist is worse than none.
        const { notice } = await mountNotice('/p/7/accounts?connected=facebook')

        expect(notice()).toBeNull()
    })

    it('says nothing when there is no query at all', async () => {
        const { notice } = await mountNotice('/p/7/accounts')

        expect(notice()).toBeNull()
    })
})
