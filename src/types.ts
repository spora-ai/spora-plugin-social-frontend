/**
 * The wire shapes of the social plugin's REST surface.
 *
 * Every type here mirrors the contract in
 * `spora-workspace/plans/spora-plugin-social.md → API contract`, field for
 * field. A field the plugin reads but the contract does not name is flagged
 * in the docblock where it appears.
 */

export type Platform = 'linkedin' | 'facebook' | 'instagram'

export type AccountKind = 'organization' | 'page' | 'member' | 'business'

export type AccountStatus = 'active' | 'expired' | 'revoked' | 'error'

/**
 * An account a connection covers.
 *
 * The token belongs to the connection, not to the account: one Meta login
 * publishes as an Instagram professional account *and* as a Facebook Page, so
 * the accounts carry only what is their own.
 */
export interface SocialAccount {
    id: number
    /** The same id under its own name — the backend sends both. */
    account_id: number
    platform: Platform
    kind: AccountKind
    external_id: string
    display_name: string
    username: string
    followers: number
    status: AccountStatus
    connected_at: string
    /**
     * Whether the account has numbers to report at all — a LinkedIn member
     * post has reactions and nothing else.
     */
    can_report: boolean
    /** Why it has not, in the platform's own terms. */
    report_note: string | null
}

/**
 * The OAuth side of the plugin: one provider, one token, many accounts.
 *
 * A connection is what a platform calls a login. Meta's login covers the
 * Instagram professional account *and* the Facebook Page under one token that
 * never expires; LinkedIn's covers a member and the organisations they
 * administer.
 */
export type Provider = 'meta' | 'linkedin'

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error'

export interface SocialConnection {
    id: number
    principal_id: number
    provider: Provider
    /** The portfolio the connection belongs to — Meta's client business id. */
    business_external_id: string | null
    /** Meta's configuration id; null where the platform has none. */
    config_id: string | null
    /** Null where the token does not expire: a Meta token never expires. */
    expires_at: string | null
    status: ConnectionStatus
    /** The token has to be renewed before a publish will work. */
    needs_reconnect: boolean
    scopes: string[]
    accounts: SocialAccount[]
    created_at: string
    updated_at: string
}

export type PostStatus =
    | 'draft'
    | 'scheduled'
    | 'publishing'
    | 'published'
    | 'partial'
    | 'failed'
    | 'cancelled'

export type TargetStatus = 'pending' | 'publishing' | 'published' | 'failed' | 'deleted'

export interface PostMetrics {
    /**
     * Every counter is `number | null`, and the two are different claims.
     *
     * **null** is a platform that does not report the counter at all — a
     * LinkedIn member post has reactions and nothing else, no reach and no
     * impressions. **0** is a counter that was read and came back zero. Only
     * the second one says "nobody saw it".
     */
    reach: number | null
    impressions: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
    clicks: number | null
    /** ISO timestamp of the reading, or null when nothing has been read yet. */
    measured_at: string | null
}

export interface PostTarget {
    id: number
    account_id: number
    platform: Platform
    status: TargetStatus
    external_id: string | null
    external_url: string | null
    error: string | null
    published_at: string | null
    metrics: PostMetrics | null
}

export interface PostMedia {
    /**
     * A Media Archive asset id.
     *
     * The contract's example shows a number, but core's `media_assets.id` is a
     * `uuid(36)` and the host's picker hands that id back as a string — a
     * number would not survive the round trip, so the id is carried as the
     * string the host actually produces.
     */
    media_asset_id: string
    position: number
    mime_type: string | null
    filename: string | null
    /**
     * The path core already stores on the media asset row, ready for an
     * `<img src>`.
     *
     * Null when the asset row is gone. The frontend never builds this path
     * itself: the extension belongs to the asset, not to the plugin.
     */
    asset_url: string | null
}

export interface PostAccountSummary {
    id: number
    platform: Platform
    display_name: string
}

export interface SocialPost {
    id: number
    principal_id: number
    title: string
    body: string
    /** A body per platform — the drafts that work for LinkedIn and Facebook differ. */
    platform_bodies: Partial<Record<Platform, string>>
    status: PostStatus
    /**
     * Who wrote the post. The static slot is gone, so an agent-written
     * post is the only automated one — the agent drafts the copy and calls
     * the `social_post` tool.
     */
    source: 'manual' | 'ai'
    scheduled_for: string | null
    timezone: string
    published_at: string | null
    accounts: PostAccountSummary[]
    targets: PostTarget[]
    media: PostMedia[]
    metrics: PostMetrics | null
    created_at: string
    updated_at: string
}

export interface PostList {
    items: SocialPost[]
    total: number
}

export interface CreatePostPayload {
    principal_id: number
    title: string
    body: string
    platform_bodies?: Partial<Record<Platform, string>>
    account_ids: number[]
    scheduled_for?: string | null
    timezone: string
    publish_now?: boolean
    media?: { media_asset_id: string; position: number }[]
}

/**
 * A post on the calendar.
 *
 * The month carries the posts and nothing else: the `days` key existed only
 * to carry the slots that tinted the grid, and the static slot is gone.
 */
