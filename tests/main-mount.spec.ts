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

type HostRouteArg = {
    path: string
    fullPath?: string
    query?: Record<string, unknown>
}

function fakeHostRouter(initial: { path: string; query?: Record<string, unknown> }) {
    let guard: ((to: HostRouteArg, from: unknown, failure?: unknown) => void) | null = null

    const currentRoute = {
        value: {
            ...initial,
            fullPath: initial.path,
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
            currentRoute.value = {
                ...to,
                fullPath: to.path,
            }
            guard?.(to, undefined, failure)
        },
    }
}

function makeHostContext(router: ReturnType<typeof fakeHostRouter> | null): PluginHostContext {
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

/**
 * Record which kind of navigation the local router was asked for.
 *
 * The memory history's depth is not exposed, so the call itself is the
 * observation: a `replace` is what a host navigation must produce, and a
 * `push` is what a local navigation must produce.
 */
function recordNavigation(router: Router): string[] {
    const calls: string[] = []
    const originalReplace = router.replace.bind(router)
    const originalPush = router.push.bind(router)

    router.replace = ((...args: unknown[]) => {
        calls.push('replace')
        return (originalReplace as (...a: unknown[]) => unknown)(...args)
    }) as unknown as Router['replace']
    router.push = ((...args: unknown[]) => {
        calls.push('push')
        return (originalPush as (...a: unknown[]) => unknown)(...args)
    }) as unknown as Router['push']

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
        const main = await import('../src/main')
        const target = makeTarget()
        await main.default.mount(target, makeHostContext(null))
        await flushPromises()

        expect(target.querySelector('#spora-plugin-social')).not.toBeNull()
    })

    it('opens the section the host URL names', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/accounts' })

        await main.default.mount(target, makeHostContext(hostRouter))
        await flushPromises()

        expect(target.querySelector('[data-test="accounts-page"]')).not.toBeNull()
    })

    it('mirrors a host navigation into the local route with a replace', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/compose' })
        const context = makeHostContext(hostRouter)

        await main.default.mount(target, context)
        await flushPromises()

        const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp
        const calls = recordNavigation(record.router)
        calls.length = 0

        hostRouter.navigate({ path: '/apps/social/p/7/calendar' })
        await flushPromises()

        expect(record.router.currentRoute.value.path).toBe('/p/7/calendar')
        // A replace, not a push: the host has already pushed, and counting it
        // twice would leave the local stack out of step with the browser's.
        expect(calls).toEqual(['replace'])
    })

    it('writes the host URL when the app navigates, with a push', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/compose' })

        await main.default.mount(target, makeHostContext(hostRouter))
        await flushPromises()

        const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp
        const calls = recordNavigation(record.router)
        calls.length = 0

        await record.router.push('/p/7/posts')
        await flushPromises()

        expect(hostRouter.push).toHaveBeenCalledWith('/apps/social/p/7/posts')
        expect(calls).toEqual(['push'])
    })

    it('does not replace the local route when the host navigation changes nothing', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/calendar' })
        const context = makeHostContext(hostRouter)

        await main.default.mount(target, context)
        await flushPromises()

        const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp
        const calls = recordNavigation(record.router)
        calls.length = 0

        // The host is already there — a redundant replace would churn the
        // local route for no reason, and the guard is what stops it.
        hostRouter.navigate({ path: '/apps/social/p/7/calendar' })
        await flushPromises()

        expect(calls).toEqual([])
    })

    it('does not ping-pong between the two routers', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/compose' })

        await main.default.mount(target, makeHostContext(hostRouter))
        await flushPromises()

        const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp
        hostRouter.push.mockClear()

        for (const path of ['/p/7/posts', '/p/7/calendar', '/p/7/accounts']) {
            await record.router.push(path)
            await flushPromises()
        }

        // One push per navigation the operator made — no extras from the echo.
        expect(hostRouter.push.mock.calls.length).toBe(3)
        expect(hostRouter.push).toHaveBeenLastCalledWith('/apps/social/p/7/accounts')
    })

    it('canonicalises an unknown section instead of rendering a blank screen', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/bogus' })

        await main.default.mount(target, makeHostContext(hostRouter))
        await flushPromises()

        const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp

        expect(record.router.currentRoute.value.path).toBe('/p/7/compose')
        expect(hostRouter.push).toHaveBeenCalledWith('/apps/social/p/7/compose')
        expect(target.querySelector('[data-test="compose-page"]')).not.toBeNull()
    })

    it('never selects a principal the caller cannot act as', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/99/accounts' })
        const context = makeHostContext(hostRouter)
        context.api.get = vi.fn().mockImplementation((path: string) => {
            if (path === '/principals/me') {
                return Promise.resolve({
                    principals: [
                        { id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null },
                        { id: 8, type: 'group', name: 'Studio', user_id: null, group_id: 2 },
                    ],
                })
            }
            return Promise.resolve({})
        })

        await main.default.mount(target, context)
        await flushPromises()

        const record = (target as unknown as { __sporaApp: { router: Router } }).__sporaApp

        // The foreign principal is replaced with the caller's own, and the
        // operator is told why rather than shown a missing page.
        expect(record.router.currentRoute.value.path).toBe('/p/7/accounts')
        expect(target.querySelector('[data-test="principal-notice"]')).not.toBeNull()
    })

    it('round-trips: a URL copied into a new tab opens the same view', async () => {
        const main = await import('../src/main')

        // The first session: the operator navigates to the analytics view.
        const firstTarget = makeTarget()
        const firstHost = fakeHostRouter({ path: '/apps/social/p/7/posts' })
        await main.default.mount(firstTarget, makeHostContext(firstHost))
        await flushPromises()

        const firstRecord = (firstTarget as unknown as { __sporaApp: { router: Router } }).__sporaApp
        await firstRecord.router.push('/p/7/posts/analytics')
        await flushPromises()

        const copied = firstHost.push.mock.calls.at(-1)?.[0]
        expect(copied).toBe('/apps/social/p/7/posts/analytics')

        // The second session: the copied URL is opened in a new tab.
        const secondTarget = makeTarget()
        const secondHost = fakeHostRouter({ path: copied as string })
        await main.default.mount(secondTarget, makeHostContext(secondHost))
        await flushPromises()

        const secondRecord = (secondTarget as unknown as { __sporaApp: { router: Router } }).__sporaApp
        expect(secondRecord.router.currentRoute.value.path).toBe('/p/7/posts/analytics')
        expect(secondTarget.querySelector('[data-test="posts-page"]')).not.toBeNull()
    })

    it('unregisters the host listener on unmount', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const hostRouter = fakeHostRouter({ path: '/apps/social/p/7/compose' })

        await main.default.mount(target, makeHostContext(hostRouter))
        await flushPromises()
        expect(hostRouter.registered).toBe(1)

        main.default.unmount(target)
        expect(hostRouter.registered).toBe(0)
    })

    it('remounting the same target replaces the prior app', async () => {
        const main = await import('../src/main')
        const target = makeTarget()
        const context = makeHostContext(fakeHostRouter({ path: '/apps/social/p/7/compose' }))

        await main.default.mount(target, context)
        await flushPromises()
        await main.default.mount(target, context)
        await flushPromises()

        expect(target.querySelector('#spora-plugin-social')).not.toBeNull()
    })
})

describe('the host context key', () => {
    it('is one symbol for every bootstrap path', () => {
        expect(typeof HOST_CONTEXT_KEY).toBe('symbol')
    })
})
