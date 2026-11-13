import { describe, it, expect, beforeEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../src/App.vue'
import { makePrincipal } from './fixtures'
import { hostContext, mountApp, mountPage, stubRoutes, type MountedPage } from './mountPage'
import { CONFIG_PAYLOAD, CONNECTIONS_PAYLOAD } from './recorded'
import { usePrincipalsStore } from '../src/stores/principals'

describe('the rail', () => {
    it('has exactly four tabs, and no Recurring', async () => {
        const page = await mountApp(App, '/p/7/compose')

        const tabs = page.wrapper.findAll('nav a')
        expect(tabs).toHaveLength(4)
        expect(tabs.map((tab) => tab.text())).toEqual([
            'Compose',
            'Calendar',
            'Posts',
            'Accounts',
        ])
        // The static slot was cut, and the tab that showed it with it.
        expect(page.wrapper.find('[data-test="nav-recurring"]').exists()).toBe(false)
        expect(page.wrapper.text()).not.toContain('Recurring')
    })

    it('canonicalises a stale recurring link rather than blanking it', async () => {
        const page = await mountApp(App, '/p/7/recurring')

        // The tab is gone, so the link has to land on a real section rather
        // than on an empty screen.
        expect(page.router.currentRoute.value.path).toBe('/p/7/compose')
        expect(page.router.currentRoute.value.name).toBe('compose')
    })

    it('announces nothing when the query names no provider', async () => {
        const page = await mountApp(App, '/p/7/connections?connected=facebook')

        // A notice about a connection that does not exist is worse than none.
        expect(page.wrapper.find('[data-test="connected-notice"]').exists()).toBe(false)
    })

    it('announces nothing on a reload, because the query is gone', async () => {
        const page = await mountApp(App, '/p/7/accounts')

        expect(page.wrapper.find('[data-test="connected-notice"]').exists()).toBe(false)
    })

    it('adopts the principal the URL names', async () => {
        // The URL is the only writer of the acting principal, so a URL that
        // names another one has to win over the store.
        const page = await mountApp(App, '/p/8/compose', {
            principals: [
                makePrincipal({ id: 7 }),
                makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
            ],
        })

        expect(page.wrapper.find('[data-test="nav-posts"]').attributes('href')).toBe('/p/8/posts')
    })

    it('sends the operator to the composer from the new-post button', async () => {
        const page = await mountApp(App, '/p/7/posts')

        await page.wrapper.find('[data-test="new-post"]').trigger('click')
        await flushPromises()

        expect(page.router.currentRoute.value.path).toBe('/p/7/compose')
    })
})

describe('the OAuth callback', () => {
    let page: MountedPage

    beforeEach(async () => {
        // The OAuth callback redirects the browser here.
        page = await mountApp(App, '/p/7/connections?connected=meta')
    })

    it('leads the backend’s connections link to the accounts screen', () => {
        // The screen's own address is `/accounts`.
        expect(page.router.currentRoute.value.path).toBe('/p/7/accounts')
    })

    it('announces the provider the callback connected, and drops the query', () => {
        expect(page.wrapper.find('[data-test="connected-notice"]').text()).toBe('Meta is connected.')
        // The query has said what it had to say: a reload must not repeat it.
        expect(page.router.currentRoute.value.query.connected).toBeUndefined()
    })
})

describe('the reads', () => {
    /** The app's own answer for a route. */
    function answer(request: string): Promise<unknown> {
        if (request.includes('/principals/me')) {
            return Promise.resolve({
                principals: [
                    makePrincipal({ id: 7 }),
                    makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
                ],
            })
        }
        if (request.includes('/config')) return Promise.resolve(CONFIG_PAYLOAD)
        if (request.includes('/connections')) return Promise.resolve(CONNECTIONS_PAYLOAD)
        return Promise.resolve({})
    }

    /**
     * The app as it comes up cold: no principal has been chosen yet, so the
     * app resolves one itself — and the read it starts and the one the
     * screen inside it starts are in flight at the same time.
     *
     * With `selected`, the principal is already chosen and the app has
     * nothing left to resolve.
     */
    async function mountCold(
        path: string,
        respond: (request: string) => Promise<unknown> = answer,
        selected: number | null = null,
    ) {
        const get = vi.fn().mockImplementation((request: string) => respond(request))
        const context = hostContext()
        context.api.get = get as never

        const pinia = createPinia()
        const principals = usePrincipalsStore(pinia)
        principals.principals = [
            makePrincipal({ id: 7 }),
            makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
        ]
        if (selected !== null) principals.selectPrincipal(selected)

        const router = stubRoutes()
        await router.push(path)
        await router.isReady()

        const wrapper = mountPage(App, pinia, router, context)
        await flushPromises()

        return { wrapper, router, get }
    }

    function reads(get: ReturnType<typeof vi.fn>, path: string): number {
        return get.mock.calls.filter((call) => String(call[0]).includes(path)).length
    }

    it('reads the config and the connections once for the principal', async () => {
        const { get } = await mountCold('/p/7/compose')

        // One answer per question: the rules and the accounts are read once
        // each, however many owners ask for them.
        expect(reads(get, '/config')).toBe(1)
        expect(reads(get, '/connections')).toBe(1)
    })

    it('reads the connections without waiting for the config', async () => {
        // The rules travel with the config and the accounts with the
        // connections; neither read may hold the other back.
        const { get } = await mountCold(
            '/p/7/compose',
            (request) => {
                // The config never answers: the connections must not wait.
                if (request.includes('/config')) return new Promise(() => {})
                return answer(request)
            },
            7,
        )

        expect(reads(get, '/connections')).toBe(1)
    })

    it('reads the new principal again when the principal changes', async () => {
        const { router, get } = await mountCold('/p/7/compose')

        await router.push('/p/8/accounts')
        await flushPromises()

        // The accounts and the aggregators' flags belong to the principal.
        expect(reads(get, '/config')).toBe(2)
        expect(reads(get, '/connections')).toBe(2)
    })
})
