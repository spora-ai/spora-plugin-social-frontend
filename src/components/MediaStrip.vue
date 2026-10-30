<script setup lang="ts">
/**
 * The attachments on the composer.
 *
 * Each one carries its fit state **for the platforms currently targeted**, so a
 * PNG attached while Instagram is among the targets says so *on the
 * attachment* — the operator can act on that, and it is not something they
 * have to find in the preview column.
 *
 * The badge quotes the backend: the note is the platform's media rule in the
 * backend's words and the remedy is the action the backend names. A badge
 * that phrased the rule differently would put two sentences about the same
 * file on the screen.
 *
 * Every attachment can be removed: a mistaken pick should not cost the
 * operator the draft.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { TriangleAlert, X } from 'lucide-vue-next'
import { mediaFit } from '../lib/platforms'
import type { ComposerAttachment, Platform, PlatformRules } from '../types'

const props = defineProps<{
    attachments: ComposerAttachment[]
    /** The platforms the post currently targets. */
    platforms: Platform[]
    /** The rules the backend sent — the badge quotes them. */
    rules: Partial<Record<Platform, PlatformRules>>
}>()

const emit = defineEmits<{
    remove: [mediaAssetId: string]
}>()

const { t } = useI18n()

/**
 * The platforms this attachment does not fit, with the remedy for each.
 *
 * A platform whose rule has not arrived is left out: without the rule there
 * is nothing to judge the file against.
 */
const problems = computed(() => {
    const map = new Map<string, { platform: Platform; reason: string; remedy: string }[]>()
    for (const attachment of props.attachments) {
        const failures = props.platforms
            .map((platform) => {
                const rule = props.rules[platform]
                if (rule === undefined) return null
                const fit = mediaFit(attachment, rule)
                return fit.fits ? null : { platform, reason: fit.reason, remedy: fit.remedy }
            })
            .filter((failure) => failure !== null)
        if (failures.length > 0) map.set(attachment.media_asset_id, failures)
    }
    return map
})

function problemsFor(mediaAssetId: string): { platform: Platform; reason: string; remedy: string }[] {
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
                    :key="problem.platform"
                    class="pill pill-partial mt-0.5"
                    :data-test="`media-fit-${attachment.media_asset_id}-${problem.platform}`"
                >
                    <TriangleAlert class="h-3 w-3" />
                    {{ problem.reason }} · {{ problem.remedy }}
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
