import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ConnectionsGrid from '../../src/components/ConnectionsGrid.vue'
import { CONFIG_PAYLOAD, CONNECTIONS_PAYLOAD, UNCONFIGURED_CONFIG_PAYLOAD } from '../recorded'
import { makeConnection } from '../fixtures'
import { mountComponent } from '../mountPage'

describe('ConnectionsGrid', () => {
    it('shows one card per connection', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: CONNECTIONS_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="connection-1"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connection-2"]').exists()).toBe(true)
        expect(wrapper.findAll('[data-test^="connection-"]').filter((card) => card.attributes('data-test')?.match(/^connection-\d+$/))).toHaveLength(2)
    })

    it('shows both accounts a Meta connection covers, with their platform badges', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: CONNECTIONS_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        const card = wrapper.find('[data-test="connection-1"]')
        expect(card.find('[data-test="connection-account-12"]').exists()).toBe(true)
        expect(card.find('[data-test="connection-account-13"]').exists()).toBe(true)
        expect(card.find('[data-test="connection-account-12"] [data-platform="instagram"]').exists()).toBe(true)
        expect(card.find('[data-test="connection-account-13"] [data-platform="facebook"]').exists()).toBe(true)
    })

    it('offers one Connect button per provider that has no connection', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, provider: 'meta' })],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="connect-linkedin"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connect-meta"]').exists()).toBe(false)
        expect(wrapper.find('[data-test="connect-linkedin"]').text()).toContain('Connect LinkedIn')
    })

    it('says that a token which never expires never expires', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: CONNECTIONS_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        // A Meta token "defaults to never expire" — a dash would read as a
        // broken connection.
        expect(wrapper.find('[data-test="connection-token-1"]').text()).toContain('Never expires')
        expect(wrapper.find('[data-test="connection-token-2"]').text()).not.toContain('Never expires')
    })

    it('shows the token’s health on the connection card', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [
                makeConnection({
                    id: 3,
                    status: 'expired',
                    needs_reconnect: true,
                    expires_at: '2020-01-01T00:00:00+00:00',
                }),
            ],
            config: CONFIG_PAYLOAD,
        })

        const card = wrapper.find('[data-test="connection-3"]')
        expect(card.text()).toContain('Token expired')
        expect(card.text()).toContain('Needs reconnect')
    })

    it('renders an account’s report note', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: CONNECTIONS_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        const note = wrapper.find('[data-test="account-report-note-14"]')
        expect(note.exists()).toBe(true)
        expect(note.text()).toContain('Member posts report reactions only')
    })

    it('asks to connect when the principal has nothing connected', () => {
        const wrapper = mountComponent(ConnectionsGrid, { connections: [], config: CONFIG_PAYLOAD })

        expect(wrapper.find('[data-test="connections-empty"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connect-meta"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connect-linkedin"]').exists()).toBe(true)
    })

    it('shows no redirect URI and no copy button', () => {
        // The setup instruction belongs in Settings → Plugins, where the
        // operator configures the app id, the secret and the configuration id.
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, provider: 'meta' })],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="redirect-uri-linkedin"]').exists()).toBe(false)
        expect(wrapper.find('[data-test="copy-redirect-uri-linkedin"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('/oauth/')
        expect(wrapper.text()).not.toContain('redirect URI')
    })

    it('tells an unconfigured provider that it needs setup', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, provider: 'meta' })],
            config: UNCONFIGURED_CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="setup-linkedin"]').exists()).toBe(true)
        // The wording is the backend's, rendered as it comes.
        expect(wrapper.find('[data-test="setup-title-linkedin"]').text()).toBe(
            'LinkedIn integration needs setup',
        )
        expect(wrapper.find('[data-test="setup-body-linkedin"]').text()).toBe(
            'Add the client id, the client secret and the requested permissions in Settings → Plugins.',
        )
        // The Connect button stays: the operator can try, and the server says why.
        expect(wrapper.find('[data-test="connect-linkedin"]').exists()).toBe(true)
    })

    it('reads no wording of its own', () => {
        // The plugin emits the setup notice and the host translates it; a copy
        // here would be a second wording to keep in step, in two languages.
        const source = readFileSync(join(process.cwd(), 'src/lib/providers.ts'), 'utf8')

        expect(source).not.toContain('integration needs setup')
        expect(source).not.toContain('Settings')
    })

    it('keys the card on the notice alone', () => {
        // The backend sends the notice exactly when the provider needs setup,
        // and its `configured` flag is that same answer — so the notice is the
        // only signal the frontend reads, and the flag is not a second
        // condition to keep in step.
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, provider: 'meta' })],
            config: {
                ...CONFIG_PAYLOAD,
                providers: {
                    ...CONFIG_PAYLOAD.providers,
                    linkedin: {
                        ...CONFIG_PAYLOAD.providers.linkedin,
                        configured: true,
                        needs_setup: {
                            title: 'LinkedIn integration needs setup',
                            body: 'Add the client id, the client secret and the requested permissions in Settings → Plugins.',
                        },
                    },
                },
            },
        })

        expect(wrapper.find('[data-test="setup-linkedin"]').exists()).toBe(true)
    })

    it('shows no card for a provider with no notice', () => {
        // The notice is the only signal: the backend sends it exactly when the
        // provider needs setup, so its absence means there is nothing to say.
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, provider: 'meta' })],
            config: {
                ...CONFIG_PAYLOAD,
                providers: {
                    ...CONFIG_PAYLOAD.providers,
                    linkedin: { ...CONFIG_PAYLOAD.providers.linkedin, configured: false, needs_setup: null },
                },
            },
        })

        expect(wrapper.find('[data-test="setup-linkedin"]').exists()).toBe(false)
        expect(wrapper.find('[data-test="connect-linkedin"]').exists()).toBe(true)
    })

    it('shows only the Connect button for a provider that is configured', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, provider: 'meta' })],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="connect-linkedin"]').exists()).toBe(true)
        // No instruction: the operator has configured it, they know what to do.
        expect(wrapper.find('[data-test="setup-linkedin"]').exists()).toBe(false)
    })

    it('offers no Refresh on a token that never expires', () => {
        // A Meta token has no refresh grant: the backend hands it back
        // unchanged, so a button there would do nothing.
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [makeConnection({ id: 1, expires_at: null })],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="connection-refresh-1"]').exists()).toBe(false)
        // The actions that do something stay.
        expect(wrapper.find('[data-test="connection-disconnect-1"]').exists()).toBe(true)
    })

    it('offers Refresh on a token that expires', () => {
        const wrapper = mountComponent(ConnectionsGrid, {
            connections: [
                makeConnection({ id: 2, expires_at: '2026-12-26T10:00:00+00:00' }),
            ],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="connection-refresh-2"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="connection-disconnect-2"]').exists()).toBe(true)
    })
})
