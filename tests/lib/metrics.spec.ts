import { describe, it, expect } from 'vitest'
import {
    formatCounter,
    measuredTargets,
    postEngagementRate,
    postEngagements,
    postPlatforms,
    postReach,
} from '../../src/lib/metrics'
import { makeMetrics, makePost, makeTarget } from '../fixtures'
import type { SocialPost } from '../../src/types'

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

    it('names the platforms a post went to, once each', () => {
        const post = makePost({
            targets: [
                makeTarget({ id: 501, platform: 'linkedin' }),
                makeTarget({ id: 502, platform: 'linkedin' }),
                makeTarget({ id: 503, platform: 'instagram' }),
            ],
        })

        expect(postPlatforms(post)).toEqual(['linkedin', 'instagram'])
    })
})
