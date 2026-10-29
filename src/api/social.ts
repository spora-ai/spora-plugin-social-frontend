/**
 * The social plugin's REST surface.
 *
 * Every route lives under `/api/v1/plugins/social` — the host's client owns
 * the `/api/v1` base, so the paths here start at `/plugins/social`. The
 * contract is the one in `spora-workspace/plans/spora-plugin-social.md →
 * API contract`; the paths below are literal.
 *
 * **The principal is always explicit.** It arrives as `principal_id` in the
 * query for reads and in the body for writes. A request without one is a 422
 * — never "all visible principals" — so no call site here may omit it.
 */
import { getApi } from './client'
import type {
    AccountHealth,
    AnalyticsSummary,
    CalendarPayload,
    ConnectAccountResult,
    CreatePostPayload,
    DraftResult,
    MediaAssetSummary,
    MediaCheckFit,
    MediaPrepareResult,
    Platform,
    Provider,
    ProviderConfig,
    ProviderSetupNotice,
    PostAnalytics,
    PostQuery,
    PostList,
    SocialConnection,
    SocialConfig,
    SocialPost,
} from '../types'

const BASE = '/plugins/social'

/**
 * A list the backend answers with.
 *
 * The backend sends a bare JSON array, which the host's client unwraps from
 * the `{ data: … }` envelope. It is read as one, and a shape change is
 * **loud**: a list that arrives as something else throws here rather than
 * quietly becoming an empty screen — an invented envelope is how the two
 * halves came to disagree about a payload without anyone noticing.
 */
function readList<T>(result: unknown, what: string): T[] {
    if (!Array.isArray(result)) {
        throw new Error(`${what} did not answer with a list.`)
    }
    return result as T[]
}

/**
 * A path that names the principal for a request the host's client cannot
 * carry one on.
 *
 * The host's `delete` takes neither a query nor a body, and the backend
 * reads the principal from the query or the body — so a DELETE builds its
 * own query here rather than waiting for a host API that is not published.
 */
function withPrincipal(path: string, principalId: number): string {
    return `${path}?principal_id=${principalId}`
}

/**
 * The connections of a principal, each with the accounts it covers.
 *
 * One login per provider: a Meta connection publishes as an Instagram
 * professional account *and* as a Facebook Page, under one token.
 */
export async function listConnections(principalId: number): Promise<SocialConnection[]> {
    return readList<SocialConnection>(
        await getApi().get<unknown>(`${BASE}/connections`, { principal_id: principalId }),
        'The connections',
    )
}

export async function getConnection(principalId: number, id: number): Promise<SocialConnection> {
    return getApi().get<SocialConnection>(`${BASE}/connections/${id}`, { principal_id: principalId })
}

/**
 * Start the OAuth round trip. The backend signs a `state` that carries the
 * principal, the provider and a nonce, and answers with the URL the browser
 * has to visit.
 */
export async function connectProvider(
    principalId: number,
    provider: Provider,
): Promise<ConnectAccountResult> {
    return getApi().post<ConnectAccountResult>(`${BASE}/connections/connect`, {
        principal_id: principalId,
        provider,
    })
}

export async function disconnectConnection(
    principalId: number,
    id: number,
): Promise<{ deleted: true }> {
    return getApi().delete<{ deleted: true }>(withPrincipal(`${BASE}/connections/${id}`, principalId))
}

export async function refreshConnection(
    principalId: number,
    id: number,
): Promise<SocialConnection> {
    return getApi().post<SocialConnection>(`${BASE}/connections/${id}/refresh`, {
        principal_id: principalId,
    })
}

export async function checkConnectionHealth(
    principalId: number,
    id: number,
): Promise<AccountHealth> {
    return getApi().post<AccountHealth>(`${BASE}/connections/${id}/health`, {
        principal_id: principalId,
    })
}

/**
 * What the operator has configured, and what the platforms accept.
 *
 * The rules travel with the providers: the composer's counters and the badge
 * on an attachment read the limits from here, because the backend is what
 * refuses the publish. A copy in the frontend warns about a number the
 * backend no longer enforces.
 */
export async function getConfig(): Promise<SocialConfig> {
    const result = await getApi().get<Partial<SocialConfig>>(`${BASE}/config`)
    return {
        providers: {
            meta: readProviderConfig(result.providers?.meta),
            linkedin: readProviderConfig(result.providers?.linkedin),
        },
        app_url: result.app_url ?? null,
        app_url_public: result.app_url_public === true,
        rules: result.rules ?? ({} as SocialConfig['rules']),
    }
}

/**
 * One provider's entry.
 *
 * A missing entry means "not configured", and so does a missing field — the
 * flag is read as a truthiness check, so a malformed entry cannot slip
 * through as "configured".
 */
function readProviderConfig(entry: Partial<ProviderConfig> | undefined): ProviderConfig {
    return {
        configured: entry?.configured === true,
        client_id: entry?.client_id ?? null,
        config_id: entry?.config_id ?? null,
        needs_setup: readSetupNotice(entry?.needs_setup),
    }
}

/**
 * The provider's setup notice, as the backend words it.
 *
 * A notice that is absent, or that carries no wording, is no notice: the card
 * must not render empty.
 */
function readSetupNotice(
    notice: Partial<ProviderSetupNotice> | null | undefined,
): ProviderSetupNotice | null {
    if (notice === null || notice === undefined) return null
    if (typeof notice.title !== 'string' || notice.title.trim() === '') return null
    if (typeof notice.body !== 'string' || notice.body.trim() === '') return null
    return { title: notice.title, body: notice.body }
}

