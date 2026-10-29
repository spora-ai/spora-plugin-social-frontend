<script setup lang="ts">
/**
 * The app's shell: the rail (principal switcher, navigation, theme toggle) and
 * the main column (the tab's title and the resolved page).
 *
 * **The URL and the acting principal are reconciled here, before the first
 * read.** An absent `p/{pid}` resolves to the caller's own, and a principal
 * the caller cannot act as falls back to the default *and* has its path
 * rewritten — so the address bar stops claiming a scope the app is not
 * showing.
 *
 * `#spora-plugin-social` is the CSS scope every Tailwind utility nests beneath
 * (`tailwind.config.ts → important`); removing it unscopes the plugin's CSS
 * into the host.
 */
import { computed, onMounted, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { CalendarDays, List, PenLine, Plus, Users } from 'lucide-vue-next'
import PrincipalSwitcher from './components/PrincipalSwitcher.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import { usePrincipalsStore } from './stores/principals'
import { useSocialStore } from './stores/social'
import { canonicalLocalPath, principalIdInLocalPath } from './lib/hostRoute'
import { accountsPath, calendarPath, composePath, postsPath, type RailSection } from './lib/paths'
import { tabForRouteName } from './lib/routes'
import './style.css'

const props = defineProps<{
    hostContext: import('./shims').PluginHostContext
}>()

defineExpose({ hostContext: props.hostContext })

const principals = usePrincipalsStore()
const social = useSocialStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const TABS: { key: RailSection; label: string; hint: string; icon: Component }[] = [
    { key: 'compose', label: t('Compose'), hint: t('Write a post and send it anywhere'), icon: PenLine },
    { key: 'calendar', label: t('Calendar'), hint: t('What goes out when'), icon: CalendarDays },
    { key: 'posts', label: t('Posts'), hint: t('Every post, in every state'), icon: List },
    { key: 'accounts', label: t('Accounts'), hint: t('The accounts you publish to'), icon: Users },
]

const pathPrincipalId = computed(() => principalIdInLocalPath(route.path))

const principalId = computed(() => principals.selectedPrincipalId)

const activeTab = computed<RailSection | null>(() => tabForRouteName(route.name))

const currentTab = computed(() => TABS.find((tab) => tab.key === activeTab.value) ?? TABS[0]!)

/**
 * Said once, when the URL names a principal the caller cannot act as — a
 * shared link to a group you have since left. The alternative blames the app
 * for a scope problem.
 */
const principalNotice = ref<string | null>(null)

/**
 * Put the acting principal into the URL, and the URL's principal into the
 * store. An inaccessible one falls back to the default *and* has its path
 * rewritten; a principal-less path is canonicalised too.
 */
function reconcilePrincipal(): void {
    const named = pathPrincipalId.value
    const resolved = principals.isVisible(named) ? named : principals.defaultPrincipalId()

    if (!principals.isVisible(named) && named !== null) {
        const name = principals.principals.find((p) => p.id === resolved)?.name ?? t('your own')
        principalNotice.value = `${t('That principal is not one of yours — showing')} ${name} ${t('instead.')}`
    }

    // Only act once there *is* one — a null principal names nothing.
    if (resolved === null) return

    if (principals.selectedPrincipalId !== resolved) {
        principals.selectPrincipal(resolved)
    }

    const canonical = canonicalLocalPath(route.path, route.name, resolved)
    if (canonical !== null && canonical !== route.path) {
        // The query travels: the OAuth callback comes back with
        // `?connected={platform}`, and the notice reads it from the URL.
        void router.replace({ path: canonical, query: route.query }).catch(() => {})
    }
}

onMounted(async () => {
    // The principal list first: nothing below can resolve an acting principal until it answers.
    await principals.ensureLoaded()
    reconcilePrincipal()
    // The rules every screen reads travel with the config, and the composer
    // needs them before it can count a body.
    await social.loadConfig()
    if (principalId.value !== null) await social.loadConnections(principalId.value)
})

// A host navigation can land on a principal the store is not on yet; the `replace` mirrors back
// into the host path via `main.ts`, so this converges rather than ping-pongs. The notice is *not*
// cleared — a path change is often this very handler raising it.
watch(pathPrincipalId, () => {
    reconcilePrincipal()
})

// The accounts belong to the principal, so a scope change re-reads them.
watch(principalId, (next, prev) => {
    if (next === null || next === prev) return
    void social.loadConnections(next)
})

/**
 * The rail's links are links, not buttons: a tab that is only a JavaScript
 * variable cannot be middle-clicked, copied or bookmarked.
 *
 * They are scoped to the acting principal, so they cannot be built before it
 * is known — and the rail waits for it rather than linking to a scope nobody
 * chose.
 */
const navPaths = computed<Record<RailSection, string> | null>(() => {
    const pid = principalId.value
    if (pid === null) return null
    return {
        compose: composePath(pid),
        calendar: calendarPath(pid),
        posts: postsPath(pid),
        accounts: accountsPath(pid),
    }
})

/** "New post" goes to the composer. */
async function newPost(): Promise<void> {
    if (principalId.value === null) return
    await router.push(composePath(principalId.value))
}
</script>

<template>
    <div id="spora-plugin-social" class="flex min-h-[70vh] flex-col">
        <div
            v-if="principalNotice"
            class="border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            data-test="principal-notice"
        >
            {{ principalNotice }}
        </div>

        <div
            v-if="social.notice"
            class="border-b border-border bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            data-test="app-notice"
        >
            {{ social.notice }}
        </div>

        <div
            v-if="social.error"
            class="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive"
            data-test="app-error"
        >
            {{ social.error }}
        </div>

        <div class="flex min-h-0 flex-1">
            <aside class="flex w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/20">
                <div class="shrink-0 border-b border-border p-3" data-test="principal-switcher-slot">
                    <PrincipalSwitcher />
                </div>

                <nav v-if="navPaths !== null" class="flex-1 space-y-0.5 p-2" :aria-label="t('Sections')">
                    <RouterLink
                        v-for="tab in TABS"
                        :key="tab.key"
                        :to="navPaths[tab.key]"
                        :aria-current="activeTab === tab.key ? 'page' : undefined"
                        :class="activeTab === tab.key
                            ? 'bg-foreground text-background font-medium'
                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
                        class="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors"
                        :data-test="`nav-${tab.key}`"
                    >
                        <component :is="tab.icon" class="h-4 w-4" />
                        {{ tab.label }}
                    </RouterLink>
                </nav>

                <div class="shrink-0 border-t border-border p-2">
                    <ThemeToggle />
                </div>
            </aside>

            <div class="flex min-h-0 min-w-0 flex-1 flex-col">
                <header class="shrink-0 border-b border-border bg-background">
                    <div class="flex h-14 items-center gap-3 px-6">
                        <h1 class="text-sm font-semibold" data-test="tab-title">{{ currentTab.label }}</h1>
                        <span class="text-xs text-muted-foreground">{{ currentTab.hint }}</span>
                        <div class="ml-auto flex items-center gap-2">
                            <button
                                type="button"
                                class="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                                data-test="new-post"
                                @click="newPost"
                            >
                                <Plus class="h-3.5 w-3.5" />
                                {{ t('New post') }}
                            </button>
                        </div>
                    </div>
                </header>

                <main class="min-h-0 flex-1 overflow-y-auto px-6 py-5" data-test="app-main">
                    <RouterView />
                </main>
            </div>
        </div>
    </div>
</template>
