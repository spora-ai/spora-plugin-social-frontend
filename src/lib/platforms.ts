/**
 * The networks, and what each of them accepts.
 *
 * **The limits are the backend's.** `/config` carries them, because the
 * backend is what refuses the publish — a copy here warns about a number the
 * backend no longer enforces. So the composer reads the rules it is given and
 * has none of its own.
 */
import type { Platform, PlatformRules } from '../types'

/** The networks' own names. They read the same in every language. */
export const PLATFORM_LABELS: Record<Platform, string> = {
    linkedin: 'LinkedIn',
    facebook: 'Facebook',
    instagram: 'Instagram',
}

export const PLATFORMS: Platform[] = ['linkedin', 'facebook', 'instagram']

export function platformLabel(platform: Platform): string {
    return PLATFORM_LABELS[platform]
}

export interface CharCount {
    n: number
    limit: number
    /** Past the limit — the post cannot go out as it is. */
    over: boolean
    /** Close enough to the limit to be worth saying. */
    near: boolean
}

/**
 * The character count for one body against one network's limit.
 *
 * Counted in **code points**, not UTF-16 code units: a surrogate pair is two
 * units and one code point, and the platforms count code points — so a
 * caption of 2,200 emoji is at the limit, not twice over it.
 */
export function charCount(text: string, limit: number): CharCount {
    const n = [...(text ?? '')].length
    return { n, limit, over: n > limit, near: n <= limit && n > limit * 0.9 }
}

export interface MediaFit {
    fits: boolean
    /** What the network accepts, in its own words. */
    reason: string
    /** What the operator can do about it. */
    remedy: string
}

/**
 * Can this asset be published to this network as it is?
 *
 * The rules are the backend's, and so is the wording: the note names the
 * rule and the remedy names the action, so the badge on an attachment and the
 * refusal at publish time read as one thing.
 */
export function mediaFit(
    asset: { mime_type: string | null; size_bytes?: number | null },
    rule: PlatformRules,
): MediaFit {
    const mime = asset.mime_type ?? ''

    if (mime !== '' && !rule.mime_types.includes(mime)) {
        return {
            fits: false,
            reason: rule.media_note,
            remedy: mime.startsWith('video/') ? rule.video_remedy : rule.media_remedy,
        }
    }

    const size = asset.size_bytes
    if (typeof size === 'number' && size > rule.max_bytes) {
        return { fits: false, reason: rule.media_note, remedy: rule.size_remedy }
    }

    return { fits: true, reason: '', remedy: '' }
}

/**
 * The chart series colour for a network.
 *
 * Deliberately not the platform brand hue: LinkedIn's and Facebook's blues
 * are too close to tell apart in a stacked bar. The brand hue is for the
 * chip, where it is the only colour on the element.
 */
export function chartColorVar(platform: Platform): string {
    return `var(--chart-${platform})`
}

/** The platform brand hue — a chip accent, never a chart series. */
export function brandColorVar(platform: Platform): string {
    return `var(--platform-${platform})`
}
