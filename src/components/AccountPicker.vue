<script setup lang="ts">
/**
 * The accounts a post goes to.
 *
 * **One picker, grouped by route.** Everything the operator can post to is in
 * one place: the accounts the plugin reaches on its own under *Direct*, and
 * the accounts an aggregator reaches under the aggregator's own name. The
 * composer stays one flow.
 *
 * **Only the accounts the plugin can publish to are offered.** A network the
 * plugin does not reach has no rules row — no limits, no name, no colour —
 * and offering the account would be a control that cannot do anything.
 *
 * The token is not on the account: it belongs to the connection, and the
 * connection card is where its health is shown.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { brandColorVar, channelKey, DIRECT_ROUTE, networkLabel, routeLabel } from '../lib/platforms'
import type { SocialAccount, SocialConfig } from '../types'

const props = defineProps<{
    /** The accounts to choose from. */
    accounts: SocialAccount[]
    /** The chosen account ids. */
    modelValue: number[]
    /**
     * The plugin's configuration.
     *
     * It carries the rules — which channels the plugin can publish to — and
     * the aggregators' names, which are the group headings.
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
 * Whether the account can be published to at all.
 *
 * A config that has not arrived is not the same answer as a channel without
 * a rule: the rules are *unknown* then, and refusing every account would
 * leave the operator with nothing to publish to.
 */
function isOffered(account: SocialAccount): boolean {
    if (!props.config) return true
    return rules.value[channelKey(account.via, account.platform)] !== undefined
}

/**
 * The name of a route.
 *
 * The plugin's own route has a name of its own; an aggregator's is the name
 * the operator knows it by, which the backend sends.
 */
function labelOfRoute(via: string): string {
    return routeLabel(via, props.config?.aggregators ?? {})
}

/**
 * The accounts, grouped by the route they publish through.
 *
 * The plugin's own route comes first and the aggregators follow it, in the
 * order the backend names them — so the accounts the operator connects
 * directly are the ones they see first.
 */
const groups = computed(() => {
    const byRoute = new Map<string, SocialAccount[]>()

    for (const account of props.accounts) {
        if (!isOffered(account)) continue
        const list = byRoute.get(account.via) ?? []
        list.push(account)
        byRoute.set(account.via, list)
    }

    const routes = [...byRoute.keys()].sort((a, b) => {
        if (a === b) return 0
        if (a === DIRECT_ROUTE) return -1
        if (b === DIRECT_ROUTE) return 1
        return a.localeCompare(b)
    })

    return routes.map((via) => ({
        via,
        label: labelOfRoute(via),
        accounts: byRoute.get(via) ?? [],
    }))
})

/** The name of the network an account is on. */
function labelFor(network: string): string {
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
    <div class="space-y-3" data-test="account-picker">
        <div v-for="group in groups" :key="group.via" :data-test="`route-group-${group.via}`">
            <div class="flex items-center gap-2">
                <span class="field-label mb-0" :data-test="`route-group-label-${group.via}`">
                    {{ group.label }}
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
                    <span
                        class="platform-chip shrink-0"
                        :data-network="account.platform"
                        :style="{ '--network-color': brandColorVar(account.platform) }"
                    >
                        {{ labelFor(account.platform) }}
                    </span>
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
