/**
 * How a moment in time is put into words.
 *
 * One module, so the same duration is phrased the same way wherever it
 * appears — the post list, the calendar and the account grid all read from
 * here. The page used to carry a ladder of its own, which
 * phrased the same duration differently on the same screen.
 *
 * The strings go through the catalogue: they are operator-facing copy, and a
 * German operator should read "vor 3 Std." rather than "3h ago".
 */
import { t } from '../i18n'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * The em dash for a value that is not there — no date, no reported counter.
 *
 * It is not a formatted zero: null and 0 are different claims, and only one
 * of them says "nobody saw it".
 */
export const NO_VALUE = '—'

/**
 * A compact relative time: "just now", "3m ago", "in 2h".
 *
 * The sign is carried all the way down — a timestamp in the future is "in 2h",
 * never "now" — because a post scheduled for later must not read as one that
 * already went out.
 */
export function formatRelative(iso: string | null | undefined, now: number = Date.now()): string {
    if (!iso) return NO_VALUE

    const diff = now - new Date(iso).getTime()
    const abs = Math.abs(diff)
    const sign = diff < 0 ? -1 : 1

    if (abs < MINUTE) return t('just now')

    if (abs < HOUR) {
        const minutes = Math.floor(abs / MINUTE)
        return sign < 0 ? t('in {n}m', { n: minutes }) : t('{n}m ago', { n: minutes })
    }

    if (abs < DAY) {
        const hours = Math.floor(abs / HOUR)
        return sign < 0 ? t('in {n}h', { n: hours }) : t('{n}h ago', { n: hours })
    }

    const days = Math.floor(abs / DAY)
    if (days < 30) {
        return sign < 0 ? t('in {n}d', { n: days }) : t('{n}d ago', { n: days })
    }

    return formatDate(iso)
}

/**
 * When a post goes out, in the operator's own words.
 *
 * Within a day it is relative — "in 3h" is what the operator needs before a
 * post goes out. Beyond that it is a date, because a relative time over a
 * fortnight stops being useful.
 */
export function formatWhen(iso: string | null | undefined, now: number = Date.now()): string {
    if (!iso) return NO_VALUE

    const target = new Date(iso)
    const diffHours = (target.getTime() - now) / HOUR

    if (Math.abs(diffHours) < 1) return t('in moments')
    if (diffHours > 0 && diffHours < 24) return t('in {n}h', { n: Math.round(diffHours) })
    if (diffHours < 0 && diffHours > -24) return t('{n}h ago', { n: Math.round(-diffHours) })

    return formatDateTime(iso)
}

/** A date, without the time. */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return NO_VALUE
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** A date with the time — the detail drawer and the account card. */
export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return NO_VALUE
    return new Date(iso).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/**
 * The whole days until a timestamp — negative once it has passed.
 *
 * Rounded, not floored: a token with 9.6 days left is "10 days", and
 * "9 days" would make the operator think it is closer than it is.
 */
export function daysUntil(iso: string | null | undefined, now: number = Date.now()): number | null {
    if (!iso) return null
    return Math.round((new Date(iso).getTime() - now) / DAY)
}
