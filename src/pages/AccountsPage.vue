<script setup lang="ts">
/**
 * The accounts screen: the connections of the principal, and the accounts each
 * one covers.
 *
 * The connect flow is a task, not a place — nobody links to "the LinkedIn
 * connect dialog" — so it is a button here and a query the backend redirects
 * back with.
 */
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import ConnectionsGrid from '../components/ConnectionsGrid.vue'
import { useSocialStore } from '../stores/social'
import { needsAttention, providerLabel } from '../lib/providers'
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

onMounted(async () => {
    if (principalId.value === null) return
    await Promise.all([social.loadConnections(principalId.value), social.loadConfig()])
})

watch(principalId, async (next, prev) => {
    if (next === null || next === prev) return
    await social.loadConnections(next)
})

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
</script>

<template>
    <div class="space-y-5" data-test="accounts-page">
        <ConnectionsGrid
            :connections="social.connections"
            :config="social.config"
            @connect="connect"
            @refresh="refresh"
            @disconnect="disconnect"
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
                            {{ providerLabel(connection.provider) }}
                        </span>
                        <button
                            type="button"
                            class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[11px] font-medium transition-colors hover:bg-muted"
                            :data-test="`connection-reconnect-${connection.id}`"
                            @click="connect(connection.provider)"
                        >
                            <RefreshCw class="h-3 w-3" />
                            {{ t('Reconnect') }}
                        </button>
                    </div>
                    <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {{ t('This connection will not publish until it is renewed.') }}
                    </p>
                </div>
            </div>
        </section>
    </div>
</template>
