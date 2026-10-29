import { describe, it, expect } from 'vitest'
import PostImage from '../../src/components/PostImage.vue'
import { makeMedia } from '../fixtures'
import { mountComponent } from '../mountPage'

describe('PostImage', () => {
    it('shows the image the asset points at', () => {
        const wrapper = mountComponent(PostImage, {
            media: makeMedia({ media_asset_id: 'asset-1' }),
            alt: 'A chart',
            variant: 'feature',
        })

        const image = wrapper.find('[data-test="post-image-asset-1"]')
        expect(image.exists()).toBe(true)
        expect(image.attributes('src')).toBe('/api/v1/assets/asset-1.png')
        expect(image.attributes('alt')).toBe('A chart')
    })

    it('names the file type when the asset is gone', () => {
        const wrapper = mountComponent(PostImage, {
            media: makeMedia({ media_asset_id: 'asset-1', asset_url: null, mime_type: 'image/png' }),
            alt: '',
            variant: 'feature',
        })

        // The thumbnail falls back to the asset's own mime type as its label.
        expect(wrapper.find('[data-test="post-image-placeholder-asset-1"]').text()).toBe('PNG')
    })

    it('says nothing when the asset has no mime type either', () => {
        const wrapper = mountComponent(PostImage, {
            media: makeMedia({ media_asset_id: 'asset-1', asset_url: null, mime_type: null }),
            alt: '',
            variant: 'feature',
        })

        const placeholder = wrapper.find('[data-test="post-image-placeholder-asset-1"]')
        expect(placeholder.exists()).toBe(true)
        expect(placeholder.find('span').exists()).toBe(false)
    })

    it('sizes the strip and the feature differently', () => {
        const strip = mountComponent(PostImage, {
            media: makeMedia({ media_asset_id: 'asset-1' }),
            alt: '',
            variant: 'strip',
        })
        const feature = mountComponent(PostImage, {
            media: makeMedia({ media_asset_id: 'asset-1' }),
            alt: '',
            variant: 'feature',
        })

        expect(strip.find('img').classes()).toContain('h-14')
        expect(feature.find('img').classes()).toContain('max-h-[420px]')
    })
})
