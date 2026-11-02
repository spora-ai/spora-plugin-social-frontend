/**
 * The host's agents — a **core** endpoint, not one of the plugin's own.
 *
 * The plugin's own REST surface lives under `/plugins/social/…` and answers
 * from the plugin's own controllers (see `api/social.ts` for that boundary).
 * `GET /agents` belongs to core, so it is read through the same host client:
 * the plugin asks the host which agents a principal has, and never speaks to
 * core's controllers itself.
 */
import { getApi } from './client'

/** The tool an agent writes a post with — the name the host publishes. */
const SOCIAL_POST_TOOL = 'social_post'

export interface AgentToolSummary {
    tool_name: string
}

export interface AgentSummary {
    id: number
    name: string
    description: string | null
    /** The agent's **enabled** tools — a tool that is off is not on the list. */
    tools: AgentToolSummary[]
}

/**
 * The agents of a principal.
 *
 * Only the principal's own agents come back: an agent of another principal is
 * out of the operator's reach, and a post must not be handed to it.
 */
export async function listAgents(principalId: number): Promise<AgentSummary[]> {
    const result = await getApi().get<{ agents?: AgentSummary[] }>('/agents', {
        principal_id: principalId,
    })
    return result.agents ?? []
}

/**
 * Whether the agent can write a post at all.
 *
 * The tool has to be enabled on the agent — one without it cannot reach the
 * social plugin, so the operator has to turn it on first.
 */
export function agentHasSocialTool(agent: AgentSummary): boolean {
    return agent.tools.some((tool) => tool.tool_name === SOCIAL_POST_TOOL)
}
