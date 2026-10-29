/**
 * Mounts a page inside the app's real dependencies. The router matters —
 * without one, `RouterLink`s render as bare elements and `useRoute()` reads
 * `START_LOCATION`, so a test asserts against a page unreachable in the app.
 */
import { vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import type { Component } from 'vue'
import type { Pinia } from 'pinia'
import { APP_ROUTES } from '../src/lib/routes'
import { HOST_CONTEXT_KEY, type PluginHostContext } from '../src/shims'
import { setApi } from '../src/api/client'

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
    options: { pinia?: Pinia; context?: PluginHostContext } = {},
): VueWrapper {
    const context = options.context ?? hostContext()
    setApi(context.api)

    return mount(component, {
        props,
        global: {
            plugins: options.pinia === undefined ? [] : [options.pinia],
            provide: { [HOST_CONTEXT_KEY as symbol]: context },
        },
    })
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
