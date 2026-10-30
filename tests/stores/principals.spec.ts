import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError, setApi } from '../../src/api/client'
import { usePrincipalsStore } from '../../src/stores/principals'
import { makePrincipal } from '../fixtures'
import type { PluginHostContext } from '../../src/shims'

let get: ReturnType<typeof vi.fn>

beforeEach(() => {
    setActivePinia(createPinia())
    get = vi.fn().mockResolvedValue({})
    setApi({
        get: get as never,
        post: vi.fn() as never,
        put: vi.fn() as never,
        patch: vi.fn() as never,
        delete: vi.fn() as never,
    } satisfies PluginHostContext['api'])
})

describe('stores/principals', () => {
    it('reads the principals the caller can act as', async () => {
        get.mockResolvedValueOnce({ principals: [makePrincipal()] })
        const store = usePrincipalsStore()

        await store.loadPrincipals()

        expect(store.principals).toHaveLength(1)
        // The caller's own user-principal is the default scope.
        expect(store.selectedPrincipalId).toBe(7)
    })

    it('falls back to the first principal when there is no user one', async () => {
        get.mockResolvedValueOnce({
            principals: [makePrincipal({ id: 8, type: 'group', user_id: null, group_id: 2 })],
        })
        const store = usePrincipalsStore()

        await store.loadPrincipals()

        expect(store.selectedPrincipalId).toBe(8)
    })

    it('keeps the chosen principal when the list is refreshed', async () => {
        get.mockResolvedValueOnce({ principals: [makePrincipal()] })
        const store = usePrincipalsStore()
        await store.loadPrincipals()
        store.selectPrincipal(7)

        get.mockResolvedValueOnce({ principals: [makePrincipal(), makePrincipal({ id: 8 })] })
        await store.loadPrincipals()

        expect(store.selectedPrincipalId).toBe(7)
    })

    it('reports a failed read', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = usePrincipalsStore()

        await store.loadPrincipals()

        expect(store.error).not.toBeNull()
    })

    it('carries the backend’s own message when it sent one', async () => {
        get.mockRejectedValueOnce(new ApiError('The session expired.', 'unauthorized', 401))
        const store = usePrincipalsStore()

        await store.loadPrincipals()

        expect(store.error).toBe('The session expired.')
    })

    it('clears the error', async () => {
        get.mockRejectedValueOnce(new Error('boom'))
        const store = usePrincipalsStore()
        await store.loadPrincipals()
        expect(store.error).not.toBeNull()

        store.clearError()

        expect(store.error).toBeNull()
    })

    it('says which principals the caller may act as', () => {
        const store = usePrincipalsStore()
        store.principals = [makePrincipal({ id: 7 }), makePrincipal({ id: 8, type: 'group' })]

        expect(store.isVisible(7)).toBe(true)
        expect(store.isVisible(99)).toBe(false)
    })

    it('has no current principal before one is selected', () => {
        const store = usePrincipalsStore()
        store.principals = [makePrincipal({ id: 7 })]

        expect(store.currentPrincipal).toBeNull()
    })

    it('names the current principal', () => {
        const store = usePrincipalsStore()
        store.principals = [makePrincipal({ id: 7 })]
        store.selectPrincipal(7)

        expect(store.currentPrincipal?.name).toBe('Maya Fischer')
    })

    it('has no current principal when the chosen one is gone', () => {
        const store = usePrincipalsStore()
        store.principals = [makePrincipal({ id: 7 })]
        store.selectPrincipal(99)

        expect(store.currentPrincipal).toBeNull()
    })
})
