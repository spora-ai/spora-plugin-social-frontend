import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import App from '../src/App.vue'
import { makePrincipal } from './fixtures'
import { mountApp, type MountedPage } from './mountPage'

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
