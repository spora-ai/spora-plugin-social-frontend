/**
 * The principal switcher — the plugin's context.
 *
 * A dropdown, not a chip row: equal-weight chips read as *filters*, and a
 * filter does not say "everything below this belongs to what I picked".
 *
 * The switcher **re-scopes every screen**. Switching the principal changes the
 * accounts, the posts and the counters, because every one of them
 * belongs to the principal the operator picked.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { sectionPath, type Section } from '../lib/paths'
import { sectionForRouteName } from '../lib/routes'
import { DEFAULT_SECTION } from '../lib/hostRoute'
import { usePrincipalsStore } from '../stores/principals'

export function usePrincipalSwitcher() {
    const principals = usePrincipalsStore()
    const route = useRoute()
    const router = useRouter()

    const selected = computed(() => principals.currentPrincipal)

    /** The section the current route names — switching the principal keeps it. */
    const section = computed<Section>(() => sectionForRouteName(route.name) ?? DEFAULT_SECTION)

    /**
     * A scope change navigates — it does not mutate the store. The path is the only writer of the
     * acting principal, and two writers would leave path and store disagreeing.
     *
     * The URL is **replaced**, not pushed: a context change is not a place, and the back button
     * should not walk the operator through every principal they looked at.
     */
    async function select(id: number): Promise<void> {
        await router.replace(sectionPath(id, section.value))
    }

    return { principals, selected, section, select }
}
