import { describe, it, expect } from 'vitest'
import {
    formatCounter,
    measuredTargets,
    postEngagementRate,
    postEngagements,
    postChannels,
    postReach,
    topPostGroups,
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

/** A top post as the backend sends it — one row per target. */
function topPost(overrides: Partial<TopPost> = {}): TopPost {
    return {
        post_id: 88,
        title: 'Q4 release',
        target_id: 501,
        platform: 'linkedin',
        via: 'direct',
        reach: 4820,
        impressions: 9310,
        likes: 12,
        published_at: '2026-11-02T09:00:04+00:00',
        ...overrides,
    }
}

/**
 * A top post from a backend that sends **no target id** — one row per
 * reading, the way the plugin's earlier releases answered.
 */
function topPostWithoutTarget(overrides: Partial<TopPost> = {}): TopPost {
    return { ...topPost(overrides), target_id: undefined }
}

describe('lib/metrics — the top posts', () => {
    it('folds two rows of one target into one row', () => {
        // The backend sends one row per target, and a row sent twice is one
        // reading sent twice.
        const rows = topPostRows([topPost({ reach: 1200 }), topPost({ reach: 900 })])

        expect(rows).toHaveLength(1)
        expect(rows[0]?.key).toBe('target:501')
    })

    it('keeps the first row of a target, which is the one that reached the most', () => {
        // The backend sorts the rows by reach before it sends them, so the
        // first of them is the reading that reached the most people.
        const rows = topPostRows([topPost({ reach: 1200 }), topPost({ reach: 900 })])

        expect(rows[0]?.reach).toBe(1200)
        expect(rows[0]?.key).toBe('target:501')
    })

    it('keeps the two targets of one post on one channel apart', () => {
        // A member profile and an organisation page are two accounts of one
        // channel: the same post, the same route, the same network — and two
        // sets of numbers. Folding them would drop the second one's numbers.
        const rows = topPostRows([
            topPost({ post_id: 88, target_id: 501, via: 'direct', reach: 100 }),
            topPost({ post_id: 88, target_id: 502, via: 'direct', reach: 30 }),
        ])

        expect(rows).toHaveLength(2)
        expect(rows.map((row) => row.key)).toEqual(['target:501', 'target:502'])
        expect(rows.map((row) => row.reach)).toEqual([100, 30])
    })

    it('keeps the two targets of one post on two channels apart', () => {
        const rows = topPostRows([
            topPost({ post_id: 88, target_id: 501, via: 'direct' }),
            topPost({ post_id: 88, target_id: 502, via: 'zernio', reach: 40 }),
        ])

        expect(rows).toHaveLength(2)
        expect(rows.map((row) => row.key)).toEqual(['target:501', 'target:502'])
    })

    it('folds a row without a target by the post, the route and the network', () => {
        // The plugin is released before the frontend, so a released frontend
        // may run against a plugin that sends no target id — and that one
        // sends a row per reading.
        const rows = topPostRows([
            topPostWithoutTarget({ reach: 1200 }),
            topPostWithoutTarget({ reach: 900 }),
            topPostWithoutTarget({ via: 'zernio' }),
        ])

        expect(rows).toHaveLength(2)
        expect(rows.map((row) => row.key)).toEqual([
            'post:88:direct:linkedin',
            'post:88:zernio:linkedin',
        ])
    })

    it('does not collide with a row that carries a target', () => {
        // The two key spaces are separate: one begins with `target:` and the
        // other with `post:`, so a target id can never be read as a post.
        const rows = topPostRows([topPost({ target_id: 501 }), topPostWithoutTarget()])

        expect(rows).toHaveLength(2)
        expect(new Set(rows.map((row) => row.key)).size).toBe(2)
    })

    it('gives every row the backend can send a key of its own', () => {
        const rows = topPostRows([
            topPost({ post_id: 88, target_id: 501, via: 'direct' }),
            topPost({ post_id: 88, target_id: 502, via: 'direct' }),
            topPost({ post_id: 88, target_id: 503, via: 'zernio' }),
            topPost({ post_id: 89, target_id: 504, via: 'direct' }),
        ])

        // Two rows keyed the same are patched into one another, and one row
        // wears the other's numbers.
        expect(rows).toHaveLength(4)
        expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    })
})

describe('lib/metrics — the top posts, grouped', () => {
    it('groups the two targets of one post under one post', () => {
        // The two rows are one post going to two places, and the group is
        // what says so.
        const groups = topPostGroups([
            topPost({ post_id: 88, target_id: 501 }),
            topPost({ post_id: 88, target_id: 502, via: 'zernio' }),
            topPost({ post_id: 89, target_id: 503, platform: 'instagram' }),
        ])

        expect(groups).toHaveLength(2)
        expect(groups[0]?.post_id).toBe(88)
        expect(groups[0]?.rows).toHaveLength(2)
        expect(groups[0]?.rows.map((row) => row.key)).toEqual(['target:501', 'target:502'])
        expect(groups[1]?.rows).toHaveLength(1)
    })

    it('keeps the posts of two titles apart', () => {
        const groups = topPostGroups([
            topPost({ post_id: 88, title: 'Q4 release', target_id: 501 }),
            topPost({ post_id: 89, title: 'Studio launch', target_id: 502 }),
        ])

        expect(groups.map((group) => group.title)).toEqual(['Q4 release', 'Studio launch'])
    })
})
