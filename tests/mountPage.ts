/**
 * Mounts a page inside the app's real dependencies. The router matters —
 * without one, `RouterLink`s render as bare elements and `useRoute()` reads
 * `START_LOCATION`, so a test asserts against a page unreachable in the app.
 */
import { vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia } from 'pinia'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { Component } from 'vue'
import { APP_ROUTES } from '../src/lib/routes'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../src/shims'
import { setApi } from '../src/api/client'
import { usePrincipalsStore } from '../src/stores/principals'
import type { Principal } from '../src/api/principals'
import { makePrincipal } from './fixtures'

/** Derived from `APP_ROUTES`, so a spec always routes through the app's own table. */
export function stubRoutes(): Router {
    const stub = { template: '<div />' }
    return createRouter({
        history: createMemoryHistory(),
        routes: APP_ROUTES.map(({ path, name }) => ({ path, name, component: stub })),
    })
}

export function hostContext(overrides: Partial<PluginHostContext> = {}): PluginHostContext {
    return {
        api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
        pinia: null,
        theme: 'light',
        locale: 'en',
        route: null,
        router: null,
        openMediaPicker: vi.fn().mockResolvedValue([]),
        ...overrides,
    }
}

export function mountPage(
    component: Component,
    pinia: Pinia,
    router: Router = stubRoutes(),
    context: PluginHostContext = hostContext(),
): VueWrapper {
    // The API bridge is a module-level singleton that `main.ts` installs at
    // mount; the stores reach the host's client through it.
    setApi(context.api)

    return mount(component, {
        global: {
            plugins: [pinia, router],
            provide: { [HOST_CONTEXT_KEY as symbol]: context },
        },
    })
}

/** A component with no router — the ones that only take props. */
export function mountComponent(
    component: Component,
    props: Record<string, unknown> = {},
    options: { pinia?: Pinia; context?: PluginHostContext; router?: Router } = {},
): VueWrapper {
    const context = options.context ?? hostContext()
    setApi(context.api)

    const plugins = [
        ...(options.pinia === undefined ? [] : [options.pinia]),
        ...(options.router === undefined ? [] : [options.router]),
    ]

    return mount(component, {
        props,
        global: {
            plugins,
            provide: { [HOST_CONTEXT_KEY as symbol]: context },
        },
    })
}

/**
 * A page mounted the way the app mounts it.
 *
 * Every screen in the app scopes itself to a principal, so a test that mounts
 * one has to name that principal and put the router on a path first —
 * otherwise the page renders its "pick a principal" state and the assertion
 * is about the wrong screen.
 */
export interface MountedPage {
    wrapper: VueWrapper
    router: Router
    pinia: Pinia
}

export interface MountOptions {
    /** The principals the caller may act as. */
    principals?: Principal[]
    /** The acting principal. */
    selected?: number
    context?: PluginHostContext
}

export async function mountApp(
    component: Component,
    path: string | null = null,
    options: MountOptions = {},
): Promise<MountedPage> {
    const pinia = createPinia()
    const principals = usePrincipalsStore(pinia)
    principals.principals = options.principals ?? [makePrincipal()]
    principals.selectPrincipal(options.selected ?? 7)

    const router = stubRoutes()
    if (path !== null) {
        await router.push(path)
        await router.isReady()
    }

    const wrapper = mountPage(component, pinia, router, options.context ?? hostContext())
    await flushPromises()

    return { wrapper, router, pinia }
}

/**
 * Record which kind of navigation the router was asked for.
 *
 * The memory history's depth is not exposed, so the call itself is the
 * observation: a `replace` is what a context change must produce, and a
 * `push` is what a place the operator chose must produce.
 */
export function recordNavigation(router: Router): string[] {
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
