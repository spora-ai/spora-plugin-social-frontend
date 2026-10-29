/**
 * The plugin's view of the theme.
 *
 * The host owns it: `spora-frontend/src/stores/theme.ts` keeps the value in
 * `localStorage.theme`, puts the `dark` class on `<html>` and carries the
 * toggle in its navbar. The plugin therefore *reads* the host's store through
 * `hostContext.pinia` rather than keeping a second one — two stores would
 * disagree the moment the operator used the host's toggle.
 *
 * The local fallback exists for the dev sandbox, which has no host to ask. It
 * implements the same contract, so the behaviour does not fork between the
 * two environments.
 */
import { computed, inject, onMounted, ref } from 'vue'
import { HOST_CONTEXT_KEY } from '../shims'
import { applyThemeClass, hostThemeStore, storedTheme, THEME_STORAGE_KEY, type Theme } from '../lib/theme'

export function useTheme() {
    const hostContext = inject(HOST_CONTEXT_KEY, null)
    const store = hostThemeStore(hostContext?.pinia ?? null)

    const local = ref<Theme>(storedTheme())

    const theme = computed<Theme>(() => {
        if (store !== null) return store.isDark ? 'dark' : 'light'
        return local.value
    })

    const isDark = computed(() => theme.value === 'dark')

    function toggle(): void {
        if (store !== null) {
            store.toggle()
            return
        }

        const next: Theme = local.value === 'dark' ? 'light' : 'dark'
        local.value = next
        localStorage.setItem(THEME_STORAGE_KEY, next)
        applyThemeClass(next)
    }

    onMounted(() => {
        // The host applies the class itself when it owns the store; without one
        // the plugin has to put it on, or the first paint is the wrong theme.
        if (store === null) applyThemeClass(local.value)
    })

    return { theme, isDark, toggle }
}
