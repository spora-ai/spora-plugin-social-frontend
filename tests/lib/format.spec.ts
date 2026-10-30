import { describe, it, expect } from 'vitest'
import {
    NO_VALUE,
    daysUntil,
    formatDate,
    formatDateTime,
    formatRelative,
    formatWhen,
} from '../../src/lib/format'

const NOW = new Date(2026, 10, 5, 12, 0, 0).getTime()

/** An ISO timestamp `offsetMs` away from NOW, built in local time so the
 *  calendar day never shifts with the machine's timezone. */
function at(offsetMs: number): string {
    return new Date(NOW + offsetMs).toISOString()
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelative', () => {
    it('says nothing when there is no timestamp', () => {
        expect(formatRelative(null, NOW)).toBe(NO_VALUE)
        expect(formatRelative(undefined, NOW)).toBe(NO_VALUE)
    })

    it('calls the last minute "just now"', () => {
        expect(formatRelative(at(-30_000), NOW)).toBe('just now')
    })

    it('counts the minutes that have passed', () => {
        expect(formatRelative(at(-3 * MINUTE), NOW)).toBe('3m ago')
    })

    it('counts the minutes that are still to come', () => {
        expect(formatRelative(at(2 * MINUTE), NOW)).toBe('in 2m')
    })

    it('counts the hours', () => {
        expect(formatRelative(at(-3 * HOUR), NOW)).toBe('3h ago')
        expect(formatRelative(at(2 * HOUR), NOW)).toBe('in 2h')
    })

    it('counts the days', () => {
        expect(formatRelative(at(-3 * DAY), NOW)).toBe('3d ago')
        expect(formatRelative(at(2 * DAY), NOW)).toBe('in 2d')
    })

    it('gives up on relative time after a month', () => {
        expect(formatRelative(at(-40 * DAY), NOW)).toBe(formatDate(at(-40 * DAY)))
        expect(formatRelative(at(40 * DAY), NOW)).toBe(formatDate(at(40 * DAY)))
    })
})

describe('formatWhen', () => {
    it('says nothing when there is no timestamp', () => {
        expect(formatWhen(null, NOW)).toBe(NO_VALUE)
        expect(formatWhen(undefined, NOW)).toBe(NO_VALUE)
    })

    it('calls the next hour "in moments"', () => {
        expect(formatWhen(at(30 * MINUTE), NOW)).toBe('in moments')
        expect(formatWhen(at(-30 * MINUTE), NOW)).toBe('in moments')
    })

    it('counts the hours that are still to come', () => {
        expect(formatWhen(at(3 * HOUR), NOW)).toBe('in 3h')
    })

    it('counts the hours that have passed', () => {
        expect(formatWhen(at(-3 * HOUR), NOW)).toBe('3h ago')
    })

    it('gives up on relative time after a day', () => {
        expect(formatWhen(at(30 * HOUR), NOW)).toBe(formatDateTime(at(30 * HOUR)))
        expect(formatWhen(at(-30 * HOUR), NOW)).toBe(formatDateTime(at(-30 * HOUR)))
    })
})

describe('formatDate', () => {
    it('says nothing when there is no timestamp', () => {
        expect(formatDate(null)).toBe(NO_VALUE)
        expect(formatDate(undefined)).toBe(NO_VALUE)
    })

    it('writes the day and the month, and no time', () => {
        const written = formatDate(at(0))
        expect(written).toContain('5')
        expect(written).not.toContain('12:00')
    })
})

describe('formatDateTime', () => {
    it('says nothing when there is no timestamp', () => {
        expect(formatDateTime(null)).toBe(NO_VALUE)
        expect(formatDateTime(undefined)).toBe(NO_VALUE)
    })

    it('writes the day and the time', () => {
        expect(formatDateTime(at(0))).toContain('5')
    })
})

describe('daysUntil', () => {
    it('says nothing when there is no timestamp', () => {
        expect(daysUntil(null, NOW)).toBeNull()
        expect(daysUntil(undefined, NOW)).toBeNull()
    })

    it('counts the days, rounded', () => {
        expect(daysUntil(at(3 * DAY), NOW)).toBe(3)
        expect(daysUntil(at(-2 * DAY), NOW)).toBe(-2)
        // Rounded, not floored: 9.6 days is "10 days", not "9 days".
        expect(daysUntil(at(9.6 * DAY), NOW)).toBe(10)
    })
})
