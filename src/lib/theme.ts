/**
 * The theme contract, as the host states it.
 *
 * **The host owns the theme.** It keeps the value in `localStorage.theme`,
 * puts the `dark` class on `<html>` and carries the toggle in its navbar —
 * so the plugin has no toggle of its own and reads nothing: the `dark:`
 * variants and the `.dark` token block key on the class the host puts there.
 *
 * **Light is the default.** The host's theme store reads `localStorage.theme`
 * and falls back to light; it does not consult the operating system's colour
 * preference, and neither does this plugin. An OS-preference block would
 * override the explicit choice the toggle makes, so there is deliberately none
 * here.
 *
 * **Dark is a class, not a media query.** `darkMode: 'class'` means the
 * `dark:` variants and the `.dark` token block apply only when the class
 * is on `<html>`.
 *
 * The one thing left to the plugin is the **sandbox**: `src/dev-main.ts`
 * stands in for the host and there is no host to put the class on, so the
 * sandbox applies the stored one itself.
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
