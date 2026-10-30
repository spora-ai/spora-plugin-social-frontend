import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrincipalSwitcher from '../../src/components/PrincipalSwitcher.vue'
import type { Principal } from '../../src/api/principals'
import { makePrincipal } from '../fixtures'
import { mountApp, recordNavigation, type MountedPage } from '../mountPage'

/** The two principals the switcher lists: the operator and a group. */
function twoPrincipals(): Principal[] {
    return [
        makePrincipal({ id: 7 }),
        makePrincipal({ id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 }),
    ]
}

/** The operator opens the switcher. */
async function openSwitcher(page: MountedPage): Promise<void> {
    await page.wrapper.find('[data-test="principal-trigger"]').trigger('click')
}

/** The operator picks another principal from the open switcher. */
async function choosePrincipal(page: MountedPage, id: number): Promise<void> {
    await openSwitcher(page)
    await page.wrapper.find(`[data-test="principal-option-${id}"]`).trigger('click')
    await flushPromises()
}

beforeEach(() => {
    setActivePinia(createPinia())
})

describe('PrincipalSwitcher', () => {
    it('is labelled "Working as"', async () => {
        const page = await mountApp(PrincipalSwitcher)
        expect(page.wrapper.text()).toContain('Working as')
    })

    it('says that reading is not writing', async () => {
        const page = await mountApp(PrincipalSwitcher)
        await openSwitcher(page)
        expect(page.wrapper.text()).toContain('You can read every group you belong to')
    })

    it('lists the principals the caller can act as', async () => {
        const page = await mountApp(PrincipalSwitcher, null, { principals: twoPrincipals() })
        await openSwitcher(page)

        expect(page.wrapper.find('[data-test="principal-option-7"]').exists()).toBe(true)
        expect(page.wrapper.find('[data-test="principal-option-8"]').exists()).toBe(true)
        expect(page.wrapper.text()).toContain('Studio')
    })
})

describe('switching the principal', () => {
    let page: MountedPage

    beforeEach(async () => {
        page = await mountApp(PrincipalSwitcher, '/p/7/posts', { principals: twoPrincipals() })
    })

    it('re-scopes the app: choosing a principal rewrites the path', async () => {
        await choosePrincipal(page, 8)
        expect(page.router.currentRoute.value.path).toBe('/p/8/posts')
    })

    it('replaces the URL rather than pushing it — a context change is not a place', async () => {
        const calls = recordNavigation(page.router)
        calls.length = 0

        await choosePrincipal(page, 8)

        expect(calls).toEqual(['replace'])
    })
})

describe('switching the principal on another section', () => {
    it('keeps the section the operator was on', async () => {
        const page = await mountApp(PrincipalSwitcher, '/p/7/accounts', { principals: twoPrincipals() })
        await choosePrincipal(page, 8)
        expect(page.router.currentRoute.value.path).toBe('/p/8/accounts')
    })

    it('falls back to the composer when the route names no section', async () => {
        // A path that names no section — the principal-scoped root — still has
        // to land on a real one.
        const page = await mountApp(PrincipalSwitcher, '/p/7', { principals: twoPrincipals() })
        await choosePrincipal(page, 8)
        expect(page.router.currentRoute.value.path).toBe('/p/8/compose')
    })
})
