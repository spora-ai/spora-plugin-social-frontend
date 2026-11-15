/**
 * The wire shapes of the social plugin's REST surface.
 *
 * Every type here mirrors the plugin's own resources — `SocialConnectionResource`
 * and `SocialPostResource` in `spora-plugin-social/src/Http` — field for
 * field. Those are what actually answers; a plan file is a design that may
 * still move.
 */

/**
 * A network, and the route to it.
 *
 * The pair is the identity: the same network reached through two routes is
 * two accounts with two tokens, and each has its own limits.
 *
 * **Both axes are plain strings.** Their sets are open — the plugin reaches
 * three networks on its own and reaches the rest through an aggregator,
 * whose list grows without the frontend's knowledge — so a `Network` type
 * would be `string` under a second name, and TypeScript would tell the two
 * axes apart no better than it does now. The names live in the fields and
 * in the docblocks.
 */
export interface Channel {
    /** The channel's key — the route, then the network. */
    key: string
    /** The network the channel reaches. */
    network: string
    /** The route to it — the plugin's own, or an aggregator's. */
    via: string
}

export type AccountKind = 'organization' | 'page' | 'member' | 'business' | 'aggregator'

export type AccountStatus = 'active' | 'expired' | 'revoked' | 'error' | 'disconnected'

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
    /** The network the account is on. */
    platform: string
    /** The route to it — the plugin's own, or an aggregator's. */
    via: string
    kind: AccountKind
    external_id: string
    display_name: string
    username: string
    /**
     * The account's audience — null when the platform does not report one.
     *
     * No platform reports an audience for a member account, and the backend
     * sends null rather than a zero: an audience nobody counted is not an
     * audience of none.
     */
    followers: number | null
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
 * Instagram professional account *and* the Facebook Page under one token;
 * LinkedIn's covers a member and the organisations they administer.
 */
export type Provider = 'meta' | 'linkedin'

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error'

export interface SocialConnection {
    id: number
    principal_id: number
    /**
     * The provider the connection belongs to.
     *
     * An OAuth provider for a login, an aggregator's slug for a key — and an
     * aggregator's slug is also the route its accounts publish through.
     *
     * A plain string, because the two kinds share one field: the plugin's
     * own providers are a closed set ({@see Provider}) and an aggregator's
     * slug is whatever the aggregator calls itself.
     */
    provider: string
    /** The portfolio the connection belongs to — Meta's client business id. */
    business_external_id: string | null
    /** Meta's configuration id; null where the platform has none. */
    config_id: string | null
    /** Null when the platform sent no expiry — the token may still have one. */
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
    /** The network the target went to. */
    platform: string
    /** The route it went through. */
    via: string
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
    /** The network the account is on. */
    platform: string
    /** The route to it. */
    via: string
    display_name: string
}

export interface SocialPost {
    id: number
    principal_id: number
    title: string
    body: string
    /**
     * A body per channel — the drafts that work for LinkedIn and Facebook
     * differ, and so do the two routes to the same network.
     *
     * The key is the channel's key: `direct:linkedin`, `zernio:bluesky`.
     */
    platform_bodies: Record<string, string>
    /**
     * The tags the post carries, without their hashes.
     *
     * The hashes are added when the post is composed for a channel, so one
     * post carries them once and every network gets them the same.
     */
    hashtags: string[]
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
    /** A body per channel, keyed by the channel's key. */
    platform_bodies?: Record<string, string>
    hashtags?: string[]
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
    /**
     * The channels the post goes to — one entry per target.
     *
     * Two targets on one channel arrive as two entries, because a target is
     * an account and a channel is a route to a network.
     */
    channels: Channel[]
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
    /** The network the numbers are about. */
    platform: string
    /**
     * The channel's key — the route, then the network.
     *
     * The row is a **channel**, not a network: the same network reached
     * through two routes is two accounts with two sets of numbers, and the
     * key is what tells the two rows apart.
     */
    channel: string
    /** The route the numbers came through. */
    via: string
    posts: number
}

export interface AnalyticsPoint {
    date: string
    /**
     * The reach each channel reported that day, keyed by the channel's key.
     *
     * A key is **absent** when that channel reported no reach — an absent key
     * is not a zero, and a day with one missing key must still add up.
     */
    [channel: string]: string | number | undefined
}

