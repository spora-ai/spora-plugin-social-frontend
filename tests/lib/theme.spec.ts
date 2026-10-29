import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { applyThemeClass, hostThemeStore, storedTheme, THEME_STORAGE_KEY } from '../../src/lib/theme'
import { useTheme } from '../../src/composables/useTheme'
import { HOST_CONTEXT_KEY } from '../../src/shims'

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

    it('is light on load and toggles into dark, persisting the choice', async () => {
        const wrapper = mount({
            setup() {
                const { isDark, toggle } = useTheme()
                return { isDark, toggle }
            },
            template: '<button type="button" @click="toggle">toggle</button>',
        })

        // Light on load: no `dark` class, and the stored value untouched.
        expect(document.documentElement.classList.contains('dark')).toBe(false)
        expect(wrapper.vm.isDark).toBe(false)

        await wrapper.find('button').trigger('click')

        expect(document.documentElement.classList.contains('dark')).toBe(true)
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
        expect(wrapper.vm.isDark).toBe(true)

        await wrapper.find('button').trigger('click')

        expect(document.documentElement.classList.contains('dark')).toBe(false)
        expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    })

    it('uses the host’s store when the host published one', async () => {
        let toggled = 0
        const hostStore = {
            isDark: false,
            toggle: () => {
                toggled += 1
                hostStore.isDark = !hostStore.isDark
            },
        }
        const pinia = { _s: new Map([['theme', hostStore]]) }

        const wrapper = mount(
            {
                setup() {
                    const { isDark, toggle } = useTheme()
                    return { isDark, toggle }
                },
                template: '<button type="button" @click="toggle">toggle</button>',
            },
            {
                global: {
                    provide: {
                        // The host hands the plugin its Pinia; the theme store is
                        // registered there under the id `theme`.
                        [HOST_CONTEXT_KEY as symbol]: {
                            api: {},
                            pinia,
                            theme: 'light',
                            locale: 'en',
                            route: null,
                            router: null,
                            openMediaPicker: async () => [],
                        },
                    },
                },
            },
        )

        await wrapper.find('button').trigger('click')

        // The host's store owns the toggle — the plugin does not keep a second one.
        expect(toggled).toBe(1)
        expect(wrapper.vm.isDark).toBe(true)
    })

    it('finds no host store in a bare Pinia', () => {
        expect(hostThemeStore(null)).toBeNull()
        expect(hostThemeStore({})).toBeNull()
        expect(hostThemeStore({ _s: new Map() })).toBeNull()
    })
})
