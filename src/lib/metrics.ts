/**
 * The numbers a post carries.
 *
 * **A counter is null when the platform does not report it, and 0 when it
 * reported zero.** The two are different claims, and only one of them is
 * "nobody saw it" — so the null has to survive every sum and every render. A
 * LinkedIn member post reports reactions and nothing else; showing it a reach
 * of zero would be a false reading, not a rounding.
 */
import type { SocialPost } from '../types'
import { NO_VALUE } from './format'

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

/** The platforms a post went to, in the platform order the UI uses. */
export function postPlatforms(post: SocialPost): string[] {
    const platforms: string[] = []
    for (const target of post.targets) {
        if (!platforms.includes(target.platform)) platforms.push(target.platform)
    }
    return platforms
}
