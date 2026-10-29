import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import en from '../src/locales/en.json'
import de from '../src/locales/de.json'

describe('the catalogue', () => {
    it('is an identity map in English', () => {
        for (const [key, value] of Object.entries(en)) {
            expect(value).toBe(key)
        }
    })

    it('translates every key into German', () => {
        const missing = Object.keys(en).filter((key) => !(key in de))
        expect(missing).toEqual([])
    })

    it('has no key the source no longer contains', () => {
        const orphans = Object.keys(de).filter((key) => !(key in en))
        expect(orphans).toEqual([])
    })

    it('has no English-identical German value', () => {
        const untranslated = Object.entries(de)
            .filter(([key, value]) => value === key)
            .map(([key]) => key)
        expect(untranslated).toEqual([])
    })

    it('carries no empty German value', () => {
        const empty = Object.entries(de)
            .filter(([, value]) => value.trim() === '')
            .map(([key]) => key)
        expect(empty).toEqual([])
    })

    it('keeps the network names untranslated — they are the platforms’ own', () => {
        const source = readFileSync(join(process.cwd(), 'src/lib/platforms.ts'), 'utf8')
        expect(source).toContain("'LinkedIn'")
        expect(source).toContain("'Instagram'")
        // They are labels, so they must not be in the catalogue.
        expect(en).not.toHaveProperty('LinkedIn')
        expect(en).not.toHaveProperty('Instagram')
    })

    it('falls back to the key when no instance has been created yet', async () => {
        // A fresh module registry, so the composer is as empty as it is
        // before `main.ts` builds the instance.
        vi.resetModules()
        const { t } = await import('../src/i18n')

        expect(t('Save')).toBe('Save')
    })
})
