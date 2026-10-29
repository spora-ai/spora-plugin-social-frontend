import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import PrincipalSwitcher from '../../src/components/PrincipalSwitcher.vue'
import { APP_ROUTES } from '../../src/lib/routes'
import { usePrincipalsStore } from '../../src/stores/principals'
import { makePrincipal } from '../fixtures'
import { mountPage, recordNavigation } from '../mountPage'

function makeRouter() {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

beforeEach(() => {
    setActivePinia(createPinia())
})

describe('PrincipalSwitcher', () => {
    it('is labelled "Working as"', () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [makePrincipal()]
        principals.selectPrincipal(7)

        const wrapper = mountPage(PrincipalSwitcher, pinia, makeRouter())
        expect(wrapper.text()).toContain('Working as')
    })

    it('lists the principals the caller can act as', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [
            makePrincipal({ id: 7, name: 'Maya Fischer' }),
            makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
        ]
        principals.selectPrincipal(7)

        const wrapper = mountPage(PrincipalSwitcher, pinia, makeRouter())
        await wrapper.find('[data-test="principal-trigger"]').trigger('click')

        expect(wrapper.find('[data-test="principal-option-7"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="principal-option-8"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Studio')
    })

    it('says that reading is not writing', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [makePrincipal()]
        principals.selectPrincipal(7)

        const wrapper = mountPage(PrincipalSwitcher, pinia, makeRouter())
        await wrapper.find('[data-test="principal-trigger"]').trigger('click')

        expect(wrapper.text()).toContain('You can read every group you belong to')
    })

    it('re-scopes the app: choosing a principal rewrites the path', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [
            makePrincipal({ id: 7 }),
            makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
        ]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PrincipalSwitcher, pinia, router)
        await wrapper.find('[data-test="principal-trigger"]').trigger('click')
        await wrapper.find('[data-test="principal-option-8"]').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/p/8/posts')
    })

    it('replaces the URL rather than pushing it — a context change is not a place', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [
            makePrincipal({ id: 7 }),
            makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
        ]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/posts')
        await router.isReady()

        const wrapper = mountPage(PrincipalSwitcher, pinia, router)
        const calls = recordNavigation(router)
        calls.length = 0

        await wrapper.find('[data-test="principal-trigger"]').trigger('click')
        await wrapper.find('[data-test="principal-option-8"]').trigger('click')
        await flushPromises()

        expect(calls).toEqual(['replace'])
    })

    it('keeps the section the operator was on', async () => {
        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [
            makePrincipal({ id: 7 }),
            makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
        ]
        principals.selectPrincipal(7)

        const router = makeRouter()
        await router.push('/p/7/accounts')
        await router.isReady()

        const wrapper = mountPage(PrincipalSwitcher, pinia, router)
        await wrapper.find('[data-test="principal-trigger"]').trigger('click')
        await wrapper.find('[data-test="principal-option-8"]').trigger('click')
        await flushPromises()

        expect(router.currentRoute.value.path).toBe('/p/8/accounts')
    })
})
