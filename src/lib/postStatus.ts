/**
 * The post's status, as a colour and as words.
 *
 * The backend writes the status itself — `draft`, `scheduled`, `publishing`
 * and `failed` are its own — and only the *outcome* of a publish is derived
 * from the targets: published when every target published it, partial when
 * some did.
 */
import { t } from '../i18n'
import type { SocialPost } from '../types'

export function statusPill(status: SocialPost['status']): string {
    const map: Record<SocialPost['status'], string> = {
        draft: 'pill-draft',
        scheduled: 'pill-scheduled',
        publishing: 'pill-publishing',
        published: 'pill-published',
        partial: 'pill-partial',
        failed: 'pill-failed',
        cancelled: 'pill-cancelled',
    }
    return map[status]
}

/**
 * The status, in words.
 *
 * A literal call per status rather than a lookup table: a table would make
 * the key dynamic, and a dynamic key is not harvestable — the German
 * catalogue would never learn the word.
 */
export function statusLabel(status: SocialPost['status']): string {
    switch (status) {
        case 'draft':
            return t('Draft')
        case 'scheduled':
            return t('Scheduled')
        case 'publishing':
            return t('Publishing')
        case 'published':
            return t('Published')
        case 'partial':
            return t('Partly published')
        case 'failed':
            return t('Failed')
        case 'cancelled':
            return t('Cancelled')
    }
}
