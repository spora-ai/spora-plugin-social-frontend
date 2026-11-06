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

    it('groups the accounts by the network they are on', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 12, platform: 'linkedin', via: 'direct' }),
                makeAccount({ id: 13, platform: 'linkedin', via: 'direct' }),
                makeAccount({ id: 14, platform: 'instagram', via: 'direct' }),
            ],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })
        await flushPromises()

        // One chip per network, not one per account.
        expect(wrapper.findAll('[data-network="linkedin"]')).toHaveLength(1)
        expect(wrapper.findAll('[data-network="instagram"]')).toHaveLength(1)
    })

    it('names the network from the backend’s rules', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12, platform: 'linkedin', via: 'direct' })],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-network="linkedin"]').text()).toBe('LinkedIn')
    })

    it('shows the route on every row', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12, platform: 'linkedin', via: 'direct' })],
            modelValue: [],
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="target-row-12"]').text()).toContain('Direct')
    })
})
