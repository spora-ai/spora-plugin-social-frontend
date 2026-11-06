import { describe, it, expect } from 'vitest'
import {
    formatCounter,
    measuredTargets,
    postEngagementRate,
    postEngagements,
    postChannels,
    postReach,
    topPostRows,
} from '../../src/lib/metrics'
import { makeMetrics, makePost, makeTarget } from '../fixtures'
import type { SocialPost, TopPost } from '../../src/types'

/** A post whose targets report the given reaches — null means "not reported". */
function postWithReaches(...reaches: (number | null)[]): SocialPost {
    return makePost({
        targets: reaches.map((reach, index) =>
            makeTarget({
                id: 501 + index,
                account_id: 12 + index,
                metrics:
                    reach === null
                        ? makeMetrics({ reach: null, impressions: null, likes: null, comments: null, shares: null, saves: null, clicks: null })
                        : makeMetrics({ reach }),
            }),
        ),
    })
}

describe('lib/metrics — a null is not a zero', () => {
    it('has no reach when no measured target reports one', () => {
        expect(postReach(postWithReaches(null))).toBeNull()
    })

    it('has no reach when nothing was measured at all', () => {
        const post = makePost({ targets: [makeTarget({ metrics: null })] })
        expect(postReach(post)).toBeNull()
    })

    it('sums the reaches that were reported', () => {
        expect(postReach(postWithReaches(100, 250))).toBe(350)
    })

    it('ignores a target that reports no reach without making the sum null', () => {
        expect(postReach(postWithReaches(null, 250))).toBe(250)
    })

    it('keeps a counted zero a zero', () => {
        expect(postReach(postWithReaches(0))).toBe(0)
    })

    it('has no rate when the reach was not reported', () => {
        expect(postEngagementRate(postWithReaches(null))).toBeNull()
    })

    it('has no rate over a counted zero', () => {
        // 0/0 is not a rate.
        expect(postEngagementRate(postWithReaches(0))).toBeNull()
    })

    it('has no rate when nothing was measured', () => {
        const post = makePost({ targets: [makeTarget({ metrics: null })] })
        expect(postEngagementRate(post)).toBeNull()
    })

    it('states a rate over a reported reach', () => {
        const post = makePost({
            targets: [makeTarget({ metrics: makeMetrics({ reach: 200, likes: 20, comments: 0, shares: 0, saves: 0 }) })],
        })
        expect(postEngagementRate(post)).toBeCloseTo(0.1)
    })

    it('renders a missing counter as a dash and a counted zero as a zero', () => {
        expect(formatCounter(null)).toBe('—')
        expect(formatCounter(0)).toBe('0')
        expect(formatCounter(4820)).toBe('4,820')
    })

    it('counts the targets that carry a reading', () => {
        expect(measuredTargets(makePost({ targets: [makeTarget({ metrics: null })] }))).toBe(0)
        expect(measuredTargets(postWithReaches(100, 250))).toBe(2)
    })

    it('sums the engagements of every target', () => {
        // A counter that was not reported contributes nothing, the same way a
        // target with no reach contributes nothing to the reach.
        const post = makePost({
            targets: [
                makeTarget({ metrics: makeMetrics({ likes: 20, comments: 2, shares: 1, saves: 3 }) }),
                makeTarget({ id: 502, metrics: null }),
            ],
        })

        expect(postEngagements(post)).toBe(26)
    })

    it('names the channels a post went to, once each', () => {
        const post = makePost({
            targets: [
                makeTarget({ id: 501, platform: 'linkedin', via: 'direct' }),
                makeTarget({ id: 502, platform: 'linkedin', via: 'direct' }),
                makeTarget({ id: 503, platform: 'instagram', via: 'direct' }),
            ],
        })

        expect(postChannels(post).map((channel) => channel.key)).toEqual([
            'direct:linkedin',
            'direct:instagram',
        ])
    })

    it('keeps the two routes to one network apart', () => {
        // The same network through two routes is two accounts, and the row
        // has to say which one it was.
        const post = makePost({
            targets: [
                makeTarget({ id: 501, platform: 'linkedin', via: 'direct' }),
                makeTarget({ id: 502, platform: 'linkedin', via: 'zernio' }),
            ],
        })

        expect(postChannels(post).map((channel) => channel.key)).toEqual([
            'direct:linkedin',
            'zernio:linkedin',
        ])
    })
})

/** A top post as the backend sends it. */
function topPost(overrides: Partial<TopPost> = {}): TopPost {
    return {
        post_id: 88,
        title: 'Q4 release',
        platform: 'linkedin',
        via: 'direct',
        reach: 4820,
        impressions: 9310,
        likes: 12,
        published_at: '2026-11-02T09:00:04+00:00',
        ...overrides,
    }
}

describe('lib/metrics — the top posts', () => {
    it('folds the readings of one post into one row', () => {
        // The backend's rows are one per metric reading: the daily collector
        // writes a row per day, so a post on one account arrives once per day.
        const readings = Array.from({ length: 10 }, (_, day) =>
            topPost({ reach: 1000 - day }),
        )

        const rows = topPostRows(readings)

        expect(rows).toHaveLength(1)
    })

    it('keeps the first reading, which is the one that reached the most', () => {
        // The backend sorts the rows by reach before it sends them, so the
        // first of them is the reading that reached the most people.
        const readings = [topPost({ reach: 1200 }), topPost({ reach: 900 })]

        expect(topPostRows(readings)[0]?.reach).toBe(1200)
    })

    it('gives every row a key of its own', () => {
        // Two rows with the same key are patched into one another, and one
        // row wears the other's numbers.
        const rows = topPostRows([
            topPost({ post_id: 88, via: 'direct' }),
            topPost({ post_id: 88, via: 'direct', reach: 10 }),
            topPost({ post_id: 88, via: 'zernio' }),
            topPost({ post_id: 89, via: 'direct' }),
        ])

        expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    })

    it('keeps the two routes to one network apart', () => {
        // The same post on two routes is two accounts and two sets of
        // numbers, and the row has to say which one it was.
        const rows = topPostRows([
            topPost({ post_id: 88, via: 'direct' }),
            topPost({ post_id: 88, via: 'zernio', reach: 40 }),
        ])

        expect(rows.map((row) => row.key)).toEqual(['88:direct:linkedin', '88:zernio:linkedin'])
    })
})