export interface CalendarPost {
    post_id: number
    title: string
    status: PostStatus
    scheduled_for: string | null
    published_at: string | null
}

export interface CalendarPayload {
    posts: CalendarPost[]
}

export interface AnalyticsTotals {
    /**
     * Every counter is `number | null`, and the two are different claims.
     *
     * **null** is a counter nobody reported — a LinkedIn member post has no
     * impressions and no reach. **0** is a counter that was read and came
     * back zero. Only the second one says "nobody saw it".
     */
    reach: number | null
    impressions: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
    clicks: number | null
}

export interface NetworkTotals extends AnalyticsTotals {
    platform: Platform
    posts: number
}

export interface AnalyticsPoint {
    date: string
    /**
     * The reach each network reported that day.
     *
     * A key is **absent** when that network reported no reach — an absent key
     * is not a zero, and a day with one missing key must still add up.
     */
    linkedin?: number
    facebook?: number
    instagram?: number
}

export interface TopPost {
    post_id: number
    title: string
    platform: Platform
    /** Null when the network reported no reach for this post. */
    reach: number | null
    /** Null when the network reported no impressions for this post. */
    impressions: number | null
    /** Null when the network reported no likes for this post. */
    likes: number | null
    published_at: string | null
}

export interface AnalyticsSummary {
    totals: AnalyticsTotals
    by_network: NetworkTotals[]
    series: AnalyticsPoint[]
    top_posts: TopPost[]
    /** The per-platform caveats — the frontend renders them under the numbers. */
    notes: string[]
}

export interface AccountHealth {
    status: ConnectionStatus
    message: string
    checked_at: string
}

export interface ConnectAccountResult {
    authorize_url: string
    state: string
    expires_at: string
}

export interface MediaAssetSummary {
    id: string
    filename: string | null
    mime_type: string | null
    size_bytes: number
    width: number | null
    height: number | null
    asset_url: string | null
}

export interface MediaFitResult {
    platform: Platform
    fits: boolean
    reasons: string[]
    remedy: string | null
}

export interface MediaCheckFit {
    fits: boolean
    per_platform: MediaFitResult[]
}

export interface MediaPrepareResult {
    media_asset_id: string
    format: string
    url: string
    mime_type: string
}

/**
 * The setup notice for a provider, in the plugin's own wording.
 *
 * The plugin emits it and the host translates it, so the frontend renders it
 * as it comes: a copy of the wording here would be a second wording to keep in
 * step, in two languages.
 */
export interface ProviderSetupNotice {
    title: string
    body: string
}

/**
 * What this instance has configured for one provider.
 *
 * The `client_id` is what the operator registers with the platform, and
 * `configured` says whether there is an app id *and* a secret — which is what
 * the frontend needs to disable a connect button that cannot work.
 */
export interface ProviderConfig {
    configured: boolean
    client_id: string | null
    /** Meta's configuration id; null where the platform has none. */
    config_id: string | null
    /**
     * What the operator still has to do, in the plugin's wording.
     *
     * Null when the provider is set up, or when the backend does not send a
     * notice at all.
     */
    needs_setup: ProviderSetupNotice | null
}

/**
 * What one platform accepts.
 *
 * The limits live in the backend — it is what refuses the publish — and they
 * travel with the config, so a badge on an attachment cannot warn about a
 * number the backend no longer enforces.
 */
export interface PlatformRules {
    /** The network cannot publish a post without media. */
    media_required: boolean
    /** How many attachments a post may carry. */
    media_count: number
    /** The network fetches the media itself, so it needs a public URL. */
    fetches_media: boolean
    mime_types: string[]
    max_bytes: number
    max_text: number
    /** What the network accepts, in its own words. */
    media_note: string
    /** The remedy for an image the network refuses. */
    media_remedy: string
    /** The remedy for a video the network refuses. */
    video_remedy: string
    /** The remedy for a file that is too large. */
    size_remedy: string
}

export interface PostQuery {
    status?: string
    platform?: Platform
    account_id?: number
    limit?: number
    offset?: number
}

export interface SocialConfig {
    providers: Record<Provider, ProviderConfig>
    app_url: string | null
    app_url_public: boolean
    rules: Record<Platform, PlatformRules>
}

export interface DraftResult {
    title: string
    bodies: Partial<Record<Platform, string>>
    hashtags: string[]
}

/**
 * An attachment on the composer.
 *
 * The host's picker answers with its own asset shape, so the composer
 * normalises it once and every screen reads the same fields.
 */
export interface ComposerAttachment {
    media_asset_id: string
    filename: string
    mime_type: string
    size_bytes: number
    asset_url: string | null
}

/**
 * One post's analytics.
 *
 * The backend answers with the post and its targets — the same readings the
 * post itself carries, plus the caveat each target deserves — rather than
 * with a series.
 */
export interface PostAnalyticsTarget {
    target_id: number
    account_id: number
    platform: Platform
    status: TargetStatus
    external_id: string | null
    metrics: PostMetrics | null
    /** Why this target has no numbers to report. */
    report_note: string | null
}

export interface PostAnalytics {
    post_id: number
    title: string
    status: PostStatus
    targets: PostAnalyticsTarget[]
    notes: string[]
}

