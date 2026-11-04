<script setup lang="ts">
/**
 * The setup guide: how to configure a provider, and the redirect URL to
 * register with it.
 *
 * **The redirect URL is the backend's.** It is built from the address this
 * instance is reached at, and the frontend does not know that address — so
 * it is sent, not assembled here. An instance that has no address a platform
 * accepts is sent none, and the overlay says so instead of naming a URL that
 * cannot work.
 *
 * **The steps are the plugin's own** — see `lib/setupGuide.ts`.
 *
 * **The panel names its own colour.** A `<dialog>` carries the user agent's
 * `color: canvastext`, which stays black in the dark theme — so the text
 * would be black on a dark panel unless the panel says which colour it wants.
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Copy, ExternalLink, X } from 'lucide-vue-next'
import { providerLabel } from '../lib/providers'
import { setupGuide } from '../lib/setupGuide'
import type { Provider } from '../types'

const props = defineProps<{
    open: boolean
    provider: Provider | null
    redirectUri: string | null
}>()

const emit = defineEmits<{
    close: []
}>()

const { t } = useI18n()

const dialogRef = ref<HTMLDialogElement | null>(null)
const copied = ref(false)

const guide = computed(() => {
    if (props.provider === null) return null

    return {
        provider: props.provider,
        label: providerLabel(props.provider),
        ...setupGuide(props.provider),
    }
})

watch(
    () => props.open,
    (open) => {
        if (!open) {
            copied.value = false
            return
        }

        // The dialog is created by the `v-if` in the same tick, so the ref is
        // only filled after the DOM has been updated.
        void nextTick(() => dialogRef.value?.showModal())
    },
)

function close(): void {
    emit('close')
}

/**
 * A click on the backdrop closes the overlay.
 *
 * The dialog itself is the backdrop: everything inside it is a descendant, so
 * a click that lands on the dialog element is a click on the empty space
 * around the panel.
 */
function onBackdropClick(event: MouseEvent): void {
    if (event.target === dialogRef.value) close()
}

/**
 * Escape closes the overlay.
 *
 * A modal `<dialog>` closes itself on Escape and fires `close` — but the
 * close is handled here, so the operator's key cannot close the dialog
 * without the screen knowing that it did.
 */
function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return

    event.preventDefault()
    close()
}

/**
 * Put the redirect URL on the clipboard.
 *
 * `navigator.clipboard` needs a secure context, which a development install
 * on plain HTTP is not — so the textarea fallback carries it there.
 */
async function copyToClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text)
        return true
    } catch {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()

        try {
            return document.execCommand('copy')
        } catch {
            return false
        } finally {
            textarea.remove()
        }
    }
}

async function copyRedirectUri(): Promise<void> {
    if (props.redirectUri === null) return

    if (!(await copyToClipboard(props.redirectUri))) return

    copied.value = true
    setTimeout(() => {
        copied.value = false
    }, 1500)
}
</script>

<template>
    <dialog
        v-if="open"
        ref="dialogRef"
        class="fixed inset-0 z-50 m-0 max-h-none max-w-none h-full w-full bg-transparent p-4 backdrop:bg-black/40 open:flex items-center justify-center"
        :aria-label="guide?.label"
        data-test="setup-overlay"
        @click="onBackdropClick"
        @keydown="onKeydown"
        @close="close"
    >
        <div
            v-if="guide !== null"
            class="surface-card flex max-h-full w-full max-w-xl flex-col overflow-hidden text-foreground shadow-xl"
            data-test="setup-overlay-panel"
        >
            <header class="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
                <span class="provider-chip" :data-provider="guide.provider">
                    {{ guide.label }}
                </span>
                <h2 class="text-sm font-semibold">{{ t('Setup guide') }}</h2>
                <button
                    type="button"
                    class="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    :aria-label="t('Close')"
                    data-test="setup-overlay-close"
                    @click="close"
                >
                    <X class="h-3.5 w-3.5" />
                </button>
            </header>

            <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
                <p class="text-xs leading-relaxed text-muted-foreground" data-test="setup-overlay-intro">
                    {{ t('The app id and the secret belong to this instance, not to the account — one pair serves every account that connects.') }}
                </p>

                <a
                    :href="guide.developerConsole.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    data-test="setup-overlay-console"
                >
                    <ExternalLink class="h-3.5 w-3.5" />
                    {{ guide.developerConsole.label }}
                </a>

                <ol class="space-y-2">
                    <li
                        v-for="(step, index) in guide.steps"
                        :key="index"
                        class="flex gap-2 text-xs leading-relaxed"
                        :data-test="`setup-overlay-step-${index + 1}`"
                    >
                        <span class="font-semibold tabular-nums">{{ index + 1 }}.</span>
                        <span>{{ step.body }}</span>
                    </li>
                </ol>

                <div class="rounded-lg border border-border bg-muted/30 p-3">
                    <p class="field-label">{{ t('Redirect URL') }}</p>

                    <div v-if="redirectUri !== null" class="flex items-start gap-2">
                        <code
                            class="min-w-0 flex-1 break-all font-mono text-[11px]"
                            data-test="setup-overlay-redirect-uri"
                        >{{ redirectUri }}</code>
                        <button
                            type="button"
                            class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                            data-test="setup-overlay-copy"
                            @click="copyRedirectUri"
                        >
                            <Check v-if="copied" class="h-3 w-3" />
                            <Copy v-else class="h-3 w-3" />
                            {{ copied ? t('Copied') : t('Copy') }}
                        </button>
                    </div>

                    <p
                        v-else
                        class="text-[11px] leading-relaxed text-muted-foreground"
                        data-test="setup-overlay-no-redirect-uri"
                    >
                        {{ t('This instance has no public address, so there is no redirect URL to register. Set SPORA_APP_URL in your .env or config.php.') }}
                    </p>

                    <p
                        v-if="redirectUri !== null"
                        class="mt-2 text-[11px] leading-relaxed text-muted-foreground"
                    >
                        {{ t('Register this URL with the app. It has to be the address this Spora is reached at — a mismatch is refused by the platform.') }}
                    </p>
                </div>
            </div>
        </div>
    </dialog>
</template>
