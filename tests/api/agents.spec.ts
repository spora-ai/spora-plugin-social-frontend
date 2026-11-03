import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setApi } from '../../src/api/client'
import { agentHasSocialTool, listAgents, type AgentSummary } from '../../src/api/agents'
import type { PluginHostContext } from '../../src/shims'

let get: ReturnType<typeof vi.fn>

beforeEach(() => {
    get = vi.fn().mockResolvedValue({ agents: [] })
    setApi({
        get: get as never,
        post: vi.fn() as never,
        put: vi.fn() as never,
        patch: vi.fn() as never,
        delete: vi.fn() as never,
    } satisfies PluginHostContext['api'])
})

/** An agent with the tools it runs with. */
function agent(id: number, tools: string[], principalId = 7): AgentSummary {
    return {
        id,
        name: `Agent ${id}`,
        description: null,
        principal_id: principalId,
        tools: tools.map((tool_name) => ({ tool_name })),
    }
}

describe('api/agents — the paths', () => {
    it('reads the agents of a principal', async () => {
        await listAgents(7)
        expect(get).toHaveBeenCalledWith('/agents', { principal_id: 7 })
    })

    it('reads a core endpoint, not one of the plugin’s own', async () => {
        // The plugin's own routes live under `/plugins/social/…`; the agents
        // are the host's.
        await listAgents(7)
        expect(get.mock.calls.map((call) => String(call[0])).some((path) => path.startsWith('/plugins/'))).toBe(false)
    })
})

describe('api/agents — the shapes', () => {
    it('reads the agents the backend sent', async () => {
        get.mockResolvedValueOnce({ agents: [agent(1, ['social_post'])] })
        const agents = await listAgents(7)

        expect(agents).toHaveLength(1)
        expect(agents[0]?.name).toBe('Agent 1')
    })

    it('reads an empty list when the answer carries no agents', async () => {
        get.mockResolvedValueOnce({})
        await expect(listAgents(7)).resolves.toEqual([])
    })

    it('drops an agent that belongs to another principal', async () => {
        // The request already names the principal; the answer is filtered
        // again, because an agent of another principal must never be offered.
        get.mockResolvedValueOnce({
            agents: [agent(1, ['social_post']), agent(2, ['social_post'], 9)],
        })

        const agents = await listAgents(7)

        expect(agents.map((entry) => entry.id)).toEqual([1])
    })
})

describe('agentHasSocialTool', () => {
    it('is true when the social_post tool is among the agent’s tools', () => {
        expect(agentHasSocialTool(agent(1, ['web_search', 'social_post']))).toBe(true)
    })

    it('is false when the agent has other tools but not this one', () => {
        expect(agentHasSocialTool(agent(1, ['web_search', 'social_calendar']))).toBe(false)
    })

    it('is false when the agent has no tools at all', () => {
        expect(agentHasSocialTool(agent(1, []))).toBe(false)
    })
})
