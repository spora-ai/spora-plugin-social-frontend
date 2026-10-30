import { describe, it, expect } from 'vitest'
import {
    PROVIDERS,
    connectionExpiryNote,
    connectionStatusClass,
    connectionStatusLabel,
    needsAttention,
    providerLabel,
} from '../../src/lib/providers'
import { makeConnection } from '../fixtures'

const NOW = new Date(2026, 10, 5, 12, 0, 0).getTime()

function expiryIn(days: number): string {
    return new Date(NOW + days * 86_400_000).toISOString()
}

describe('providerLabel', () => {
    it('names the providers the app knows', () => {
        expect(PROVIDERS).toEqual(['meta', 'linkedin'])
        expect(providerLabel('meta')).toBe('Meta')
        expect(providerLabel('linkedin')).toBe('LinkedIn')
    })
})

describe('connectionExpiryNote', () => {
    it('says so when the platform sent no expiry', () => {
        expect(connectionExpiryNote(makeConnection({ expires_at: null }), NOW)).toBe('Never expires')
    })

    it('says how long ago the token expired', () => {
        expect(connectionExpiryNote(makeConnection({ expires_at: expiryIn(-3) }), NOW)).toBe(
            'Expired 3d ago',
        )
    })

    it('counts the days that are left', () => {
        expect(connectionExpiryNote(makeConnection({ expires_at: expiryIn(4) }), NOW)).toBe(
            'Expires in 4d',
        )
    })

    it('states the validity of a token that is good for a while', () => {
        expect(connectionExpiryNote(makeConnection({ expires_at: expiryIn(40) }), NOW)).toBe(
            'Token valid for 40d',
        )
    })
})

describe('connectionStatusLabel', () => {
    it('names every status', () => {
        expect(connectionStatusLabel('active')).toBe('Connected')
        expect(connectionStatusLabel('expired')).toBe('Token expired')
        expect(connectionStatusLabel('revoked')).toBe('Revoked')
        expect(connectionStatusLabel('error')).toBe('Error')
    })
})

describe('connectionStatusClass', () => {
    it('gives every status its own pill', () => {
        expect(connectionStatusClass('active')).toBe('pill-published')
        expect(connectionStatusClass('expired')).toBe('pill-expired')
        expect(connectionStatusClass('revoked')).toBe('pill-expired')
        expect(connectionStatusClass('error')).toBe('pill-failed')
    })
})

describe('needsAttention', () => {
    it('says no for a healthy connection', () => {
        expect(needsAttention(makeConnection())).toBe(false)
    })

    it('says yes when the token has to be renewed', () => {
        expect(needsAttention(makeConnection({ needs_reconnect: true }))).toBe(true)
    })

    it('says yes when the connection is not healthy', () => {
        expect(needsAttention(makeConnection({ status: 'revoked' }))).toBe(true)
    })
})
