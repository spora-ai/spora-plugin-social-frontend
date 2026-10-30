import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setApi } from '../../src/api/client'
import { listMyPrincipals } from '../../src/api/principals'
import type { PluginHostContext } from '../../src/shims'

let get: ReturnType<typeof vi.fn>

beforeEach(() => {
    get = vi.fn().mockResolvedValue({})
    setApi({
        get: get as never,
        post: vi.fn() as never,
        put: vi.fn() as never,
        patch: vi.fn() as never,
        delete: vi.fn() as never,
    } satisfies PluginHostContext['api'])
})

describe('api/principals', () => {
    it('reads the principals the caller can act as', async () => {
        get.mockResolvedValueOnce({
            principals: [{ id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null }],
        })

        const principals = await listMyPrincipals()

        expect(get).toHaveBeenCalledWith('/principals/me')
        expect(principals).toHaveLength(1)
    })

    it('shows no principal when the envelope is missing', async () => {
        // Every consumer reaches into this list immediately, so a missing
        // envelope has to degrade to "nothing is visible" rather than throw
        // mid-render.
        get.mockResolvedValueOnce({})

        await expect(listMyPrincipals()).resolves.toEqual([])
    })
})
