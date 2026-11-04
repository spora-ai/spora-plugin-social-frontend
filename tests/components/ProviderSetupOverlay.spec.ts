/**
 * The setup guide: the steps for a provider, and the redirect URL to register
 * with it.
 *
 * The redirect URL is the backend's — it is built from the address this
 * instance is reached at — so it arrives as a prop and is never assembled
 * here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import ProviderSetupOverlay from '../../src/components/ProviderSetupOverlay.vue'
import { mountComponent } from '../mountPage'

const META_REDIRECT = 'https://spora.example.com/api/v1/plugins/social/oauth/meta/callback'
const LINKEDIN_REDIRECT = 'https://spora.example.com/api/v1/plugins/social/oauth/linkedin/callback'

const writeText = vi.fn(async () => undefined)

beforeEach(() => {
    writeText.mockClear()

    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true,
    })
})

function mountOverlay(props: Record<string, unknown>) {
    return mountComponent(ProviderSetupOverlay, { open: true, ...props }, {
        // The dialog is opened with `showModal()`, which needs an element in
        // the document.
    })
}

describe('ProviderSetupOverlay', () => {
    it('shows nothing while it is closed', () => {
        const wrapper = mountComponent(ProviderSetupOverlay, {
            open: false,
            provider: 'meta',
            redirectUri: META_REDIRECT,
        })

        expect(wrapper.find('[data-test="setup-overlay"]').exists()).toBe(false)
    })

    it('shows the steps for Meta', () => {
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        const text = wrapper.text()
        expect(text).toContain('Facebook Login for Business')
        expect(text).toContain('Configuration ID')
        expect(text).toContain('Settings → Plugins')
    })

    it('shows the steps for LinkedIn', () => {
        const wrapper = mountOverlay({ provider: 'linkedin', redirectUri: LINKEDIN_REDIRECT })

        const text = wrapper.text()
        expect(text).toContain('Sign in with LinkedIn')
        expect(text).toContain('Share on LinkedIn')
        expect(text).toContain('Client ID')
    })

    it('links to the provider’s own console', () => {
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        const link = wrapper.find('[data-test="setup-overlay-console"]')
        expect(link.attributes('href')).toBe('https://developers.facebook.com/apps')
        expect(link.text()).toContain('Meta app dashboard')
    })

    it('shows the redirect URL the backend sent', () => {
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        expect(wrapper.find('[data-test="setup-overlay-redirect-uri"]').text()).toBe(META_REDIRECT)
    })

    it('copies the redirect URL', async () => {
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        await wrapper.find('[data-test="setup-overlay-copy"]').trigger('click')
        await flushPromises()

        expect(writeText).toHaveBeenCalledWith(META_REDIRECT)
        expect(wrapper.find('[data-test="setup-overlay-copy"]').text()).toContain('Copied')
    })

    it('says there is no redirect URL on an instance that has none', () => {
        // A local address is refused by every platform, so the backend sends
        // none — and the overlay must not name one that cannot work.
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: null })

        expect(wrapper.find('[data-test="setup-overlay-redirect-uri"]').exists()).toBe(false)
        expect(wrapper.find('[data-test="setup-overlay-copy"]').exists()).toBe(false)
        expect(wrapper.find('[data-test="setup-overlay-no-redirect-uri"]').text()).toContain(
            'no public address',
        )
    })

    it('names its own colour, so the dark theme can be read', () => {
        // A `<dialog>` carries the user agent's `color: canvastext`, which
        // stays black in the dark theme — so without a colour of its own the
        // steps would be black on a dark panel.
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        expect(wrapper.find('[data-test="setup-overlay-panel"]').classes()).toContain('text-foreground')
    })

    it('closes when the operator asks it to', async () => {
        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        await wrapper.find('[data-test="setup-overlay-close"]').trigger('click')

        expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('falls back to the textarea when the clipboard refuses', async () => {
        // The clipboard API needs a secure context, which a development
        // install on plain HTTP is not.
        writeText.mockRejectedValueOnce(new Error('not allowed'))

        const execCommand = vi.fn().mockReturnValue(true)
        Object.defineProperty(document, 'execCommand', {
            value: execCommand,
            configurable: true,
            writable: true,
        })

        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        await wrapper.find('[data-test="setup-overlay-copy"]').trigger('click')
        await flushPromises()

        expect(execCommand).toHaveBeenCalledWith('copy')
        expect(wrapper.find('[data-test="setup-overlay-copy"]').text()).toContain('Copied')
    })

    it('says nothing was copied when the copy failed', async () => {
        writeText.mockRejectedValueOnce(new Error('not allowed'))
        Object.defineProperty(document, 'execCommand', {
            value: vi.fn().mockImplementation(() => {
                throw new Error('not supported')
            }),
            configurable: true,
            writable: true,
        })

        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        await wrapper.find('[data-test="setup-overlay-copy"]').trigger('click')
        await flushPromises()

        // A failed copy must not claim it worked.
        expect(wrapper.find('[data-test="setup-overlay-copy"]').text()).toContain('Copy')
        expect(wrapper.find('[data-test="setup-overlay-copy"]').text()).not.toContain('Copied')
    })

    it('offers the copy again once the confirmation has passed', async () => {
        vi.useFakeTimers()

        const wrapper = mountOverlay({ provider: 'meta', redirectUri: META_REDIRECT })

        await wrapper.find('[data-test="setup-overlay-copy"]').trigger('click')
        await vi.advanceTimersByTimeAsync(1500)

        expect(wrapper.find('[data-test="setup-overlay-copy"]').text()).toContain('Copy')
        expect(wrapper.find('[data-test="setup-overlay-copy"]').text()).not.toContain('Copied')

        vi.useRealTimers()
    })
})
