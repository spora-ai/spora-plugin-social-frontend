import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import en from '../src/locales/en.json'
import de from '../src/locales/de.json'

/**
 * The terms the gate does not translate.
 *
 * The gate keeps the list in `scripts/i18n.mjs` (`EXCLUDED_TERMS`) and the
 * list is read from there rather than copied here: a house word the gate
 * does not know about is a house word the catalogue may not hold.
 */
function houseWords(): Set<string> {
    const script = readFileSync(join(process.cwd(), 'scripts/i18n.mjs'), 'utf8')
    const start = script.indexOf('const EXCLUDED_TERMS = new Set([')
    const block = script.slice(start, script.indexOf('\n])', start))

    return new Set([...block.matchAll(/^\s*'([^']+)',$/gm)].map((match) => match[1]!))
}

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
        // A house word is the exception: it is not copy, so the same word in
        // German is the translation and not a missed one.
        const words = houseWords()
        const untranslated = Object.entries(de)
            .filter(([key, value]) => value === key && !words.has(key))
            .map(([key]) => key)
        expect(untranslated).toEqual([])
    })

    it('carries no empty German value', () => {
        const empty = Object.entries(de)
            .filter(([, value]) => value.trim() === '')
            .map(([key]) => key)
        expect(empty).toEqual([])
    })

    it('keeps the network names out of the catalogue — they come with the rules', () => {
        const source = readFileSync(join(process.cwd(), 'src/lib/platforms.ts'), 'utf8')

        // The backend names the networks, and it sends the names with the
        // rules. A copy here is a name nobody updates.
        expect(source).not.toContain("'LinkedIn'")
        expect(source).not.toContain("'Instagram'")
        // They are labels, so they must not be in the catalogue either.
        expect(en).not.toHaveProperty('LinkedIn')
        expect(en).not.toHaveProperty('Instagram')
    })

    it('keeps "Aggregator" as it is — it is a house word', () => {
        // "Aggregator" is ours, the way "Principal" is ours, and the host's
        // own German catalogue keeps such a word untranslated.
        expect(houseWords().has('Aggregator')).toBe(true)
        expect(de['Aggregator']).toBe('Aggregator')
    })

    it('passes the gate', () => {
        // The gate is the authority: it has to accept the catalogue as it
        // stands, house words and all.
        const result = spawnSync('node', ['scripts/i18n.mjs', '--check'], {
            cwd: process.cwd(),
            encoding: 'utf8',
        })

        expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    })

    it('falls back to the key when no instance has been created yet', async () => {
        // A fresh module registry, so the composer is as empty as it is
        // before `main.ts` builds the instance.
        vi.resetModules()
        const { t } = await import('../src/i18n')

        expect(t('Save')).toBe('Save')
    })
})
