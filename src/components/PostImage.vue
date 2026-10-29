<script setup lang="ts">
/**
 * One attachment of a post, rendered as an image.
 *
 * `asset_url` is the path core already stores on the media asset row, so the
 * frontend never builds a URL — the extension belongs to the asset, and a
 * uuid with a guessed extension is a broken image.
 *
 * A null URL means the asset row is gone. The placeholder stands in for it:
 * a broken-image icon would be a claim about what is there, and it is not.
 */
import { computed } from 'vue'
import { Image } from 'lucide-vue-next'
import type { PostMedia } from '../types'

type Variant = 'thumb' | 'feature' | 'strip'

const props = defineProps<{
    media: PostMedia
    /** Empty for an image that is decorative beside a title describing it. */
    alt: string
    /** The shape of the frame. */
    variant: Variant
}>()

/** The frame each variant is drawn in. */
const FRAMES: Record<Variant, string> = {
    // 44 px square: a tall photo is cropped rather than squashed.
    thumb: 'h-11 w-11 rounded-lg',
    strip: 'h-14 w-14 rounded-md',
    // Bounded, so a tall image cannot push the text off the screen.
    feature: 'max-h-[420px] w-full rounded-lg',
}

/** The file type, as a short label — the same form the composer's strip uses. */
const label = computed(() => {
    const mime = props.media.mime_type
    if (mime === null) return ''
    return mime.replace('image/', '').replace('video/', '').replace('application/', '').toUpperCase()
})
</script>

<template>
    <img
        v-if="media.asset_url"
        :src="media.asset_url"
        :alt="alt"
        :class="['block object-cover', FRAMES[variant]]"
        :data-test="`post-image-${media.media_asset_id}`"
    >
    <div
        v-else
        :class="['flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground', FRAMES[variant]]"
        :data-test="`post-image-placeholder-${media.media_asset_id}`"
    >
        <Image class="h-5 w-5" />
        <span v-if="label !== ''" class="text-[10px] uppercase tracking-wide">{{ label }}</span>
    </div>
</template>
