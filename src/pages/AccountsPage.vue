<script setup lang="ts">
/**
 * The accounts screen: the connections of the principal, and the accounts each
 * one covers.
 *
 * The connect flow is a task, not a place — nobody links to "the LinkedIn
 * connect dialog" — so it is a button here and a query the backend redirects
 * back with.
 *
 * **The setup guide is opened from here.** The app id, the secret and the
 * configuration id live in Settings → Plugins, and the redirect URL has to be
 * registered with the platform — so the screen carries an overlay that says
 * where to go and shows the URL to copy.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { RefreshCw } from 'lucide-vue-next'
import ConnectionsGrid from '../components/ConnectionsGrid.vue'
import ProviderSetupOverlay from '../components/ProviderSetupOverlay.vue'
import { useSocialStore } from '../stores/social'
import { isNativeProvider, needsAttention, providerLabel } from '../lib/providers'
import type { Provider, SocialConnection } from '../types'

const { t } = useI18n()
const route = useRoute()
const social = useSocialStore()

const principalId = computed(() => {
    const raw = route.params.principalId
    const id = Number(raw)
    return Number.isSafeInteger(id) && id > 0 ? id : null
})

/** The connections whose token will not publish until it is renewed. */
const attention = computed(() => social.connections.filter((connection) => needsAttention(connection)))

/** The provider whose guide is open, or null when none is. */
const guideProvider = ref<Provider | null>(null)

/**
 * The redirect URL the open guide shows.
 *
 * It is the backend's — built from the address this instance is reached at —
 * so it is read from the config rather than assembled here.
 */
const guideRedirectUri = computed(() => {
    if (guideProvider.value === null) return null

    return social.config?.providers[guideProvider.value]?.redirect_uri ?? null
})

onMounted(async () => {
    if (principalId.value === null) return
    await Promise.all([social.loadConnections(principalId.value), social.loadConfig(principalId.value)])
})

watch(principalId, async (next, prev) => {
    if (next === null || next === prev) return
    await social.loadConnections(next)
})

/**
 * The connection's name — the login's, or the aggregator's own.
 *
 * The aggregator's name comes from the backend: the operator knows it as a
 * product, and *aggregator* is our word, not theirs.
 */
function connectionLabel(connection: SocialConnection): string {
    if (isNativeProvider(connection.provider)) return providerLabel(connection.provider)
    return social.config?.aggregators[connection.provider]?.label ?? connection.provider
}

/**
 * Start the OAuth round trip.
 *
 * The backend signs a `state` that carries the principal, the provider and a
 * nonce, and answers with the URL the browser has to visit.
 *
 * A provider that is not configured is **not** refused here: the backend
 * refuses it with the sentence that says what to add and where, and that
 * sentence is worth more than one written here.
 */
async function connect(provider: Provider): Promise<void> {
    if (principalId.value === null) return

    const result = await social.connectProvider(principalId.value, provider)
    if (result === null) return

    window.location.href = result.authorize_url
}

async function refresh(connection: SocialConnection): Promise<void> {
    if (principalId.value === null) return
    await social.refreshConnection(principalId.value, connection.id)
}

async function disconnect(connection: SocialConnection): Promise<void> {
    if (principalId.value === null) return
    await social.disconnectConnection(principalId.value, connection.id)
}

/**
 * Open the guide for a provider.
 *
 * The URL it shows is the backend's, so the config is read before the overlay
 * opens — a guide that opened without it would name no address and send the
 * operator looking for one.
 */
async function openGuide(provider: Provider): Promise<void> {
    await social.loadConfig(principalId.value ?? 0)

    guideProvider.value = provider
}

/**
 * Store the aggregator's key.
 *
 * The key is written here and nowhere else: the agent's tools have no way to
 * write a credential, because a credential belongs where a person can see
 * it, replace it and revoke it.
 */
async function addAggregator(aggregator: string, apiKey: string): Promise<void> {
    if (principalId.value === null) return

    const result = await social.setAggregatorKey(principalId.value, aggregator, apiKey)
    if (result === null) return

    social.setNotice(t('The key is saved.'))
}

/**
 * Forget the aggregator's key.
 *
 * The accounts stay in the aggregator — they are its accounts, and the
 * operator removes them there.
 */
async function forgetAggregator(aggregator: string): Promise<void> {
    if (principalId.value === null) return

    const result = await social.forgetAggregator(principalId.value, aggregator)
    if (result === null) return

    social.setNotice(
        t('The key is forgotten. The accounts stay in {aggregator} — remove them there if you do not want them published to any more.', {
            aggregator: social.config?.aggregators[aggregator]?.label ?? aggregator,
        }),
    )
}

/** The aggregator's accounts, read again. */
async function syncAggregator(aggregator: string): Promise<void> {
    if (principalId.value === null) return
    await social.syncAggregator(principalId.value, aggregator)
}
</script>

<template>
    <div class="space-y-5" data-test="accounts-page">
        <ConnectionsGrid
            :connections="social.connections"
            :config="social.config"
            @connect="connect"
            @refresh="refresh"
            @disconnect="disconnect"
            @guide="openGuide"
            @add-aggregator="addAggregator"
            @forget-aggregator="forgetAggregator"
            @sync-aggregator="syncAggregator"
        />

        <ProviderSetupOverlay
            :open="guideProvider !== null"
            :provider="guideProvider"
            :redirect-uri="guideRedirectUri"
            @close="guideProvider = null"
        />

        <section>
            <h2 class="mb-3 text-sm font-semibold">{{ t('Needs attention') }}</h2>
            <p v-if="attention.length === 0" class="text-sm text-muted-foreground">
                {{ t('Every connection has a healthy token.') }}
            </p>
            <div v-else class="space-y-2">
                <div
                    v-for="connection in attention"
                    :key="connection.id"
                    class="rounded-lg border border-border p-3"
                    :data-test="`connection-attention-${connection.id}`"
                >
                    <div class="flex items-center gap-2">
                        <span class="min-w-0 flex-1 truncate text-sm font-medium">
                            {{ connectionLabel(connection) }}
                        </span>
                        <button
                            v-if="isNativeProvider(connection.provider)"
                            type="button"
                            class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                            :data-test="`connection-reconnect-${connection.id}`"
                            @click="connect(connection.provider)"
                        >
                            <RefreshCw class="h-3 w-3" />
                            {{ t('Reconnect') }}
                        </button>
                        <button
                            v-else
                            type="button"
                            class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                            :data-test="`connection-sync-${connection.id}`"
                            @click="syncAggregator(connection.provider)"
                        >
                            <RefreshCw class="h-3 w-3" />
                            {{ t('Sync now') }}
                        </button>
                    </div>
                    <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {{
                            isNativeProvider(connection.provider)
                                ? t('This connection will not publish until it is renewed.')
                                : t('This connection will not publish until the key is replaced.')
                        }}
                    </p>
                </div>
            </div>
        </section>
    </div>
</template>
