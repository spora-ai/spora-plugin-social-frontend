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
 * **The card does not carry the setup instruction; the overlay does.** The
 * app id, the secret and the configuration id are configured in Settings →
 * Plugins, and the redirect URL is part of that instruction — so the card
 * opens the guide and the guide names the place to go and the URL to
 * register.
 *
 * **An aggregator is not a peer of the native providers.** It is one quiet
 * line below them, and once it is connected its card is marked as one — so
 * an operator who only wants LinkedIn and Facebook never sees it again.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, Plus, RefreshCw, Trash } from 'lucide-vue-next'
import { brandColorVar, channelKey, networkLabel } from '../lib/platforms'
import {
    connectionExpiryNote,
    connectionStatusClass,
    connectionStatusLabel,
    isNativeProvider,
    needsAttention,
    PROVIDERS,
    providerLabel,
} from '../lib/providers'
import type { Provider, ProviderSetupNotice, SocialConfig, SocialConnection } from '../types'

/**
 * A card of the screen: a connection's, or a provider's.
 *
 * One list, so the order of the screen is one order and not two.
 */
type Card =
    | { kind: 'connection'; key: string; connection: SocialConnection }
    | { kind: 'provider'; key: string; provider: Provider }

const props = defineProps<{
    connections: SocialConnection[]
    config: SocialConfig | null
}>()

const emit = defineEmits<{
    connect: [provider: Provider]
    refresh: [connection: SocialConnection]
    disconnect: [connection: SocialConnection]
    guide: [provider: Provider]
    addAggregator: [aggregator: string, apiKey: string]
    forgetAggregator: [aggregator: string]
    syncAggregator: [aggregator: string]
}>()

const { t } = useI18n()

/** The providers with no connection yet — the ones that can still be connected. */
const openProviders = computed(() =>
    PROVIDERS.filter(
        (provider) => !props.connections.some((connection) => connection.provider === provider),
    ),
)

/**
 * The cards of the screen, in the order they are drawn.
 *
 * The native connections come first, then the providers the operator can
 * still connect, and the aggregator's connections after them: an aggregator
 * is an extra, not a peer of the providers the operator connects themselves,
 * and it is not a peer of a provider card either.
 */
const cards = computed<Card[]>(() => [
    ...props.connections
        .filter((connection) => isNativeProvider(connection.provider))
        .map(
            (connection): Card => ({
                kind: 'connection',
                key: `connection-${connection.id}`,
                connection,
            }),
        ),
    ...openProviders.value.map(
        (provider): Card => ({ kind: 'provider', key: `provider-${provider}`, provider }),
    ),
    ...props.connections
        .filter((connection) => !isNativeProvider(connection.provider))
        .map(
            (connection): Card => ({
                kind: 'connection',
                key: `connection-${connection.id}`,
                connection,
            }),
        ),
])

/**
 * The aggregators that are not set up yet.
 *
 * One is a button and two are a chooser — but either way it is one quiet
 * line, below the providers the operator connects themselves.
 */
const addableAggregators = computed(() =>
    Object.entries(props.config?.aggregators ?? {}).filter(([, entry]) => !entry.configured),
)

/** The aggregator whose panel is open, and the key typed into it. */
const openAggregator = ref<string | null>(null)
const apiKey = ref('')

/**
 * The aggregator's name, as the operator knows it.
 *
 * The backend sends it: the operator knows Zernio as a product they have an
 * account with, and *aggregator* is our word, not theirs.
 */
function aggregatorLabel(slug: string): string {
    return props.config?.aggregators[slug]?.label ?? slug
}

/**
 * Whether a connection is an aggregator's.
 *
 * The plugin's own logins are the only providers it knows; anything else is
 * an aggregator's slug — and the slug is the route its accounts publish
 * through.
 */
function isAggregator(connection: SocialConnection): boolean {
    return !isNativeProvider(connection.provider)
}

/** The connection's name — the login's, or the aggregator's own. */
function connectionLabel(connection: SocialConnection): string {
    if (isAggregator(connection)) return aggregatorLabel(connection.provider)
    return providerLabel(connection.provider)
}

/** The name of the network an account is on. */
function accountLabel(account: SocialConnection['accounts'][number]): string {
    return networkLabel(account.platform, props.config?.rules ?? {})
}

/**
 * The rule of the account's own channel.
 *
 * The aggregator's rows are the aggregator's limits, and they differ from
 * the plugin's own for the same network — so the aggregator's accounts show
 * the rule that will be enforced on them. A native account does not: the
 * plugin's own limits are the network's own, and a limit is not what an
 * account card is for.
 */
function accountRule(account: SocialConnection['accounts'][number]) {
    return props.config?.rules?.[channelKey(account.via, account.platform)]
}

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

/** Open the panel for one aggregator. */
function openAggregatorPanel(slug: string): void {
    openAggregator.value = slug
    apiKey.value = ''
}

/** Close the panel without saving. */
function closeAggregatorPanel(): void {
    openAggregator.value = null
    apiKey.value = ''
}

