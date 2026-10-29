import { describe, it, expect } from 'vitest'
import { statusLabel, statusPill } from '../../src/lib/postStatus'

describe('statusPill', () => {
    it('gives every status its own pill', () => {
        expect(statusPill('draft')).toBe('pill-draft')
        expect(statusPill('scheduled')).toBe('pill-scheduled')
        expect(statusPill('publishing')).toBe('pill-publishing')
        expect(statusPill('published')).toBe('pill-published')
        expect(statusPill('partial')).toBe('pill-partial')
        expect(statusPill('failed')).toBe('pill-failed')
        expect(statusPill('cancelled')).toBe('pill-cancelled')
    })
})

describe('statusLabel', () => {
    it('names every status in the operator’s words', () => {
        expect(statusLabel('draft')).toBe('Draft')
        expect(statusLabel('scheduled')).toBe('Scheduled')
        expect(statusLabel('publishing')).toBe('Publishing')
        expect(statusLabel('published')).toBe('Published')
        expect(statusLabel('partial')).toBe('Partly published')
        expect(statusLabel('failed')).toBe('Failed')
        expect(statusLabel('cancelled')).toBe('Cancelled')
    })
})
