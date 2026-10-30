<script setup lang="ts">
/**
 * The connections: one login per provider, and the accounts it covers.
 *
 * **The screen shows connections rather than platforms** because that is what
 * the operator holds: a Meta login publishes as an Instagram professional
 * account *and* as a Facebook Page, under one token. The token's health
 * belongs to the connection, not to the accounts inside it — so the expiry,
 * the status and the "needs reconnect" flag sit on the connection's card, and
 * an account carries only what is its own.
 *
 * **The setup instruction does not live here.** The app id, the secret and
 * the configuration id are configured in Settings → Plugins, and the redirect
 * URI is part of that instruction — so a card here would send the operator to
 * a second place for the same task.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, RefreshCw, Trash } from 'lucide-vue-next'
import { PLATFORM_LABELS } from '../lib/platforms'
import {
    connectionExpiryNote,
    connectionStatusClass,
    connectionStatusLabel,
    needsAttention,
    PROVIDERS,
    providerLabel,
} from '../lib/providers'
import type { Provider, ProviderSetupNotice, SocialConfig, SocialConnection } from '../types'

const props = defineProps<{
    connections: SocialConnection[]
    config: SocialConfig | null
}>()

const emit = defineEmits<{
    connect: [provider: Provider]
    refresh: [connection: SocialConnection]
    disconnect: [connection: SocialConnection]
}>()

const { t } = useI18n()

/** The providers with no connection yet — the ones that can still be connected. */
const openProviders = computed(() =>
    PROVIDERS.filter(
        (provider) => !props.connections.some((connection) => connection.provider === provider),
    ),
)

/**
 * The provider's setup notice, as the backend words it.
 *
 * The plugin knows what a provider needs and what it is called, and it emits
 * the wording for the host to translate — so a copy here would be a second
 * wording to keep in step, in two languages.
 *
 * **The notice is the only signal.** The backend sends it exactly when the
 * provider needs setup, and its `configured` flag is that same answer — so
 * there is one condition here, the same shape as the backend's.
 */
function setupNotice(provider: Provider): ProviderSetupNotice | null {
    return props.config?.providers[provider]?.needs_setup ?? null
}
</script>

<template>
    <div data-test="connections-grid">
        <div
            v-if="connections.length === 0"
            class="surface-card px-6 py-10 text-center"
            data-test="connections-empty"
        >
            <p class="text-sm font-medium">{{ t('No connections for this principal') }}</p>
            <p class="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                {{ t('Connections belong to the principal you are working as. Connect a provider to start publishing, or switch to another principal.') }}
            </p>
        </div>

        <div class="space-y-5">
            <section
                v-for="connection in connections"
                :key="connection.id"
                class="surface-card p-4"
                :data-test="`connection-${connection.id}`"
            >
                <div class="flex flex-wrap items-center gap-2">
                    <span class="provider-chip" :data-provider="connection.provider">
                        {{ providerLabel(connection.provider) }}
                    </span>
                    <span class="pill" :class="connectionStatusClass(connection.status)">
                        {{ connectionStatusLabel(connection.status) }}
                    </span>
                    <span v-if="connection.needs_reconnect" class="pill pill-expiring">
                        {{ t('Needs reconnect') }}
                    </span>
                    <span class="ml-auto text-xs text-muted-foreground" :data-test="`connection-token-${connection.id}`">
                        {{ connectionExpiryNote(connection) }}
                    </span>
                </div>

                <p v-if="connection.scopes.length > 0" class="mt-2 text-[11px] text-muted-foreground">
                    {{ t('Scopes') }}: {{ connection.scopes.join(', ') }}
                </p>

                <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <div
                        v-for="account in connection.accounts"
                        :key="account.id"
                        class="rounded-lg border border-border p-3"
                        :data-test="`connection-account-${account.id}`"
                    >
                        <div class="flex items-center gap-2">
                            <span class="platform-chip" :data-platform="account.platform">
                                {{ PLATFORM_LABELS[account.platform] }}
                            </span>
                            <span class="min-w-0 flex-1 truncate text-sm font-medium">
                                {{ account.display_name }}
                            </span>
                        </div>
                        <div class="mt-1 truncate text-xs text-muted-foreground">
                            {{ account.username }} · {{ account.kind }}
                        </div>
                        <div class="mt-2 text-xs text-muted-foreground">
                            {{ t('Audience') }}:
                            <span class="font-medium tabular-nums text-foreground">
                                {{ account.followers.toLocaleString() }}
                            </span>
                        </div>
                        <p
                            v-if="account.report_note"
                            class="mt-2 rounded border border-border px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground"
                            :data-test="`account-report-note-${account.id}`"
                        >
                            {{ account.report_note }}
                        </p>
                    </div>
                </div>

                <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
                    <!-- A connection with no expiry has nothing to renew:
                         the backend hands the token back unchanged. A button
                         that cannot do anything reads as a broken one. The
                         rule is the expiry the platform sent — null when it
                         sent none — and not the provider. -->
                    <button
                        v-if="connection.expires_at !== null"
                        type="button"
                        class="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                        :data-test="`connection-refresh-${connection.id}`"
                        @click="emit('refresh', connection)"
                    >
                        <RefreshCw class="h-3 w-3" />
                        {{ t('Refresh token') }}
                    </button>
                    <button
                        type="button"
                        class="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium text-destructive transition-colors hover:bg-muted"
                        :data-test="`connection-disconnect-${connection.id}`"
                        @click="emit('disconnect', connection)"
                    >
                        <Trash class="h-3 w-3" />
                        {{ t('Disconnect') }}
                    </button>
                    <span v-if="needsAttention(connection)" class="text-[11px] text-amber-600 dark:text-amber-400">
                        {{ t('This connection will not publish until it is renewed.') }}
                    </span>
                </div>
            </section>

            <section
                v-for="provider in openProviders"
                :key="provider"
                class="surface-card p-4"
                :data-test="`provider-${provider}`"
            >
                <div class="flex items-center justify-between gap-3">
                    <span class="provider-chip" :data-provider="provider">
                        {{ providerLabel(provider) }}
                    </span>
                    <button
                        type="button"
                        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                        :data-test="`connect-${provider}`"
                        @click="emit('connect', provider)"
                    >
                        <Plus class="h-3.5 w-3.5" />
                        {{ t('Connect {provider}', { provider: providerLabel(provider) }) }}
                    </button>
                </div>

                <!-- The wording is the backend's: the plugin knows what a
                     provider needs and what it is called, and it emits the
                     wording for the host to translate. A copy here would be a
                     second wording to keep in step. -->
                <div
                    v-if="setupNotice(provider) !== null"
                    class="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                    :data-test="`setup-${provider}`"
                >
                    <p class="text-xs font-medium" :data-test="`setup-title-${provider}`">
                        {{ setupNotice(provider)!.title }}
                    </p>
                    <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground" :data-test="`setup-body-${provider}`">
                        {{ setupNotice(provider)!.body }}
                    </p>
                </div>
            </section>
        </div>
    </div>
</template>
