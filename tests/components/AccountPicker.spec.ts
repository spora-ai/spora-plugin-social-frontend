import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import AccountPicker from '../../src/components/AccountPicker.vue'
import { makeAccount } from '../fixtures'
import { mountComponent } from '../mountPage'
import { CONFIG_PAYLOAD } from '../recorded'

describe('AccountPicker', () => {
    it('lists the accounts of every network the caller holds', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 12, platform: 'linkedin' }),
                makeAccount({ id: 13, platform: 'instagram' }),
            ],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="target-12"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="target-13"]').exists()).toBe(true)
    })

    it('says so when there is no account to publish to', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.text()).toContain('Connect an account to publish to it.')
    })

    it('chooses an account', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12 })],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        await wrapper.find('[data-test="target-12"]').trigger('change')

        expect(wrapper.emitted('update:modelValue')).toEqual([[[12]]])
    })

    it('unchooses an account that was chosen', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12 }), makeAccount({ id: 13 })],
            modelValue: [12, 13],
            config: CONFIG_PAYLOAD,
        })

        await wrapper.find('[data-test="target-12"]').trigger('change')

        expect(wrapper.emitted('update:modelValue')).toEqual([[[13]]])
    })

    it('marks the chosen accounts', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12 }), makeAccount({ id: 13 })],
            modelValue: [13],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="target-12"]').attributes('checked')).toBeUndefined()
        expect(wrapper.find('[data-test="target-13"]').attributes('checked')).toBeDefined()
    })

    it('groups the accounts by the route they publish through', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 12, platform: 'linkedin', via: 'direct' }),
                makeAccount({ id: 15, platform: 'bluesky', via: 'zernio' }),
            ],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })
        await flushPromises()

        // One picker, two groups: the accounts the plugin reaches on its own
        // and the ones an aggregator reaches.
        expect(wrapper.find('[data-test="route-group-direct"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="route-group-zernio"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="route-group-label-direct"]').text()).toBe('Direct')
        expect(wrapper.find('[data-test="route-group-label-zernio"]').text()).toBe('Zernio')
    })

    it('puts the plugin’s own route first', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 15, platform: 'bluesky', via: 'zernio' }),
                makeAccount({ id: 12, platform: 'linkedin', via: 'direct' }),
            ],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })
        await flushPromises()

        const groups = wrapper
            .findAll('[data-test^="route-group-"]')
            .filter((group) => !group.attributes('data-test')?.startsWith('route-group-label-'))
        expect(groups[0]?.attributes('data-test')).toBe('route-group-direct')
        expect(groups[1]?.attributes('data-test')).toBe('route-group-zernio')
    })

    it('offers only the accounts whose channel has a rules row', () => {
        // A network the plugin cannot publish to has no rules row — no
        // limits, no name, no colour — and offering the account would be a
        // control that cannot do anything.
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 12, platform: 'linkedin', via: 'direct' }),
                makeAccount({ id: 20, platform: 'myspace', via: 'zernio' }),
            ],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="target-12"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="target-20"]').exists()).toBe(false)
    })

    it('offers every account while the rules are unknown', () => {
        // A config that could not be read is a temporary state: refusing
        // every account would leave the operator with nothing to publish to.
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 20, platform: 'myspace', via: 'zernio' })],
            modelValue: [],
            config: null,
        })

        expect(wrapper.find('[data-test="target-20"]').exists()).toBe(true)
    })

    it('shows the route on every row', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 15, platform: 'bluesky', via: 'zernio' })],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        // The group heading names the route; the row says it too, so a row
        // read on its own is not a riddle.
        expect(wrapper.find('[data-test="target-row-15"]').text()).toContain('Zernio')
    })

    it('names the network from the backend’s rules', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 15, platform: 'bluesky', via: 'zernio' })],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-network="bluesky"]').text()).toBe('Bluesky')
    })
})
