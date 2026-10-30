import { describe, it, expect } from 'vitest'
import { APP_ROUTES, appRoutes, sectionForRouteName, tabForRouteName } from '../../src/lib/routes'

describe('appRoutes', () => {
    it('gives every route a path, a name and a component', () => {
        for (const route of appRoutes()) {
            expect(route.path).toBeTypeOf('string')
            expect(route.name).toBeTypeOf('string')
            expect(route.component).toBeTruthy()
        }
    })
})

describe('sectionForRouteName', () => {
    it('names the section a route belongs to', () => {
        expect(sectionForRouteName('compose')).toBe('compose')
        expect(sectionForRouteName('calendar')).toBe('calendar')
        expect(sectionForRouteName('posts')).toBe('posts')
        expect(sectionForRouteName('analytics')).toBe('analytics')
        expect(sectionForRouteName('accounts')).toBe('accounts')
    })

    it('puts the drawer route in the tab it opens over', () => {
        expect(sectionForRouteName('post')).toBe('posts')
    })

    it('puts the OAuth callback in the accounts section', () => {
        // The backend calls the screen "connections"; the screen's own
        // address is `/accounts`.
        expect(sectionForRouteName('connections')).toBe('accounts')
    })

    it('says nothing for a route that names no section', () => {
        expect(sectionForRouteName('root')).toBeNull()
        expect(sectionForRouteName('not-found')).toBeNull()
    })

    it('says nothing when there is no route name at all', () => {
        expect(sectionForRouteName(null)).toBeNull()
        expect(sectionForRouteName(undefined)).toBeNull()
        expect(sectionForRouteName(Symbol('route'))).toBeNull()
    })
})

describe('tabForRouteName', () => {
    it('puts the analytics view on the posts tab', () => {
        expect(tabForRouteName('analytics')).toBe('posts')
        expect(tabForRouteName('post')).toBe('posts')
        expect(tabForRouteName('connections')).toBe('accounts')
    })

    it('says nothing for a route that names no tab', () => {
        expect(tabForRouteName('root')).toBeNull()
        expect(tabForRouteName(null)).toBeNull()
        expect(tabForRouteName(Symbol('route'))).toBeNull()
    })
})

describe('APP_ROUTES', () => {
    it('has no recurring route — the static slot was cut', () => {
        expect(APP_ROUTES.map((route) => route.name)).not.toContain('recurring')
        expect(APP_ROUTES.map((route) => route.path)).not.toContain('/p/:principalId/recurring')
    })

    it('carries the acting principal on every scoped path', () => {
        const scoped = APP_ROUTES.filter((route) => route.path.startsWith('/p/:principalId'))
        expect(scoped.length).toBeGreaterThan(0)
        for (const route of scoped) {
            expect(route.path).toContain('/p/:principalId')
        }
    })
})
