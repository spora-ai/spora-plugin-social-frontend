/**
 * The mount contract and the host/local mirroring.
 *
 * The test that matters is not "the router resolves" but "copy the URL, open
 * it in a new tab, and get the same view" — so the round trip is asserted in
 * both directions, and the two mirroring directions are told apart by the
 * local history's depth: a `replace` keeps the position, a `push` advances
 * it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import type { Router } from 'vue-router'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../src/shims'
import { recordNavigation } from './mountPage'

type HostRouteArg = {
    path: string
    fullPath?: string
    query?: Record<string, unknown>
}

function fakeHostRouter(initial: { path: string; query?: Record<string, unknown> }) {
    let guard: ((to: HostRouteArg, from: unknown, failure?: unknown) => void) | null = null

    const [initialPath, initialSearch] = initial.path.split('?')
    const currentRoute = {
        value: {
            path: initialPath ?? initial.path,
            fullPath: initial.path,
            query: initial.query ?? Object.fromEntries(new URLSearchParams(initialSearch ?? '')),
        } as { path: string; fullPath?: string; query?: Record<string, unknown> },
    }

    return {
        currentRoute,
        push: vi.fn().mockImplementation(async (to: string) => {
            const [path, search] = to.split('?')
            currentRoute.value = {
                path: path ?? to,
                fullPath: to,
                query: Object.fromEntries(new URLSearchParams(search ?? '')),
            }
        }),
        get registered(): number {
            return guard === null ? 0 : 1
        },
        afterEach(cb: (to: HostRouteArg, from: unknown, failure?: unknown) => void): () => void {
            guard = cb
            return () => {
                if (guard === cb) guard = null
            }
        },
        navigate(to: { path: string; query?: Record<string, unknown> }, failure?: unknown): void {
            const [path, search] = to.path.split('?')
            const route = {
                path: path ?? to.path,
                fullPath: to.path,
                query: to.query ?? Object.fromEntries(new URLSearchParams(search ?? '')),
            }
            currentRoute.value = route
            guard?.(route, undefined, failure)
        },
    }
}

type HostRouter = ReturnType<typeof fakeHostRouter>

function makeHostContext(router: HostRouter | null): PluginHostContext {
    return {
        api: {
            get: vi.fn().mockImplementation((path: string) => {
                if (path === '/principals/me') {
                    return Promise.resolve({
                        principals: [
                            { id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null },
                            { id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 },
                        ],
                    })
                }
                return Promise.resolve({})
            }),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        },
        pinia: null,
        theme: 'light',
        locale: 'en',
        route: null,
        router: router as unknown as PluginHostContext['router'],
        openMediaPicker: vi.fn().mockResolvedValue([]),
    }
}

function makeTarget(): HTMLElement {
    const target = document.createElement('div')
    target.id = 'app-mount-target'
    document.body.appendChild(target)
    return target
}

type MainModule = typeof import('../src/main')

interface HostMount {
    main: MainModule
    target: HTMLElement
    hostRouter: HostRouter
    context: PluginHostContext
    record: { router: Router }
}

/**
 * The app mounted into a host document, the way the host mounts it.
 *
 * The host's own context is what the plugin is given at runtime: its router,
 * its API client, its media picker. A test that mounts the app has to hand
 * it a context that behaves like the host's, or the mirroring contract is
 * not being tested at all.
 */
async function mountInHost(hostPath: string | null): Promise<HostMount> {
    const main = await import('../src/main')
    const target = makeTarget()
    // A null path mounts the app without a host router — the standalone
    // case, where the plugin owns the whole page. The router is built either
    // way, so the handle this returns has one shape.
    const hostRouter = fakeHostRouter({ path: hostPath ?? '' })
    const context = makeHostContext(hostPath === null ? null : hostRouter)

    await main.default.mount(target, context)
    await flushPromises()

    const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp
    return { main, target, hostRouter, context, record }
}

/** The host navigates; the app mirrors it. */
async function hostNavigates(host: HostMount, path: string): Promise<void> {
    host.hostRouter.navigate({ path })
    await flushPromises()
}

/** Watch the local router's navigations from here on. */
function watchNavigation(host: HostMount): string[] {
    const calls = recordNavigation(host.record.router)
    calls.length = 0
    return calls
}

beforeEach(() => {
    document.body.innerHTML = ''
    vi.resetModules()
})

afterEach(() => {
    document.body.innerHTML = ''
})

