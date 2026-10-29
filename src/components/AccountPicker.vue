<script setup lang="ts">
/**
 * The accounts a post goes to.
 *
 * The composer picks an *account*, and the accounts arrive inside their
 * connection — so they are flattened before they get here. The token is not
 * on the account any more: it belongs to the connection, and the connection
 * card is where its health is shown.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLATFORM_LABELS } from '../lib/platforms'
import type { Platform, SocialAccount } from '../types'

const props = defineProps<{
    /** The accounts to choose from. */
    accounts: SocialAccount[]
    /** The chosen account ids. */
    modelValue: number[]
}>()

const emit = defineEmits<{
    'update:modelValue': [ids: number[]]
}>()

const { t } = useI18n()

const accountsByPlatform = computed(() =>
    props.accounts.reduce(
        (groups, account) => {
            groups[account.platform].push(account)
            return groups
        },
        { linkedin: [], facebook: [], instagram: [] } as Record<Platform, SocialAccount[]>,
    ),
)

const platformsWithAccounts = computed(() =>
    (Object.keys(accountsByPlatform.value) as Platform[]).filter(
        (platform) => accountsByPlatform.value[platform].length > 0,
    ),
)

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
        <div v-for="platform in platformsWithAccounts" :key="platform">
            <div class="flex items-center gap-2">
                <span class="platform-chip" :data-platform="platform">
                    {{ PLATFORM_LABELS[platform] }}
                </span>
            </div>
            <div class="mt-1.5 space-y-1">
                <label
                    v-for="account in accountsByPlatform[platform]"
                    :key="account.id"
                    class="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 transition-colors hover:bg-muted/50"
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
                            {{ PLATFORM_LABELS[platform] }} · {{ account.kind }}
                        </span>
                    </span>
                </label>
            </div>
        </div>

        <p v-if="platformsWithAccounts.length === 0" class="text-xs text-muted-foreground">
            {{ t('Connect an account to publish to it.') }}
        </p>
    </div>
</template>
