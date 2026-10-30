/**
 * The theme contract, as the host states it.
 *
 * **Light is the default.** The host's theme store reads `localStorage.theme`
 * and falls back to light; it does not consult the operating system's colour
 * preference, and neither does this plugin. An OS-preference block would
 * override the explicit choice the toggle makes, so there is deliberately none
 * here.
 *
 * **Dark is a class, not a media query.** `darkMode: 'class'` means the
 * `dark:` variants and the `.dark` token block apply only when the class is
 * on `<html>`.
 */

/** The key the host's theme store persists under. */
export const THEME_STORAGE_KEY = 'theme'

export type Theme = 'light' | 'dark'

/** The persisted theme, or light when nothing is stored. */
export function storedTheme(): Theme {
    if (typeof localStorage === 'undefined') return 'light'
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

/** Put the theme on `<html>` — the class the host's `dark:` variants key on. */
export function applyThemeClass(theme: Theme): void {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', theme === 'dark')
}

/**
 * The host's theme store, when the host published one.
 *
 * The host keeps the theme in a Pinia store and hands the plugin its Pinia
 * instance through `hostContext.pinia`; the store is registered there under
 * the id `theme`. Reading it is what keeps the plugin from inventing a second
 * theme system — two systems would disagree after the operator used the
 * host's toggle.
 */
export interface HostThemeStore {
    isDark: boolean
    toggle: () => void
}

export function hostThemeStore(pinia: unknown): HostThemeStore | null {
    if (pinia === null || typeof pinia !== 'object') return null

    const stores = (pinia as { _s?: unknown })._s
    if (!(stores instanceof Map)) return null

    const store = stores.get('theme') as HostThemeStore | undefined
    if (store === undefined || typeof store.toggle !== 'function') return null

    return store
}