/** Hand the key over. */
function saveAggregator(): void {
    if (openAggregator.value === null) return
    emit('addAggregator', openAggregator.value, apiKey.value)
    closeAggregatorPanel()
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
            <template v-for="card in cards" :key="card.key">
                <section
                    v-if="card.kind === 'connection'"
                    class="surface-card p-4"
                    :data-test="`connection-${card.connection.id}`"
                >
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="provider-chip" :data-provider="card.connection.provider">
                            {{ connectionLabel(card.connection) }}
                        </span>
                        <span
                            v-if="isAggregator(card.connection)"
                            class="pill pill-neutral"
                            data-test="aggregator-chip"
                        >
                            {{ t('Aggregator') }}
                        </span>
                        <span class="pill" :class="connectionStatusClass(card.connection.status)">
                            {{ connectionStatusLabel(card.connection.status) }}
                        </span>
                        <span v-if="card.connection.needs_reconnect" class="pill pill-expiring">
                            {{ t('Needs reconnect') }}
                        </span>
                        <span class="ml-auto text-xs text-muted-foreground" :data-test="`connection-token-${card.connection.id}`">
                            {{ connectionExpiryNote(card.connection) }}
                        </span>
                    </div>

                    <p
                        v-if="isAggregator(card.connection)"
                        class="mt-2 text-[11px] leading-relaxed text-muted-foreground"
                        :data-test="`aggregator-note-${card.connection.id}`"
                    >
                        {{
                            t('The accounts are managed in {aggregator}.', {
                                aggregator: aggregatorLabel(card.connection.provider),
                            })
                        }}
                    </p>

                    <p v-if="card.connection.scopes.length > 0" class="mt-2 text-[11px] text-muted-foreground">
                        {{ t('Scopes') }}: {{ card.connection.scopes.join(', ') }}
                    </p>

                    <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <div
                            v-for="account in card.connection.accounts"
                            :key="account.id"
                            class="rounded-lg border border-border p-3"
                            :data-test="`connection-account-${account.id}`"
                        >
                            <div class="flex items-center gap-2">
                                <span
                                    class="platform-chip"
                                    :data-network="account.platform"
                                    :style="{ '--network-color': brandColorVar(account.platform) }"
                                >
                                    {{ accountLabel(account) }}
                                </span>
                                <span class="min-w-0 flex-1 truncate text-sm font-medium">
                                    {{ account.display_name }}
                                </span>
                            </div>
                            <div class="mt-1 truncate text-xs text-muted-foreground">
                                {{ account.username }} · {{ account.kind }}
                            </div>
                            <p
                                v-if="isAggregator(card.connection) && accountRule(account)"
                                class="mt-1.5 text-[11px] leading-relaxed text-muted-foreground"
                                :data-test="`account-rule-${account.id}`"
                            >
                                {{ accountRule(account)!.media_note }}
                            </p>
                            <div v-if="account.followers !== null" class="mt-2 text-xs text-muted-foreground">
                                {{ t('Audience') }}:
                                <span class="font-medium tabular-nums text-foreground">
                                    {{ account.followers.toLocaleString() }}
                                </span>
                            </div>
                            <span
                                v-if="account.status === 'disconnected'"
                                class="pill pill-partial mt-2"
                                :data-test="`account-disconnected-${account.id}`"
                            >
                                {{ t('Disconnected') }}
                            </span>
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
                        <!-- An aggregator has no token to renew and no login to
                             close: the key is replaced by pasting a new one, and
                             the accounts stay where they are. So it offers the
                             two things that do something. -->
                        <button
                            v-if="isAggregator(card.connection)"
                            type="button"
                            class="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                            :data-test="`aggregator-sync-${card.connection.id}`"
                            @click="emit('syncAggregator', card.connection.provider)"
                        >
                            <RefreshCw class="h-3 w-3" />
                            {{ t('Sync now') }}
                        </button>
                        <button
                            v-if="isAggregator(card.connection)"
                            type="button"
                            class="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium text-destructive transition-colors hover:bg-muted"
                            :data-test="`aggregator-forget-${card.connection.id}`"
                            @click="emit('forgetAggregator', card.connection.provider)"
                        >
                            <Trash class="h-3 w-3" />
                            {{ t('Forget this key') }}
                        </button>

                        <!-- A connection with no expiry has nothing to renew:
                             the backend hands the token back unchanged. A button
                             that cannot do anything reads as a broken one. The
                             rule is the expiry the platform sent — null when it
                             sent none — and not the provider. -->
                        <button
                            v-if="!isAggregator(card.connection) && card.connection.expires_at !== null"
                            type="button"
                            class="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                            :data-test="`connection-refresh-${card.connection.id}`"
                            @click="emit('refresh', card.connection)"
                        >
                            <RefreshCw class="h-3 w-3" />
                            {{ t('Refresh token') }}
                        </button>
                        <button
                            v-if="!isAggregator(card.connection)"
                            type="button"
                            class="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium text-destructive transition-colors hover:bg-muted"
                            :data-test="`connection-disconnect-${card.connection.id}`"
                            @click="emit('disconnect', card.connection)"
                        >
                            <Trash class="h-3 w-3" />
                            {{ t('Disconnect') }}
                        </button>
                        <span v-if="needsAttention(card.connection)" class="text-[11px] text-amber-600 dark:text-amber-400">
                            {{ t('This connection will not publish until it is renewed.') }}
                        </span>
                    </div>
                </section>

                <section
                    v-else
                    class="surface-card p-4"
                    :data-test="`provider-${card.provider}`"
                >
                    <div class="flex items-center justify-between gap-3">
                        <span class="provider-chip" :data-provider="card.provider">
                            {{ providerLabel(card.provider) }}
                        </span>
                        <div class="flex items-center gap-2">
                            <button
                                type="button"
                                class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                                :data-test="`setup-guide-${card.provider}`"
                                @click="emit('guide', card.provider)"
                            >
                                <BookOpen class="h-3.5 w-3.5" />
                                {{ t('Setup guide') }}
                            </button>
                            <button
                                type="button"
                                class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                                :data-test="`connect-${card.provider}`"
                                @click="emit('connect', card.provider)"
                            >
                                <Plus class="h-3.5 w-3.5" />
                                {{ t('Connect {provider}', { provider: providerLabel(card.provider) }) }}
                            </button>
                        </div>
                    </div>

                    <!-- The wording is the backend's: the plugin knows what a
                         provider needs and what it is called, and it emits the
                         wording for the host to translate. A copy here would be a
                         second wording to keep in step. -->
                    <div
                        v-if="setupNotice(card.provider) !== null"
                        class="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
                        :data-test="`setup-${card.provider}`"
                    >
                        <p class="text-xs font-medium" :data-test="`setup-title-${card.provider}`">
                            {{ setupNotice(card.provider)!.title }}
                        </p>
                        <p class="mt-1 text-[11px] leading-relaxed text-muted-foreground" :data-test="`setup-body-${card.provider}`">
                            {{ setupNotice(card.provider)!.body }}
                        </p>
                    </div>
                </section>
            </template>

            <!-- The aggregator is one quiet line, below the providers the
                 operator connects themselves. It is not a peer of them, and
                 it is the only place it appears before it is set up. -->
            <div v-if="addableAggregators.length > 0" data-test="add-aggregator">
                <button
                    v-if="addableAggregators.length === 1"
                    type="button"
                    class="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    :data-test="`add-aggregator-${addableAggregators[0]![0]}`"
                    @click="openAggregatorPanel(addableAggregators[0]![0])"
                >
                    <Plus class="h-3.5 w-3.5" />
                    {{ t('Add {aggregator}', { aggregator: aggregatorLabel(addableAggregators[0]![0]) }) }}
                </button>
                <div v-else class="flex flex-wrap items-center gap-2">
                    <span class="text-xs text-muted-foreground">{{ t('Add an aggregator') }}</span>
                    <button
                        v-for="[slug, entry] in addableAggregators"
                        :key="slug"
                        type="button"
                        class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                        :data-test="`add-aggregator-${slug}`"
                        @click="openAggregatorPanel(slug)"
                    >
                        <Plus class="h-3.5 w-3.5" />
                        {{ t('Add {aggregator}', { aggregator: entry.label }) }}
                    </button>
                </div>

                <div
                    v-if="openAggregator !== null"
                    class="surface-card mt-2 p-4"
                    data-test="aggregator-panel"
                >
                    <h3 class="text-sm font-semibold">
                        {{ t('Add {aggregator}', { aggregator: aggregatorLabel(openAggregator) }) }}
                    </h3>
                    <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {{
                            t('{aggregator} publishes to the networks Spora does not reach itself — Bluesky, Threads, TikTok and the rest.', {
                                aggregator: aggregatorLabel(openAggregator),
                            })
                        }}
                    </p>
                    <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {{
                            t('Your accounts stay in {aggregator}; paste the API key from Settings → API keys in your {aggregator} dashboard.', {
                                aggregator: aggregatorLabel(openAggregator),
                            })
                        }}
                    </p>

                    <div class="mt-3">
                        <label class="field-label" for="aggregator-api-key">{{ t('API key') }}</label>
                        <input
                            id="aggregator-api-key"
                            v-model="apiKey"
                            type="password"
                            class="h-8 w-full rounded-lg border border-border bg-background px-2 text-xs"
                            data-test="aggregator-api-key"
                        />
                    </div>

                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="inline-flex h-8 items-center rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                            data-test="aggregator-save"
                            @click="saveAggregator"
                        >
                            {{ t('Save the key') }}
                        </button>
                        <button
                            type="button"
                            class="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                            data-test="aggregator-cancel"
                            @click="closeAggregatorPanel"
                        >
                            {{ t('Cancel') }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
