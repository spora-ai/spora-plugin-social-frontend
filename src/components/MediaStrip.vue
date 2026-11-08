<script setup lang="ts">
/**
 * The attachments on the composer.
 *
 * Each one carries its fit state **for the channels currently targeted**, so a
 * file the network will not take says so *on the attachment* — the operator
 * can act on that, and it is not something they have to find in the preview
 * column.
 *
 * **The badge quotes the backend.** The verdict is the backend's, because the
 * backend judges the media as the network receives it: Instagram takes no
 * PNG, and the pipeline converts one before it goes out, so a fit computed
 * here would warn about a post that goes out. The reason names what is
 * wrong and the remedy names what to do about it, so the badge and the
 * refusal at publish time read as one thing.
 *
 * Every attachment can be removed: a mistaken pick should not cost the
 * operator the draft.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert, X } from 'lucide-vue-next'
import type { ComposerAttachment, MediaFitResult } from '../types'

const props = defineProps<{
    attachments: ComposerAttachment[]
    /** The channels the post currently targets. */
    channels: string[]
    /**
     * The backend's verdict on each attachment, per channel.
     *
     * An attachment with no verdict has not been judged yet, and an
     * attachment the backend found no fault with has no badge.
     */
    verdicts: Record<string, MediaFitResult[]>
}>()

const emit = defineEmits<{
    remove: [mediaAssetId: string]
}>()

const { t } = useI18n()

/**
 * The channels an attachment does not fit, with the remedy for each.
 *
 * The verdict is the backend's: its reason says what is wrong and its
 * remedy says what to do about it. Only the channels the post targets are
 * judged — a verdict for a channel it no longer goes to is no verdict.
 */
const problems = computed(() => {
    const map = new Map<string, { channel: string; reason: string; remedy: string }[]>()
    for (const attachment of props.attachments) {
        const failures = (props.verdicts[attachment.media_asset_id] ?? [])
            .filter((verdict) => !verdict.fits && props.channels.includes(verdict.channel))
            .map((verdict) => ({
                channel: verdict.channel,
                reason: verdict.reasons.join(' '),
                remedy: verdict.remedy ?? '',
            }))
        if (failures.length > 0) map.set(attachment.media_asset_id, failures)
    }
    return map
})

function problemsFor(mediaAssetId: string): { channel: string; reason: string; remedy: string }[] {
    return problems.value.get(mediaAssetId) ?? []
}

function mimeLabel(mime: string): string {
    return mime.replace('image/', '').replace('video/', '').toUpperCase()
}
</script>

<template>
    <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3" data-test="media-strip">
        <p v-if="attachments.length === 0" class="text-xs text-muted-foreground">{{ t('No media attached') }}</p>

        <span
            v-for="attachment in attachments"
            :key="attachment.media_asset_id"
            class="relative inline-flex items-center gap-2 rounded-lg border bg-background py-1 pl-1 pr-2"
            :class="problemsFor(attachment.media_asset_id).length > 0 ? 'border-amber-500/50' : 'border-border'"
            :data-test="`media-item-${attachment.media_asset_id}`"
        >
            <span class="media-thumb h-8 w-10 shrink-0" :data-label="mimeLabel(attachment.mime_type)" />
            <span class="min-w-0">
                <span class="block max-w-[9rem] truncate text-[11px] font-medium">{{ attachment.filename }}</span>
                <span
                    v-for="problem in problemsFor(attachment.media_asset_id)"
                    :key="problem.channel"
                    class="pill pill-partial mt-0.5"
                    :data-test="`media-fit-${attachment.media_asset_id}-${problem.channel}`"
                >
                    <TriangleAlert class="h-3 w-3" />
                    {{ problem.reason }}
                    <template v-if="problem.remedy !== ''"> · {{ problem.remedy }}</template>
                </span>
            </span>
            <button
                type="button"
                class="ml-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                :aria-label="t('Remove {name}', { name: attachment.filename })"
                :data-test="`media-remove-${attachment.media_asset_id}`"
                @click="emit('remove', attachment.media_asset_id)"
            >
                <X class="h-3.5 w-3.5" />
            </button>
        </span>
    </div>
</template>