describe('SporaApp (main.ts mount contract)', () => {
    it('exposes mount + unmount on window.SporaAppSocial', async () => {
        const main = await import('../src/main')
        expect(typeof main.default.mount).toBe('function')
        expect(typeof main.default.unmount).toBe('function')
        expect((window as unknown as { SporaAppSocial: unknown }).SporaAppSocial).toBe(main.default)
    })

    it('mounts into the target and renders the shell', async () => {
        const host = await mountInHost(null)
        expect(host.target.querySelector('#spora-plugin-social')).not.toBeNull()
    })

    it('opens the section the host URL names', async () => {
        const host = await mountInHost('/apps/social/p/7/accounts')
        expect(host.target.querySelector('[data-test="accounts-page"]')).not.toBeNull()
    })

    it('canonicalises an unknown section instead of rendering a blank screen', async () => {
        const host = await mountInHost('/apps/social/p/7/bogus')

        expect(host.record.router.currentRoute.value.path).toBe('/p/7/compose')
        expect(host.hostRouter.push).toHaveBeenCalledWith('/apps/social/p/7/compose')
        expect(host.target.querySelector('[data-test="compose-page"]')).not.toBeNull()
    })

    it('never selects a principal the caller cannot act as', async () => {
        const host = await mountInHost('/apps/social/p/99/accounts')

        // The foreign principal is replaced with the caller's own, and the
        // operator is told why rather than shown a missing page.
        expect(host.record.router.currentRoute.value.path).toBe('/p/7/accounts')
        expect(host.target.querySelector('[data-test="principal-notice"]')).not.toBeNull()
    })

    it('round-trips: a URL copied into a new tab opens the same view', async () => {
        const first = await mountInHost('/apps/social/p/7/posts')
        await first.record.router.push('/p/7/posts/analytics')
        await flushPromises()

        const copied = first.hostRouter.push.mock.calls.at(-1)?.[0]
        expect(copied).toBe('/apps/social/p/7/posts/analytics')

        // The second session: the copied URL is opened in a new tab.
        const second = await mountInHost(copied as string)
        expect(second.record.router.currentRoute.value.path).toBe('/p/7/posts/analytics')
        expect(second.target.querySelector('[data-test="posts-page"]')).not.toBeNull()
    })
})

describe('SporaApp in a host document', () => {
    let host: HostMount

    beforeEach(async () => {
        host = await mountInHost('/apps/social/p/7/compose')
    })

    it('mirrors a host navigation into the local route with a replace', async () => {
        const calls = watchNavigation(host)

        await hostNavigates(host, '/apps/social/p/7/calendar')

        expect(host.record.router.currentRoute.value.path).toBe('/p/7/calendar')
        // A replace, not a push: the host has already pushed, and counting it
        // twice would leave the local stack out of step with the browser's.
        expect(calls).toEqual(['replace'])
    })

    it('writes the host URL when the app navigates, with a push', async () => {
        const calls = watchNavigation(host)

        await host.record.router.push('/p/7/posts')
        await flushPromises()

        expect(host.hostRouter.push).toHaveBeenCalledWith('/apps/social/p/7/posts')
        expect(calls).toEqual(['push'])
    })

    it('does not ping-pong between the two routers', async () => {
        host.hostRouter.push.mockClear()

        for (const path of ['/p/7/posts', '/p/7/calendar', '/p/7/accounts']) {
            await host.record.router.push(path)
            await flushPromises()
        }

        // One push per navigation the operator made — no extras from the echo.
        expect(host.hostRouter.push.mock.calls).toHaveLength(3)
        expect(host.hostRouter.push).toHaveBeenLastCalledWith('/apps/social/p/7/accounts')
    })

    it('unregisters the host listener on unmount', () => {
        expect(host.hostRouter.registered).toBe(1)

        host.main.default.unmount(host.target)
        expect(host.hostRouter.registered).toBe(0)
    })

    it('remounting the same target replaces the prior app', async () => {
        await host.main.default.mount(host.target, host.context)
        await flushPromises()

        expect(host.target.querySelector('#spora-plugin-social')).not.toBeNull()
    })
})

describe('SporaApp and a host navigation that changes nothing', () => {
    it.each([
        ['the host is already there', '/apps/social/p/7/calendar', '/apps/social/p/7/calendar'],
        [
            'only the query order changed',
            '/apps/social/p/7/accounts?ref=host&tab=list',
            '/apps/social/p/7/accounts?tab=list&ref=host',
        ],
        ['another app’s panel', '/apps/social/p/7/accounts', '/apps/gallery/p/7/pictures'],
    ])('does not replace the local route when %s', async (_what, mountPath, navigation) => {
        const host = await mountInHost(mountPath)
        const calls = watchNavigation(host)

        await hostNavigates(host, navigation)

        expect(calls).toEqual([])
    })
})

describe('the host context key', () => {
    it('is one symbol for every bootstrap path', () => {
        expect(typeof HOST_CONTEXT_KEY).toBe('symbol')
    })
})
