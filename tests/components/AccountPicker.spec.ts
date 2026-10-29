import { describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import AccountPicker from '../../src/components/AccountPicker.vue'
import { makeAccount } from '../fixtures'
import { mountComponent } from '../mountPage'

describe('AccountPicker', () => {
    it('lists the accounts of every platform the caller holds', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 12, platform: 'linkedin' }),
                makeAccount({ id: 13, platform: 'instagram' }),
            ],
            modelValue: [],
        })

        expect(wrapper.find('[data-test="target-12"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="target-13"]').exists()).toBe(true)
    })

    it('says so when there is no account to publish to', () => {
        const wrapper = mountComponent(AccountPicker, { accounts: [], modelValue: [] })

        expect(wrapper.text()).toContain('Connect an account to publish to it.')
    })

    it('chooses an account', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12 })],
            modelValue: [],
        })

        await wrapper.find('[data-test="target-12"]').trigger('change')

        expect(wrapper.emitted('update:modelValue')).toEqual([[[12]]])
    })

    it('unchooses an account that was chosen', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12 }), makeAccount({ id: 13 })],
            modelValue: [12, 13],
        })

        await wrapper.find('[data-test="target-12"]').trigger('change')

        expect(wrapper.emitted('update:modelValue')).toEqual([[[13]]])
    })

    it('marks the chosen accounts', () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [makeAccount({ id: 12 }), makeAccount({ id: 13 })],
            modelValue: [13],
        })

        expect(wrapper.find('[data-test="target-12"]').attributes('checked')).toBeUndefined()
        expect(wrapper.find('[data-test="target-13"]').attributes('checked')).toBeDefined()
    })

    it('groups the accounts by platform', async () => {
        const wrapper = mountComponent(AccountPicker, {
            accounts: [
                makeAccount({ id: 12, platform: 'linkedin' }),
                makeAccount({ id: 13, platform: 'linkedin' }),
                makeAccount({ id: 14, platform: 'instagram' }),
            ],
            modelValue: [],
        })
        await flushPromises()

        // One chip per platform, not one per account.
        expect(wrapper.findAll('[data-platform="linkedin"]')).toHaveLength(1)
        expect(wrapper.findAll('[data-platform="instagram"]')).toHaveLength(1)
    })
})
