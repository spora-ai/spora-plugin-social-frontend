import { describe, it, expect, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import ThemeToggle from '../../src/components/ThemeToggle.vue'
import { mountComponent } from '../mountPage'

beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
})

describe('ThemeToggle', () => {
    it('offers the dark theme while the app is light', () => {
        const wrapper = mountComponent(ThemeToggle)

        expect(wrapper.text()).toContain('Dark theme')
        expect(wrapper.attributes('aria-label')).toBe('Switch to the dark theme')
    })

    it('switches to the dark theme', async () => {
        const wrapper = mountComponent(ThemeToggle)

        await wrapper.find('[data-test="theme-toggle"]').trigger('click')
        await flushPromises()

        expect(wrapper.text()).toContain('Light theme')
        expect(wrapper.attributes('aria-label')).toBe('Switch to the light theme')
        expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('switches back to the light theme', async () => {
        const wrapper = mountComponent(ThemeToggle)

        await wrapper.find('[data-test="theme-toggle"]').trigger('click')
        await flushPromises()
        await wrapper.find('[data-test="theme-toggle"]').trigger('click')
        await flushPromises()

        expect(wrapper.text()).toContain('Dark theme')
        expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
})
