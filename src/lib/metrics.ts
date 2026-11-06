/**
 * The numbers a post carries.
 *
 * **A counter is null when the platform does not report it, and 0 when it
 * reported zero.** The two are different claims, and only one of them is
 * "nobody saw it" — so the null has to survive every sum and every render. A
 * LinkedIn member post reports reactions and nothing else; showing it a reach
 * of zero would be a false reading, not a rounding.
 */
import type { Channel, SocialPost, TopPost } from '../types'
import { NO_VALUE } from './format'
import { channelOf, uniqueChannels } from './platforms'

/**
 * A counter, or a dash when the platform did not report it.
 *
 * A reported zero stays a zero: "nobody saw it" and "this platform does not
 * report it" are different claims, and only one of them is a number.
 */
export function formatCounter(value: number | null): string {
    return value === null ? NO_VALUE : value.toLocaleString()
}

/** The targets that carry a reading. */
export function measuredTargets(post: SocialPost): number {
    return post.targets.filter((target) => target.metrics !== null).length
}

/**
 * The summed reach of the targets that reported one.
 *
 * Null when no measured target reports a reach: there is no reach to state.
 * A target that reports null contributes nothing to the sum without making
 * the whole sum null — one network reporting a reach is enough.
 */
export function postReach(post: SocialPost): number | null {
    const reported = post.targets
        .map((target) => target.metrics?.reach)
        .filter((reach): reach is number => reach !== null && reach !== undefined)

    return reported.length === 0 ? null : reported.reduce((sum, reach) => sum + reach, 0)
}

/**
 * The summed engagements: likes, comments, shares and saves.
 *
 * A counter that was not reported contributes nothing, the same way a target
 * with no reach contributes nothing to the reach.
 */
export function postEngagements(post: SocialPost): number {
    return post.targets.reduce(
        (sum, target) =>
            sum +
            (target.metrics?.likes ?? 0) +
            (target.metrics?.comments ?? 0) +
            (target.metrics?.shares ?? 0) +
            (target.metrics?.saves ?? 0),
        0,
    )
}

/**
 * The engagement rate, or null when there is no rate to state.
 *
 * Null when nothing was measured, when the reach was not reported — a rate
 * over an unknown reach would be a rate over nothing — and when the reach is
 * a counted zero, because 0/0 is not a rate.
 */
export function postEngagementRate(post: SocialPost): number | null {
    if (measuredTargets(post) === 0) return null

    const reach = postReach(post)
    if (reach === null || reach === 0) return null

    return postEngagements(post) / reach
}

/**
 * The channels a post went to.
 *
 * The channel is the network *and* the route: the same network through two
 * routes is two accounts, and the row has to say which one it was. Two
 * accounts on one channel are one channel, so the row shows it once.
 */
export function postChannels(post: SocialPost): Channel[] {
    return uniqueChannels(post.targets.map((target) => channelOf(target.via, target.platform)))
}

/**
 * A top post's row, with the key it is rendered under.
 */
export interface TopPostRow extends TopPost {
    /** The target the row is about — or the post and its channel. */
    key: string
}

/**
 * The key a top post's row is rendered under.
 *
 * **The target's id, when the row carries one.** The backend's rows are one
 * per target, so two accounts of the same channel on one post are two rows
 * and only the target's id tells them apart.
 *
 * **The post, the route and the network, when it does not.** A backend that
 * sends no target id sends one row per reading instead, and those are folded
 * by the three every reading of that post shares.
 *
 * **The two cannot collide.** One key begins with `target:` and the other
 * with `post:`, so a target id can never be mistaken for a post — and a row
 * that carries a target id and a row that does not are two rows, each with
 * a key of its own.
 */
function topPostKey(post: TopPost): string {
    return typeof post.target_id === 'number'
        ? `target:${post.target_id}`
        : `post:${post.post_id}:${post.via}:${post.platform}`
}

/**
 * The top posts, one row per target.
 *
 * **The backend's rows are one per target.** A post on two accounts is two
 * rows — the same post, the same title, two sets of numbers — and the
 * target's id is what tells them apart. Two rows that carry the same target
 * id are one reading sent twice, and the first of them is the one kept: the
 * backend sorts them by reach, so it is the reading that reached the most
 * people.
 *
 * A backend that sends no target id sends a row per reading instead, and
 * those are folded by the post, the route and the network.
 *
 * The key is the target, so two rows can never wear the same key — and the
 * row that was first keeps its key when the list is re-ordered.
 */
export function topPostRows(posts: TopPost[]): TopPostRow[] {
    const rows: TopPostRow[] = []
    const seen = new Set<string>()

    for (const post of posts) {
        const key = topPostKey(post)
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({ ...post, key })
    }

    return rows
}

/**
 * A post in the top posts, with the rows that belong to it.
 */
export interface TopPostGroup {
    /** The post's id. */
    post_id: number
    title: string
    /** The key the post is rendered under. */
    key: string
    /** The rows — one per target, in the order the backend sent them. */
    rows: TopPostRow[]
}

/**
 * The top posts, grouped by the post they belong to.
 *
 * The backend's rows are one per target, so a post that went to two places
 * arrives twice — and the two rows are **one post going to two places**, not
 * two posts. The group is what says so: the rows hang under one title, so
 * the operator reads the post once and the places once each.
 */
export function topPostGroups(posts: TopPost[]): TopPostGroup[] {
    const groups = new Map<number, TopPostGroup>()

    for (const row of topPostRows(posts)) {
        const group = groups.get(row.post_id)

        if (group === undefined) {
            groups.set(row.post_id, {
                post_id: row.post_id,
                title: row.title,
                key: `post:${row.post_id}`,
                rows: [row],
            })
            continue
        }

        group.rows.push(row)
    }

    return [...groups.values()]
}
