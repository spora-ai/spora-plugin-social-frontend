/**
 * Who wrote a post.
 *
 * The source is `manual` or `ai` — the static slot is gone, so an
 * agent-written post is the only automated one. The label says it in words,
 * because "ai" in a pill says nothing to an operator.
 */
import { t } from '../i18n'
import type { SocialPost } from '../types'

export function sourceLabel(source: SocialPost['source']): string {
    return source === 'ai' ? t('By an agent') : t('Manual')
}

/**
 * A post the agent will publish.
 *
 * The agent drafts the copy and hands the post to the scheduler, so a
 * scheduled agent post is one the operator did not write and has not seen
 * yet — the status "Scheduled" alone does not say that.
 */
export function awaitingAgent(post: SocialPost): boolean {
    return post.source === 'ai' && post.status === 'scheduled'
}
