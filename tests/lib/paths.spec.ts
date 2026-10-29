import { describe, it, expect } from 'vitest'
import {
    accountsPath,
    analyticsPath,
    calendarPath,
    composePath,
    postPath,
    postsPath,
    sectionPath,
    type Section,
} from '../../src/lib/paths'

const SECTIONS: Section[] = ['compose', 'calendar', 'posts', 'analytics', 'accounts']

describe('lib/paths', () => {
    it('puts the principal on every section path', () => {
        for (const section of SECTIONS) {
            expect(sectionPath(7, section).startsWith('/p/7/')).toBe(true)
        }
    })

    it('builds the composer path', () => {
        expect(composePath(7)).toBe('/p/7/compose')
    })

    it('builds the calendar path', () => {
        expect(calendarPath(7)).toBe('/p/7/calendar')
    })

    it('builds the posts path', () => {
        expect(postsPath(7)).toBe('/p/7/posts')
    })

    it('builds the analytics path under the posts tab', () => {
        expect(analyticsPath(7)).toBe('/p/7/posts/analytics')
    })

    it('builds the accounts path', () => {
        expect(accountsPath(7)).toBe('/p/7/accounts')
    })

    it('builds the post drawer path', () => {
        expect(postPath(7, 88)).toBe('/p/7/post/88')
    })

    it('never builds a path without a principal', () => {
        // The builder takes a principal, so a forgotten scope is a type error
        // rather than a link to somebody else's data.
        expect(SECTIONS.every((section) => sectionPath(7, section).includes('/p/7'))).toBe(true)
        expect(postPath(7, 88)).toContain('/p/7/')
    })
})
