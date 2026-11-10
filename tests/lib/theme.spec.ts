import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { applyThemeClass, storedTheme, THEME_STORAGE_KEY } from '../../src/lib/theme'

/** Every source file, so the theme contract can be checked against the whole app. */
function sourceFiles(dir: string): string[] {
    const found: string[] = []
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) found.push(...sourceFiles(full))
        else if (/\.(ts|vue|css)$/.test(entry)) found.push(full)
    }
    return found
}

beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('the theme', () => {
    it('is light when nothing is stored', () => {
        expect(storedTheme()).toBe('light')
    })

    it('reads the stored choice', () => {
        localStorage.setItem(THEME_STORAGE_KEY, 'dark')
        expect(storedTheme()).toBe('dark')
        localStorage.setItem(THEME_STORAGE_KEY, 'light')
        expect(storedTheme()).toBe('light')
    })

    it('puts the dark class on <html>', () => {
        applyThemeClass('dark')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
        applyThemeClass('light')
        expect(document.documentElement.classList.contains('dark')).toBe(false)
    })

    it('never reads the OS preference', () => {
        // The host's contract: light by default, toggled with a class on <html>.
        // A `prefers-color-scheme` rule would override the operator's choice.
        for (const file of sourceFiles(join(process.cwd(), 'src'))) {
            expect(readFileSync(file, 'utf8')).not.toContain('prefers-color-scheme')
        }
    })

    it('has no toggle of its own', () => {
        // The host's navbar carries the switch. A second one in the plugin's
        // rail is a second control for the same value, and the two disagree
        // the moment the operator uses the host's.
        for (const file of sourceFiles(join(process.cwd(), 'src'))) {
            const source = readFileSync(file, 'utf8')
            expect(source).not.toContain('useTheme')
            expect(source).not.toContain('ThemeToggle')
        }
    })
})

describe('the theme without a browser', () => {
    it('is light when there is no local storage to read', () => {
        // The plugin runs inside the host's document, but the helper has to
        // survive a runtime that has none — a server render, a worker.
        vi.stubGlobal('localStorage', undefined)

        expect(storedTheme()).toBe('light')
    })

    it('puts no class on a document that does not exist', () => {
        vi.stubGlobal('document', undefined)

        expect(() => applyThemeClass('dark')).not.toThrow()
    })
})
