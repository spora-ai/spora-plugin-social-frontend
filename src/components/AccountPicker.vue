<script setup lang="ts">
/**
 * The accounts a post goes to.
 *
 * The composer picks an *account*, and the accounts arrive inside their
 * connection — so they are flattened before they get here. The token is not
 * on the account any more: it belongs to the connection, and the connection
 * card is where its health is shown.
 *
 * **The name of a network comes from the backend's rules.** A copy here is
 * where a name goes stale, and the aggregator brings networks this frontend
 * has never heard of.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { brandColorVar, networkLabel, routeLabel } from '../lib/platforms'
import type { Network, Route, SocialAccount, SocialConfig } from '../types'

const props = defineProps<{
    /** The accounts to choose from. */
    accounts: SocialAccount[]
    /** The chosen account ids. */
    modelValue: number[]
    /**
     * The plugin's configuration.
     *
     * It carries the rules, and the rules carry the networks' names.
     */
    config: SocialConfig | null
}>()

const emit = defineEmits<{
    'update:modelValue': [ids: number[]]
}>()

const { t } = useI18n()

/**
 * The rules the backend sent, keyed by the channel's key.
 *
 * Empty until the config has arrived, and empty for good when it could not
 * be read: the rules are the backend's, and the frontend keeps no copy.
 */
const rules = computed(() => props.config?.rules ?? {})

/**
 * The accounts, grouped by the network they are on.
 *
 * A network on two routes is one group with two rows: the accounts are
 * different, and the row says which route it publishes through.
 */
const groups = computed(() => {
    const byNetwork: Record<string, SocialAccount[]> = {}

    for (const account of props.accounts) {
        const list = byNetwork[account.platform] ?? []
        list.push(account)
        byNetwork[account.platform] = list
    }

    return Object.entries(byNetwork).map(([network, accounts]) => ({ network, accounts }))
})

/**
 * The name of a route.
 *
 * The plugin's own route has a name of its own; an aggregator's is the name
 * the operator knows it by, which the backend sends.
 */
function labelOfRoute(via: Route): string {
    return routeLabel(via, props.config?.aggregators ?? {})
}

/** The name of the network an account is on. */
function labelFor(network: Network): string {
    return networkLabel(network, rules.value)
}

function isTargeted(id: number): boolean {
    return props.modelValue.includes(id)
}

function toggle(id: number): void {
    const next = isTargeted(id)
        ? props.modelValue.filter((chosen) => chosen !== id)
        : [...props.modelValue, id]
    emit('update:modelValue', next)
}
</script>

<template>
    <div class="space-y-2" data-test="account-picker">
        <div v-for="group in groups" :key="group.network">
            <div class="flex items-center gap-2">
                <span
                    class="platform-chip"
                    :data-network="group.network"
                    :style="{ '--network-color': brandColorVar(group.network) }"
                >
                    {{ labelFor(group.network) }}
                </span>
            </div>
            <div class="mt-1.5 space-y-1">
                <label
                    v-for="account in group.accounts"
                    :key="account.id"
                    class="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50"
                    :data-test="`target-row-${account.id}`"
                >
                    <input
                        type="checkbox"
                        class="h-3.5 w-3.5 accent-[hsl(var(--foreground))]"
                        :checked="isTargeted(account.id)"
                        :data-test="`target-${account.id}`"
                        @change="toggle(account.id)"
                    />
                    <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm font-medium">{{ account.display_name }}</span>
                        <span class="block truncate text-[11px] text-muted-foreground">
                            {{ account.kind }} · {{ labelOfRoute(account.via) }}
                        </span>
                    </span>
                </label>
            </div>
        </div>

        <p v-if="groups.length === 0" class="text-xs text-muted-foreground">
            {{ t('Connect an account to publish to it.') }}
        </p>
    </div>
</template>
