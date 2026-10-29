import { describe, it, expect, vi } from 'vitest'
import { getApi, setApi } from '../../src/api/client'
import type { PluginHostContext } from '../../src/shims'

describe('api/client', () => {
    it('serves the API the registry installed', () => {
        const api = {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        } satisfies PluginHostContext['api']

        setApi(api)

        expect(getApi()).toBe(api)
    })

    it('refuses to serve an API that was never installed', async () => {
        // A fresh module registry, so the bridge is as empty as it is before
        // `main.ts` installs the host's client.
        vi.resetModules()
        const { getApi: freshGetApi } = await import('../../src/api/client')

        expect(() => freshGetApi()).toThrow('Plugin API not initialized')
    })
})
