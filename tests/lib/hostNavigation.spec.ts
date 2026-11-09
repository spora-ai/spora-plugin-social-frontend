import { describe, it, expect } from 'vitest'
import {
    AGENT_PATH_PREFIX,
    agentPath,
    agentSchedulesPath,
    agentToolsPath,
    hostLinkAction,
    type PluginRouter,
} from '../../src/lib/hostNavigation'

describe('agentSchedulesPath', () => {
    it('names the host agent’s scheduled runs', () => {
        expect(AGENT_PATH_PREFIX).toBe('/agents/')
        expect(agentSchedulesPath(42)).toBe('/agents/42/scheduled-runs')
    })
})

describe('agentPath', () => {
    it('names the agent’s own page', () => {
        // The page that holds the agent's composer and its task history — the
        // chats it already has.
        expect(agentPath(42)).toBe('/agents/42')
    })
})

describe('agentToolsPath', () => {
    it('names the agent’s tools page', () => {
        expect(agentToolsPath(42)).toBe('/agents/42/tools')
    })
})

describe('hostLinkAction', () => {
    it('pushes when the host published a router', () => {
        const router: PluginRouter = { push: async () => undefined }

        expect(hostLinkAction(router, '/agents/42/scheduled-runs')).toEqual({
            kind: 'push',
            to: '/agents/42/scheduled-runs',
        })
    })

    it('disables the link when there is no router', () => {
        // A standalone page has no host SPA to navigate inside; the link
        // renders disabled rather than broken.
        expect(hostLinkAction(null, '/agents/42/scheduled-runs')).toEqual({ kind: 'disabled' })
    })

    it('disables the link when the router cannot push', () => {
        expect(hostLinkAction({} as unknown as PluginRouter, '/agents/42/scheduled-runs')).toEqual({
            kind: 'disabled',
        })
    })
})
