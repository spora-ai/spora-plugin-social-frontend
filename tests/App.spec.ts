import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '../src/App.vue'
import { APP_ROUTES } from '../src/lib/routes'
import { usePrincipalsStore } from '../src/stores/principals'
import { hostContext, mountPage } from './mountPage'

function makeRouter() {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

describe('the rail', () => {
    it('has exactly four tabs, and no Recurring', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/compose')
        await router.isReady()

        const wrapper = mountPage(App, pinia, router, hostContext())
        await flushPromises()

        const tabs = wrapper.findAll('nav a')
        expect(tabs).toHaveLength(4)
        expect(tabs.map((tab) => tab.text())).toEqual([
            'Compose',
            'Calendar',
            'Posts',
            'Accounts',
        ])
        // The static slot was cut, and the tab that showed it with it.
        expect(wrapper.find('[data-test="nav-recurring"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('Recurring')
    })

    it('canonicalises a stale recurring link rather than blanking it', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/recurring')
        await router.isReady()

        mountPage(App, pinia, router, hostContext())
        await flushPromises()

        // The tab is gone, so the link has to land on a real section rather
        // than on an empty screen.
        expect(router.currentRoute.value.path).toBe('/p/7/compose')
        expect(router.currentRoute.value.name).toBe('compose')
    })

    it('leads the backend’s connections link to the accounts screen', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }]
        principals.selectPrincipal(7)

        const router = makeRouter()
        // The OAuth callback redirects the browser here.
        await router.push('/p/7/connections?connected=meta')
        await router.isReady()

        mountPage(App, pinia, router, hostContext())
        await flushPromises()

        // The screen's own address is `/accounts`.
        expect(router.currentRoute.value.path).toBe('/p/7/accounts')
    })

    it('announces the provider the callback connected, and drops the query', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }]
        principals.selectPrincipal(7)

        const router = makeRouter()
        // The OAuth callback redirects the browser here.
        await router.push('/p/7/connections?connected=meta')
        await router.isReady()

        const wrapper = mountPage(App, pinia, router, hostContext())
        await flushPromises()

        expect(wrapper.find('[data-test="connected-notice"]').text()).toBe('Meta is connected.')
        // The query has said what it had to say: a reload must not repeat it.
        expect(router.currentRoute.value.query.connected).toBeUndefined()
    })

    it('announces nothing when the query names no provider', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/connections?connected=facebook')
        await router.isReady()

        const wrapper = mountPage(App, pinia, router, hostContext())
        await flushPromises()

        // A notice about a connection that does not exist is worse than none.
        expect(wrapper.find('[data-test="connected-notice"]').exists()).toBe(false)
    })

    it('announces nothing on a reload, because the query is gone', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const wrapper = mountPage(App, pinia, router, hostContext())
        await flushPromises()

        expect(wrapper.find('[data-test="connected-notice"]').exists()).toBe(false)
    })
})