export interface TopPost {
    post_id: number
    title: string
    /**
     * The target the row is about — **absent when the backend sends no
     * target id**.
     *
     * The backend's rows are one per target, so the id is what tells two
     * accounts of the same channel on one post apart. It is optional because
     * **the plugin is released before the frontend**: a released frontend may
     * run against an older plugin release, and that one sends a row per
     * reading with no target to name. The frontend folds such a row by the
     * post, the route and the network instead.
     */
    target_id?: number
    platform: string
    /** The route the post went out through. */
    via: string
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

/** One channel's verdict on an attachment. */
export interface MediaFitResult {
    /** The channel's key — the route, then the network. */
    channel: string
    network: string
    via: string
    fits: boolean
    reasons: string[]
    remedy: string | null
    mime_type: string | null
}

export interface MediaCheckFit {
    fits: boolean
    per_channel: MediaFitResult[]
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
    /**
     * The URL the platform has to be given, when there is one to give.
     *
     * It is built from the address this instance is reached at, so the
     * operator cannot work it out — the backend sends it.
     *
     * Null when the instance has no address a platform accepts: a local one
     * is refused by every platform, and naming it would send the operator to
     * register something that cannot work.
     */
    redirect_uri: string | null
}

/**
 * What one channel accepts.
 *
 * The limits live in the backend — it is what refuses the publish — and they
 * travel with the config, so a badge on an attachment cannot warn about a
 * number the backend no longer enforces.
 */
export interface PlatformRules {
    /** The network's own name, as the operator knows it. */
    label: string
    /** The network the rule is about. */
    network: string
    /** The route to it. */
    via: string
    /** The network cannot publish a post without media. */
    media_required: boolean
    /** How many attachments a post may carry. */
    media_count: number
    /** The network fetches the media itself, so it needs a public URL. */
    fetches_media: boolean
    mime_types: string[]
    max_bytes: number
    max_text: number
    /**
     * How many characters the network shows before it hides the rest.
     *
     * A post can fit the limit and still say nothing in the first line —
     * this is what a reader sees before the network's "see more".
     */
    visible_chars: number
    /** What the network accepts, in its own words. */
    media_note: string
    /** The remedy for an image the network refuses. */
    media_remedy: string
    /** The remedy for a video the network refuses. */
    video_remedy: string
    /** The remedy for a file that is too large. */
    size_remedy: string
    /**
     * The network counts characters its own way, and the plugin cannot
     * compute that count.
     *
     * Null for every network that counts code points. The composer shows the
     * note where the number would be rather than a number it cannot stand
     * behind.
     */
    counting_note: string | null
}

/**
 * What one aggregator is set up for.
 *
 * The flag is **the principal's**: the key is the operator's, and it lives
 * on the connection row.
 */
export interface AggregatorConfig {
    configured: boolean
    /** The name the operator knows the aggregator by. */
    label: string
    needs_setup: string | null
}

/** What the aggregator's own routes answer with. */
export interface AggregatorResult {
    aggregator: string
    label: string
    configured: boolean
    /** The connection the key landed on. */
    connection_id?: number
    /** Whether the key is gone. */
    deleted?: boolean
    /** What the operation did, in the aggregator's own terms. */
    message?: string
}

/** What a sync read back. */
export interface AggregatorSyncResult {
    aggregator: string
    /** The accounts the aggregator reports. */
    accounts: number
    /** The accounts it no longer reports. */
    disconnected: number
    /** Whether the aggregator's analytics add-on is there. */
    analytics: boolean
}

/**
 * The networks the plugin reaches on its own route.
 *
 * The plugin's own OAuth covers these three; everything else it reaches
 * through an aggregator. The backend's `SocialPlatform` enum is the same
 * three, and it is what the media preparation endpoint speaks.
 */
export type NativeNetwork = 'linkedin' | 'facebook' | 'instagram'

export interface PostQuery {
    status?: string
    /** The network to filter by. */
    platform?: string
    account_id?: number
    limit?: number
    offset?: number
}

export interface SocialConfig {
    providers: Record<Provider, ProviderConfig>
    /**
     * The aggregators the plugin can publish through.
     *
     * Keyed by the aggregator's slug, which is also the route its accounts
     * publish through.
     */
    aggregators: Record<string, AggregatorConfig>
    app_url: string | null
    /** The rules, keyed by the channel's key. */
    rules: Record<string, PlatformRules>
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
    platform: string
    via: string
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
