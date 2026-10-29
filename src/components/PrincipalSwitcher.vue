<script setup lang="ts">
/**
 * The principal switcher, at the top of the rail.
 *
 * **Labelled "Working as", not "Publishing as".** "Publishing as" describes what
 * this plugin happens to do; the switcher describes the tenancy, and the same
 * control belongs in every plugin.
 *
 * **At the top of the rail**, not the bottom: a control that opens the context
 * should not be the last thing in the sidebar, below five tabs of navigation.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Users } from 'lucide-vue-next'
import { usePrincipalSwitcher } from '../composables/usePrincipalSwitcher'
import type { Principal } from '../api/principals'

const { t } = useI18n()
const { principals, selected, select } = usePrincipalSwitcher()

const open = ref(false)

/** A type glyph rather than an avatar: the host has no portrait for a principal. */
function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((part) => /[a-z0-9]/i.test(part))
        .slice(0, 2)
        // `[...part][0]`, not `charAt(0)`: a word can pass the filter above on an ASCII letter while
        // *starting* with an astral one ("🚀 Team"), and `charAt` indexes UTF-16 units.
        .map((part) => [...part][0]!.toUpperCase())
        .join('')
}

function isUser(principal: Principal): boolean {
    return principal.type === 'user'
}

/** `/principals/me` carries no membership role, so the read/write split is stated once. */
function sublabel(principal: Principal): string {
    return isUser(principal) ? t('Personal') : t('Group')
}

async function choose(id: number): Promise<void> {
    open.value = false
    await select(id)
}
</script>

<template>
    <div class="relative" data-test="principal-switcher">
        <span class="field-label">{{ t('Working as') }}</span>

        <button
            type="button"
            class="flex w-full items-center gap-2.5 rounded-lg border border-border bg-background px-2.5 py-2 text-left shadow-sm transition-colors hover:bg-muted"
            aria-haspopup="menu"
            :aria-expanded="open"
            data-test="principal-trigger"
            @click="open = !open"
        >
            <span
                v-if="selected && isUser(selected)"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
            >
                {{ selected ? initials(selected.name) : '' }}
            </span>
            <span
                v-else
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
                <Users class="h-3.5 w-3.5" />
            </span>
            <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ selected?.name ?? t('No principal') }}</span>
                <span class="block truncate text-[10px] text-muted-foreground">
                    {{ selected ? sublabel(selected) : '' }}
                </span>
            </span>
            <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <div
            v-if="open"
            class="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border border-border bg-background p-1 shadow-lg"
            role="menu"
            :aria-label="t('Choose a principal')"
            data-test="principal-menu"
        >
            <button
                v-for="principal in principals.principals"
                :key="principal.id"
                type="button"
                role="menuitemradio"
                :aria-checked="principals.selectedPrincipalId === principal.id"
                class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                :data-test="`principal-option-${principal.id}`"
                @click="choose(principal.id)"
            >
                <span
                    v-if="isUser(principal)"
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
                >
                    {{ initials(principal.name) }}
                </span>
                <span
                    v-else
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                >
                    <Users class="h-3.5 w-3.5" />
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-xs font-semibold">{{ principal.name }}</span>
                    <span class="block truncate text-[10px] text-muted-foreground">{{ sublabel(principal) }}</span>
                </span>
                <Check v-if="principals.selectedPrincipalId === principal.id" class="h-3.5 w-3.5 shrink-0" />
            </button>

            <!-- Said once, before the operator spends an edit finding out: membership is not
                 ownership, and suppressing a group you cannot write to would be a lie about what
                 exists. -->
            <p class="mt-1 border-t border-border px-2 pt-2 text-[11px] leading-snug text-muted-foreground">
                {{ t('You can read every group you belong to. Writing needs to be an owner or an admin.') }}
            </p>
        </div>
    </div>
</template>