export async function listPosts(principalId: number, query: PostQuery = {}): Promise<PostList> {
    const result = await getApi().get<PostList>(`${BASE}/posts`, {
        principal_id: principalId,
        ...query,
    })
    return { items: result.items ?? [], total: result.total ?? 0 }
}

export async function createPost(payload: CreatePostPayload): Promise<SocialPost> {
    return getApi().post<SocialPost>(`${BASE}/posts`, payload)
}

export async function getPost(principalId: number, id: number): Promise<SocialPost> {
    return getApi().get<SocialPost>(`${BASE}/posts/${id}`, { principal_id: principalId })
}

export async function updatePost(
    principalId: number,
    id: number,
    payload: Partial<CreatePostPayload>,
): Promise<SocialPost> {
    return getApi().patch<SocialPost>(`${BASE}/posts/${id}`, { ...payload, principal_id: principalId })
}

export async function deletePost(principalId: number, id: number): Promise<{ deleted: true }> {
    return getApi().delete<{ deleted: true }>(withPrincipal(`${BASE}/posts/${id}`, principalId))
}

/** Publish now. The per-target outcome rides back on the post's targets. */
export async function publishPost(principalId: number, id: number): Promise<SocialPost> {
    return getApi().post<SocialPost>(`${BASE}/posts/${id}/publish`, { principal_id: principalId })
}

/** Re-publish only the failed targets. */
export async function retryPost(principalId: number, id: number): Promise<SocialPost> {
    return getApi().post<SocialPost>(`${BASE}/posts/${id}/retry`, { principal_id: principalId })
}

/**
 * Take the published post back down.
 *
 * The per-target outcome rides back on the post's targets: a network that
 * cannot delete — Instagram — leaves its target published and says why.
 */
export async function unpublishPost(principalId: number, id: number): Promise<SocialPost> {
    return getApi().delete<SocialPost>(withPrincipal(`${BASE}/posts/${id}/published`, principalId))
}

export async function getCalendar(principalId: number, month: string): Promise<CalendarPayload> {
    const result = await getApi().get<Partial<CalendarPayload>>(`${BASE}/calendar`, {
        principal_id: principalId,
        month,
    })
    // The month carries the posts and nothing else: the `days` key existed
    // only for the slot tint, and the static slot is gone.
    return { posts: result.posts ?? [] }
}

/**
 * The analytics summary.
 *
 * The envelope is opened here rather than at the call sites: every consumer
 * reaches into `by_network`, `series`, `top_posts` and `notes` immediately, so
 * a partial payload must degrade to empty lists rather than throw mid-render.
 */
export async function getAnalyticsSummary(principalId: number, days = 30): Promise<AnalyticsSummary> {
    const result = await getApi().get<Partial<AnalyticsSummary>>(`${BASE}/analytics/summary`, {
        principal_id: principalId,
        days,
    })
    return {
        totals: result.totals ?? {
            // Nothing was reported, which is not the same as nothing reached
            // anybody.
            reach: null,
            impressions: null,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
        },
        by_network: result.by_network ?? [],
        series: result.series ?? [],
        top_posts: result.top_posts ?? [],
        notes: result.notes ?? [],
    }
}

export async function getPostAnalytics(principalId: number, postId: number): Promise<PostAnalytics> {
    return getApi().get<PostAnalytics>(`${BASE}/analytics/posts/${postId}`, {
        principal_id: principalId,
    })
}

export async function listMedia(
    principalId: number,
    mediaKind: 'image' | 'image+document' = 'image',
): Promise<MediaAssetSummary[]> {
    return readList<MediaAssetSummary>(
        await getApi().get<unknown>(`${BASE}/media`, {
            principal_id: principalId,
            media_kind: mediaKind,
        }),
        'The media assets',
    )
}

export async function checkMediaFit(
    principalId: number,
    mediaAssetId: string,
    platforms: Platform[],
): Promise<MediaCheckFit> {
    return getApi().post<MediaCheckFit>(`${BASE}/media/check-fit`, {
        principal_id: principalId,
        media_asset_id: mediaAssetId,
        platforms,
    })
}

/** Instagram's step: the JPEG derivative and the public URL Instagram will fetch. */
export async function prepareMedia(
    principalId: number,
    mediaAssetId: string,
    platform: Platform,
): Promise<MediaPrepareResult> {
    return getApi().post<MediaPrepareResult>(`${BASE}/media/prepare`, {
        principal_id: principalId,
        media_asset_id: mediaAssetId,
        platform,
    })
}

export async function attachMedia(
    principalId: number,
    postId: number,
    mediaAssetId: string,
    position: number,
): Promise<SocialPost> {
    return getApi().post<SocialPost>(`${BASE}/media/attach`, {
        principal_id: principalId,
        post_id: postId,
        media_asset_id: mediaAssetId,
        position,
    })
}

export async function detachMedia(
    principalId: number,
    postId: number,
    mediaAssetId: string,
): Promise<SocialPost> {
    return getApi().post<SocialPost>(`${BASE}/media/detach`, {
        principal_id: principalId,
        post_id: postId,
        media_asset_id: mediaAssetId,
    })
}

/** A body per platform — the drafts that work for LinkedIn and Facebook differ. */
export async function generateDraft(payload: {
    principal_id: number
    brief: string
    platforms: Platform[]
    account_ids: number[]
}): Promise<DraftResult> {
    return getApi().post<DraftResult>(`${BASE}/drafts/generate`, payload)
}
