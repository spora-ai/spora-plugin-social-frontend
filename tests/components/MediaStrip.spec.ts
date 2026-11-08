import { describe, it, expect } from 'vitest'
import MediaStrip from '../../src/components/MediaStrip.vue'
import { makeAttachment } from '../fixtures'
import { mountComponent } from '../mountPage'
import type { MediaFitResult } from '../../src/types'

/**
 * The backend's verdict on one attachment, per channel.
 *
 * The wording is the backend's: the reason names what is wrong and the
 * remedy names what to do about it.
 */
function verdict(overrides: Partial<MediaFitResult> = {}): MediaFitResult {
    return {
        channel: 'direct:instagram',
        network: 'instagram',
        via: 'direct',
        fits: false,
        reasons: ['Instagram does not accept image/png.'],
        remedy: 'Convert to JPEG',
        mime_type: 'image/png',
        ...overrides,
    }
}

describe('MediaStrip', () => {
    it('says nothing when there is no media', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [],
            channels: ['direct:instagram'],
            verdicts: {},
        })
        expect(wrapper.text()).toContain('No media attached')
    })

    it('badges the fit for the channel that does not take it', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram'],
            verdicts: { a1: [verdict()] },
        })

        const badge = wrapper.find('[data-test="media-fit-a1-direct:instagram"]')
        expect(badge.exists()).toBe(true)
        expect(badge.text()).toContain('Instagram does not accept image/png.')
    })

    it('quotes the backend’s wording, not one of its own', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram'],
            verdicts: { a1: [verdict()] },
        })

        const badge = wrapper.find('[data-test="media-fit-a1-direct:instagram"]').text()
        expect(badge).toContain('Instagram does not accept image/png.')
        expect(badge).not.toContain('Instagram accepts JPEG only')
    })

    it('names the remedy, so the operator knows what to do', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram'],
            verdicts: { a1: [verdict()] },
        })

        expect(wrapper.find('[data-test="media-fit-a1-direct:instagram"]').text()).toContain(
            'Convert to JPEG',
        )
    })

    it('says nothing about a channel that is not targeted', () => {
        // The verdict is about the channels the post is going to, not about
        // the file in general.
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram'],
            verdicts: { a1: [verdict({ channel: 'direct:linkedin', network: 'linkedin' })] },
        })

        expect(wrapper.find('[data-test="media-fit-a1-direct:instagram"]').exists()).toBe(false)
    })

    it('badges every targeted channel that does not fit', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram', 'direct:linkedin'],
            verdicts: {
                a1: [
                    verdict(),
                    verdict({ channel: 'direct:linkedin', network: 'linkedin' }),
                ],
            },
        })

        expect(wrapper.find('[data-test="media-fit-a1-direct:instagram"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="media-fit-a1-direct:linkedin"]').exists()).toBe(true)
    })

    it('says nothing about a file the backend found no fault with', () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram'],
            verdicts: { a1: [verdict({ fits: true, reasons: [], remedy: null })] },
        })

        expect(wrapper.find('[data-test="media-fit-a1-direct:instagram"]').exists()).toBe(false)
    })

    it('says nothing while the verdict has not arrived', () => {
        // Without a verdict there is nothing to say, and the frontend does
        // not judge the file against a rule of its own.
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1', mime_type: 'image/png' })],
            channels: ['direct:instagram'],
            verdicts: {},
        })

        expect(wrapper.find('[data-test="media-fit-a1-direct:instagram"]').exists()).toBe(false)
    })

    it('removes an attachment', async () => {
        const wrapper = mountComponent(MediaStrip, {
            attachments: [makeAttachment({ media_asset_id: 'a1' })],
            channels: ['direct:instagram'],
            verdicts: {},
        })

        expect(wrapper.find('[data-test="media-remove-a1"]').exists()).toBe(true)
        await wrapper.find('[data-test="media-remove-a1"]').trigger('click')

        expect(wrapper.emitted('remove')).toEqual([['a1']])
    })
})
