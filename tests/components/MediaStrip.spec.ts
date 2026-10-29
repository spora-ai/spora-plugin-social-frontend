import { describe, it, expect } from 'vitest'
import MediaStrip from '../../src/components/MediaStrip.vue'
import { makeAttachment } from '../fixtures'
import { mountComponent } from '../mountPage'
import { CONFIG_PAYLOAD } from '../recorded'

const rules = CONFIG_PAYLOAD.rules

describe('MediaStrip', () => {
    it('says nothing when there is no media', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [],
            platforms: ['linkedin'],
            rules,
        })
        expect(wrapper.text()).toContain('No media attached')
    })

    it('badges the fit for the platform currently targeted', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            platforms: ['instagram'],
            rules,
        })

        const badge = wrapper.find('[data-test="media-fit-a1-instagram"]')
        expect(badge.exists()).toBe(true)
        expect(badge.text()).toContain(rules.instagram!.media_note)
    })

    it('quotes the backend’s wording, not one of its own', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            platforms: ['instagram'],
            rules,
        })

        const badge = wrapper.find('[data-test="media-fit-a1-instagram"]').text()
        expect(badge).toContain('Instagram accepts JPEG or MP4, up to 100 MB.')
        expect(badge).not.toContain('Instagram accepts JPEG only')
    })

    it('names the remedy, so the operator knows what to do', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            platforms: ['instagram'],
            rules,
        })

        expect(wrapper.find('[data-test="media-fit-a1-instagram"]').text()).toContain(
            rules.instagram!.media_remedy,
        )
    })

    it('says nothing about a platform that is not targeted', () => {
        // A PNG is fine on LinkedIn; the badge is about the networks the post
        // is going to, not about the file in general.
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            platforms: ['linkedin'],
            rules,
        })

        expect(wrapper.find('[data-test="media-fit-a1-instagram"]').exists()).toBe(false)
    })

    it('badges every targeted platform that does not fit', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            platforms: ['instagram'],
            rules,
        })

        expect(wrapper.find('[data-test="media-fit-a1-instagram"]').exists()).toBe(true)
    })

    it('says nothing while the rule has not arrived', () => {
        // Without the rule there is nothing to judge the file against, and
        // the frontend does not guess a limit of its own.
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            platforms: ['instagram'],
            rules: {},
        })

        expect(wrapper.find('[data-test="media-fit-a1-instagram"]').exists()).toBe(false)
    })

    it('removes an attachment', async () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1' })],
            platforms: ['linkedin'],
            rules,
        })

        expect(wrapper.find('[data-test="media-remove-a1"]').exists()).toBe(true)
        await wrapper.find('[data-test="media-remove-a1"]').trigger('click')

        expect(wrapper.emitted('remove')).toEqual([['a1']])
    })
})
