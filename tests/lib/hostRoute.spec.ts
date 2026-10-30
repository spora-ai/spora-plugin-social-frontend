import { describe, it, expect } from 'vitest'
import {
    appSlugFrom,
    canonicalLocalPath,
    hostPathForLocalPath,
    localPathForHostPath,
    localPathForHostRoute,
    principalIdInLocalPath,
} from '../../src/lib/hostRoute'

const SLUG = 'social'

describe('lib/hostRoute — between a host URL and a local route', () => {
    it('reads the slug off the host route, and falls back to the path', () => {
        expect(appSlugFrom({ path: '/apps/social/p/7', params: { appName: 'social' } })).toBe('social')
        expect(appSlugFrom({ path: '/apps/social/p/7' })).toBe('social')
        expect(appSlugFrom(null)).toBe('social')
    })

    it('strips the app prefix off a host path', () => {
        expect(localPathForHostPath('/apps/social/p/7/posts', SLUG)).toBe('/p/7/posts')
        expect(localPathForHostPath('/apps/social/p/7/posts/analytics', SLUG)).toBe('/p/7/posts/analytics')
        expect(localPathForHostPath('/apps/social/p/7/post/88', SLUG)).toBe('/p/7/post/88')
    })

    it('maps the bare root to the bare local root', () => {
        expect(localPathForHostPath('/apps/social', SLUG)).toBe('/')
        expect(localPathForHostPath('/apps/social/', SLUG)).toBe('/')
    })

    it('refuses a path that belongs to another app', () => {
        expect(localPathForHostPath('/apps/custom-skills/p/7', SLUG)).toBeNull()
        expect(localPathForHostRoute(null, SLUG)).toBeNull()
    })

    it('appends the app prefix to a local path', () => {
        expect(hostPathForLocalPath('/p/7/posts', SLUG)).toBe('/apps/social/p/7/posts')
        expect(hostPathForLocalPath('/', SLUG)).toBe('/apps/social')
    })

    it('round-trips every destination in both directions', () => {
        const localPaths = [
            '/',
            '/p/7',
            '/p/7/compose',
            '/p/7/calendar',
            '/p/7/posts',
            '/p/7/posts/analytics',
            '/p/7/accounts',
            '/p/7/post/88',
        ]

        for (const local of localPaths) {
            const host = hostPathForLocalPath(local, SLUG)
            expect(localPathForHostPath(host, SLUG)).toBe(local)
        }
    })

    it('reads the principal out of a local path', () => {
        expect(principalIdInLocalPath('/p/7/posts')).toBe(7)
        expect(principalIdInLocalPath('/p/7')).toBe(7)
        expect(principalIdInLocalPath('/compose')).toBeNull()
        // `p/0` is not an id any principal carries.
        expect(principalIdInLocalPath('/p/0/posts')).toBeNull()
        expect(principalIdInLocalPath('/p/abc/posts')).toBeNull()
    })

    describe('canonicalisation', () => {
        it('leaves an already-canonical path alone', () => {
            expect(canonicalLocalPath('/p/7/posts', 'posts', 7)).toBeNull()
            expect(canonicalLocalPath('/p/7/post/88', 'post', 7)).toBeNull()
        })

        it('canonicalises an unknown section to the default one', () => {
            expect(canonicalLocalPath('/p/7/bogus', 'not-found', 7)).toBe('/p/7/compose')
        })

        it('canonicalises a path without a section', () => {
            expect(canonicalLocalPath('/', 'root', 7)).toBe('/p/7/compose')
            expect(canonicalLocalPath('/p/7', 'root-scoped', 7)).toBe('/p/7/compose')
        })

        it('rewrites a path that names another principal, keeping the section', () => {
            expect(canonicalLocalPath('/p/9/posts', 'posts', 7)).toBe('/p/7/posts')
            expect(canonicalLocalPath('/p/9/posts/analytics', 'analytics', 7)).toBe('/p/7/posts/analytics')
        })

        it('drops a drawer whose record belonged to the previous principal', () => {
            expect(canonicalLocalPath('/p/9/post/88', 'post', 7)).toBe('/p/7/posts')
        })

        it('canonicalises the recurring tab that was cut', () => {
            // The static slot is gone, so an old `/recurring` link lands on
            // the catch-all and has to be rewritten rather than blanked.
            expect(canonicalLocalPath('/p/7/recurring', 'not-found', 7)).toBe('/p/7/compose')
        })
    })
})
