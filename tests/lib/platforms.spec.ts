import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as platforms from '../../src/lib/platforms'
import { brandColorVar, chartColorVar, charCount, mediaFit } from '../../src/lib/platforms'
import { CONFIG_PAYLOAD } from '../recorded'

const rules = CONFIG_PAYLOAD.rules

describe('lib/platforms', () => {
    it('carries no copy of the limits', () => {
        // The backend enforces these, so a copy here is a copy that warns
        // about a number the backend no longer refuses.
        const source = readFileSync(join(process.cwd(), 'src/lib/platforms.ts'), 'utf8')

        expect(source).not.toContain('PLATFORM_CONSTRAINTS')
        expect(source).not.toContain('maxText')
        expect(source).not.toContain('mediaTypes')
        expect(source).not.toContain('maxMediaBytes')
        expect(Object.keys(platforms)).not.toContain('PLATFORM_CONSTRAINTS')
    })

    it('reads the character limit from the backend’s rule', () => {
        expect(rules.linkedin?.max_text).toBe(3000)
        expect(rules.facebook?.max_text).toBe(63206)
        expect(rules.instagram?.max_text).toBe(2200)
    })

    it('flags a body past the limit, and a body close to it', () => {
        const limit = rules.linkedin!.max_text

        expect(charCount('a'.repeat(limit), limit).over).toBe(false)
        expect(charCount('a'.repeat(limit + 1), limit).over).toBe(true)
        expect(charCount('a'.repeat(Math.floor(limit * 0.95)), limit).near).toBe(true)
        expect(charCount('short', limit).near).toBe(false)
    })

    it('counts in code points, so an emoji does not read as two', () => {
        // A surrogate pair is two UTF-16 code units and one code point. The
        // platforms count code points, so a caption of 2,200 emoji is at the
        // limit — not twice over it.
        const emoji = '😀'
        const limit = rules.instagram!.max_text

        expect(charCount(emoji.repeat(limit), limit).n).toBe(limit)
        expect(charCount(emoji.repeat(limit), limit).over).toBe(false)
        expect(charCount(emoji.repeat(limit + 1), limit).over).toBe(true)
    })

    it('quotes the backend’s wording on the media fit', () => {
        const fit = mediaFit(
            { mime_type: 'image/png', size_bytes: 1000 },
            rules.instagram!,
        )

        expect(fit.fits).toBe(false)
        expect(fit.reason).toBe(rules.instagram!.media_note)
        expect(fit.remedy).toBe(rules.instagram!.media_remedy)
    })

    it('names the action for a video the platform rejects', () => {
        const fit = mediaFit(
            { mime_type: 'video/quicktime', size_bytes: 1000 },
            rules.instagram!,
        )

        expect(fit.remedy).toBe(rules.instagram!.video_remedy)
    })

    it('accepts a PNG on the networks that take one', () => {
        expect(mediaFit({ mime_type: 'image/png', size_bytes: 1000 }, rules.linkedin!).fits).toBe(true)
        expect(mediaFit({ mime_type: 'image/png', size_bytes: 1000 }, rules.facebook!).fits).toBe(true)
    })

    it('names the remedy for a file over the network’s cap', () => {
        const fit = mediaFit(
            { mime_type: 'image/jpeg', size_bytes: rules.linkedin!.max_bytes + 1 },
            rules.linkedin!,
        )

        expect(fit.fits).toBe(false)
        expect(fit.remedy).toBe(rules.linkedin!.size_remedy)
    })

    it('keeps the chart series away from the brand hues', () => {
        // LinkedIn's and Facebook's blues are indistinguishable in a stacked
        // bar, so the series carry their own tokens.
        expect(chartColorVar('linkedin')).toBe('var(--chart-linkedin)')
        expect(chartColorVar('facebook')).toBe('var(--chart-facebook)')
        expect(chartColorVar('instagram')).toBe('var(--chart-instagram)')
        expect(brandColorVar('linkedin')).toBe('var(--platform-linkedin)')
        expect(chartColorVar('linkedin')).not.toBe(brandColorVar('linkedin'))
    })
})
