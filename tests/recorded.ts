/**
 * The backend's payloads, transcribed from its own builders.
 *
 * These are **recorded**, not invented: each one is the shape
 * `spora-plugin-social` answers with, copied from the resource and
 * controller that builds it. The source is named above every payload.
 *
 * An invented fixture is how the two halves came to disagree about the
 * config endpoint without anyone noticing — the frontend read
 * `linkedin: boolean` while the backend sent `linkedin: { configured, client_id }`,
 * and the mismatch only showed up when the real backend answered. A payload
 * recorded from the other half fails a test the moment either side changes.
 */
import type {
    AnalyticsSummary,
    CalendarPayload,
    MediaAssetSummary,
    SocialConfig,
    SocialConnection,
} from '../src/types'

/**
 * `GET /api/v1/plugins/social/config` — `SocialConnectionController::config()`.
 *
 * The **providers** are entries, not flags: the client id is what the operator
 * registers with the platform, and `configured` says whether there is an app
 * id *and* a secret. The **redirect URI** rides along: the accounts screen
 * shows it so the operator can copy it into the platform's own form.
 *
 * `needs_setup` is the setup notice in the plugin's own wording: the plugin
 * emits it and the host translates it, so the frontend renders it as it comes.
 *
 * The **aggregators** are a section of their own: an aggregator is not an
 * OAuth provider — it has no client id and no redirect URI, only a key. The
 * flag is **the principal's**, so the request names one.
 *
 * The **rules** are the backend's own limits — it is what refuses the
 * publish, so the frontend must not keep a copy of them. They are keyed by
 * the **channel's key**: the route, then the network. The same network on
 * two routes is two channels with two sets of limits.
 */
export const CONFIG_PAYLOAD = {
    providers: {
        meta: {
            configured: true,
            client_id: 'spora-meta-app-id',
            config_id: '9876',
            // The notice is sent exactly when the provider needs setup, and
            // `configured` is that same answer.
            needs_setup: null,
            redirect_uri: 'https://spora.example.com/api/v1/plugins/social/oauth/meta/callback',
        },
        linkedin: {
            configured: true,
            client_id: 'spora-linkedin-app-id',
            config_id: null,
            needs_setup: null,
            redirect_uri: 'https://spora.example.com/api/v1/plugins/social/oauth/linkedin/callback',
        },
    },
    aggregators: {
        zernio: {
            // The principal has no key yet.
            configured: false,
            label: 'Zernio',
            needs_setup: null,
        },
    },
    app_url: 'https://spora.example.com',
    app_url_public: true,
    rules: {
        'direct:linkedin': {
            label: 'LinkedIn',
            network: 'linkedin',
            via: 'direct',
            media_required: false,
            media_count: 1,
            fetches_media: false,
            mime_types: ['image/jpeg', 'image/png', 'image/gif'],
            max_bytes: 8388608,
            max_text: 3000,
            visible_chars: 200,
            media_note: 'LinkedIn accepts JPEG, PNG or GIF, up to 8 MB.',
            media_remedy: 'Convert to JPEG',
            video_remedy: 'Convert the file to MP4',
            size_remedy: 'Compress',
            counting_note: null,
        },
        'direct:facebook': {
            label: 'Facebook',
            network: 'facebook',
            via: 'direct',
            media_required: false,
            media_count: 1,
            fetches_media: false,
            mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'video/mp4'],
            max_bytes: 1073741824,
            max_text: 63206,
            visible_chars: 125,
            media_note: 'Facebook accepts JPEG, PNG, GIF, BMP or MP4, up to 1 GB.',
            media_remedy: 'Convert to JPEG',
            video_remedy: 'Convert to JPEG',
            size_remedy: 'Compress',
            counting_note: null,
        },
        'direct:instagram': {
            label: 'Instagram',
            network: 'instagram',
            via: 'direct',
            media_required: true,
            media_count: 1,
            fetches_media: true,
            mime_types: ['image/jpeg', 'video/mp4'],
            max_bytes: 104857600,
            max_text: 2200,
            visible_chars: 125,
            media_note: 'Instagram accepts JPEG or MP4, up to 100 MB.',
            media_remedy: 'Convert to JPEG',
            video_remedy: 'Convert the file to MP4',
            size_remedy: 'Compress',
            counting_note: null,
        },
        'zernio:linkedin': {
            label: 'LinkedIn',
            network: 'linkedin',
            via: 'zernio',
            media_required: false,
            media_count: 1,
            fetches_media: true,
            mime_types: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'video/mp4',
                'video/quicktime',
                'video/x-msvideo',
            ],
            max_bytes: 5368709120,
            max_text: 3000,
            visible_chars: 200,
            media_note:
                'LinkedIn accepts JPEG, PNG or GIF up to 8 MB, or an MP4, MOV or AVI video up to 5 GB.',
            media_remedy: 'Convert to JPEG',
            video_remedy: 'Convert the file to MP4',
            size_remedy: 'Compress',
            counting_note: null,
        },
        'zernio:bluesky': {
            label: 'Bluesky',
            network: 'bluesky',
            via: 'zernio',
            media_required: false,
            media_count: 1,
            fetches_media: true,
            mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'],
            max_bytes: 52428800,
            max_text: 300,
            visible_chars: 300,
            media_note: 'Bluesky accepts JPEG, PNG, WebP or GIF up to 1 MB, or an MP4 video up to 50 MB.',
            media_remedy: 'Convert to JPEG',
            video_remedy: 'Convert the file to MP4',
            size_remedy: 'Compress',
            counting_note: null,
        },
        'zernio:twitter': {
            label: 'X',
            network: 'twitter',
            via: 'zernio',
            media_required: false,
            media_count: 1,
            fetches_media: true,
            mime_types: [
                'image/jpeg',
                'image/png',
                'image/webp',
                'image/gif',
                'video/mp4',
                'video/quicktime',
            ],
            max_bytes: 536870912,
            max_text: 280,
            visible_chars: 280,
            media_note:
                'X accepts JPEG, PNG, WebP or GIF up to 5 MB, or an MP4 or MOV video up to 512 MB.',
            media_remedy: 'Convert to JPEG',
            video_remedy: 'Convert the file to MP4',
            size_remedy: 'Compress',
            // X counts a URL as 23 characters and an emoji as 2, so the
            // plugin's own count is wrong for it.
            counting_note:
                'X counts a URL as 23 characters whatever its length, and an emoji as 2, so the number of characters in the body is not the number X counts.',
        },
    },
} satisfies SocialConfig

/**
 * The same endpoint on an instance where nothing is set up yet: the notice
 * appears, in the plugin's own wording, and `configured` is false.
 */
export const UNCONFIGURED_CONFIG_PAYLOAD = {
    providers: {
        meta: {
            configured: false,
            client_id: null,
            config_id: null,
            needs_setup: {
                title: 'Meta integration needs setup',
                body: 'Add the app id, the app secret and the configuration id in Settings → Plugins.',
            },
            // The URL does not depend on the credentials: it is built from the
            // address this instance is reached at.
            redirect_uri: 'https://spora.example.com/api/v1/plugins/social/oauth/meta/callback',
        },
        linkedin: {
            configured: false,
            client_id: null,
            config_id: null,
            needs_setup: {
                title: 'LinkedIn integration needs setup',
                body: 'Add the client id, the client secret and the requested permissions in Settings → Plugins.',
            },
            redirect_uri: 'https://spora.example.com/api/v1/plugins/social/oauth/linkedin/callback',
        },
    },
    aggregators: CONFIG_PAYLOAD.aggregators,
    app_url: 'https://spora.example.com',
    app_url_public: true,
    rules: CONFIG_PAYLOAD.rules,
} satisfies SocialConfig

/**
 * `GET /api/v1/plugins/social/connections` —
 * `SocialConnectionController::connections()`.
 *
 * A **bare array**, not an envelope. One login per provider: the Meta
 * connection covers an Instagram professional account *and* a Facebook Page.
 *
 * The third connection is an **aggregator's**: the slug is its provider, and
 * the accounts it covers carry the route they publish through.
 */
export const CONNECTIONS_PAYLOAD = [
    {
        id: 1,
        principal_id: 7,
        provider: 'meta',
        business_external_id: '123456',
        config_id: '9876',
        // The platform sent no expiry.
        expires_at: null,
        status: 'active',
        needs_reconnect: false,
        scopes: ['instagram_basic', 'instagram_content_publish'],
        accounts: [
            {
                id: 12,
                account_id: 12,
                platform: 'instagram',
                via: 'direct',
                kind: 'business',
                external_id: '178400991',
                display_name: 'Fabeat Studio',
                username: 'fabeat.studio',
                followers: null,
                status: 'active',
                connected_at: '2026-10-20T08:12:00+00:00',
                can_report: true,
                report_note: null,
            },
            {
                id: 13,
                account_id: 13,
                platform: 'facebook',
                via: 'direct',
                kind: 'page',
                external_id: '118220094771',
                display_name: 'Fabeat GmbH',
                username: 'fabeatgmbh',
                followers: null,
                status: 'active',
                connected_at: '2026-10-20T08:12:00+00:00',
                can_report: true,
                report_note: null,
            },
        ],
        created_at: '2026-10-20T08:12:00+00:00',
        updated_at: '2026-10-20T08:12:00+00:00',
    },
    {
        id: 2,
        principal_id: 7,
        provider: 'linkedin',
        business_external_id: null,
        config_id: null,
        expires_at: '2026-12-26T10:00:00+00:00',
        status: 'active',
        needs_reconnect: false,
        scopes: ['openid', 'profile', 'email', 'w_member_social'],
        accounts: [
            {
                id: 14,
                account_id: 14,
                platform: 'linkedin',
                via: 'direct',
                kind: 'member',
                external_id: 'urn:li:person:4471209',
                display_name: 'Anna Sommer',
                username: 'annasommer',
                followers: null,
                status: 'active',
                connected_at: '2026-06-09T08:12:00+00:00',
                // A member post has reactions and nothing else.
                can_report: false,
                report_note: 'Member posts report reactions only — no impressions.',
            },
        ],
        created_at: '2026-06-09T08:12:00+00:00',
        updated_at: '2026-06-09T08:12:00+00:00',
    },
    {
        id: 3,
        principal_id: 7,
        provider: 'zernio',
        business_external_id: null,
        config_id: null,
        // A key does not expire.
        expires_at: null,
        status: 'active',
        needs_reconnect: false,
        scopes: [],
        accounts: [
            {
                id: 15,
                account_id: 15,
                platform: 'bluesky',
                via: 'zernio',
                kind: 'aggregator',
                external_id: '66b2a1c0',
                display_name: 'Fabeat on Bluesky',
                username: 'fabeat.bsky.social',
                followers: null,
                status: 'active',
                connected_at: '2026-11-03T09:00:00+00:00',
                can_report: false,
                report_note: null,
            },
        ],
        created_at: '2026-11-03T09:00:00+00:00',
        updated_at: '2026-11-03T09:00:00+00:00',
    },
] satisfies SocialConnection[]

/**
 * `GET /api/v1/plugins/social/media` — `SocialMediaController::media()`.
 *
 * A **bare array**, not an envelope.
 */
export const MEDIA_PAYLOAD = [
    {
        id: '9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f',
        filename: 'chart.png',
        mime_type: 'image/png',
        size_bytes: 298000,
        width: 1200,
        height: 630,
        asset_url: '/api/v1/assets/9f1c2d3e-4a5b-6c7d-8e9f-0a1b2c3d4e5f.png',
    },
] satisfies MediaAssetSummary[]

/**
 * `GET /api/v1/plugins/social/calendar` — `SocialScheduleController::calendar()`.
 *
 * The posts of a month are keyed by `post_id`, and carry both dates.
 *
 * The **channels** go along: one entry per target, each naming the channel's
 * key, the network and the route. Two targets on one channel arrive as two
 * entries — a target is an account, and a channel is a route to a network.
 */
export const CALENDAR_PAYLOAD = {
    posts: [
        {
            post_id: 88,
            title: 'Q4 release',
            status: 'scheduled',
            scheduled_for: '2026-11-02T09:00:00+00:00',
            published_at: null,
        },
    ],
} satisfies CalendarPayload

/**
 * `GET /api/v1/plugins/social/analytics/summary` —
 * `SocialMetricsService::summary()`.
 *
 * A counter nobody reported stays **null**, in the totals, in the network
 * rows and in the top posts. The series omits a network's key on a day that
 * network reported no reach.
 *
 * A row is a **channel**: the network and the route to it. The series is
 * keyed by the channel's key, so the same network on two routes is two
 * segments.
 */
export const SUMMARY_PAYLOAD = {
    totals: {
        reach: 4820,
        impressions: 9310,
        likes: 26,
        comments: 5,
        shares: 4,
        saves: 2,
        clicks: 21,
    },
    by_network: [
        {
            platform: 'linkedin',
            channel: 'direct:linkedin',
            via: 'direct',
            reach: 4820,
            impressions: 9310,
            likes: 20,
            comments: 4,
            shares: 3,
            saves: 0,
            clicks: 18,
            posts: 4,
        },
        {
            platform: 'instagram',
            channel: 'direct:instagram',
            via: 'direct',
            // A network that reported no reach: the counters nobody reported
            // are null, not zero.
            reach: null,
            impressions: null,
            likes: 6,
            comments: 1,
            shares: 1,
            saves: 2,
            clicks: 3,
            posts: 1,
        },
    ],
    series: [
        { date: '2026-10-01', 'direct:linkedin': 120, 'direct:facebook': 80 },
        { date: '2026-10-02', 'direct:linkedin': 240, 'direct:instagram': 90 },
    ],
    top_posts: [
        {
            post_id: 88,
            title: 'Q4 release',
            platform: 'linkedin',
            via: 'direct',
            reach: 4820,
            impressions: 9310,
            likes: 12,
            published_at: '2026-11-02T09:00:04+00:00',
        },
        {
            post_id: 89,
            title: 'Studio launch',
            platform: 'instagram',
            via: 'direct',
            reach: null,
            impressions: null,
            likes: null,
            published_at: null,
        },
    ],
    notes: ['LinkedIn member posts report reactions only — the reach column is empty by design.'],
} satisfies AnalyticsSummary

/**
 * The same endpoint for a network reached through **two routes**.
 *
 * A LinkedIn member profile published directly and a LinkedIn organisation
 * page published through the aggregator: one network, two accounts, two
 * sets of numbers. The rows are per channel, so the network appears twice —
 * and the series carries a segment for each.
 */
export const TWO_ROUTE_SUMMARY_PAYLOAD = {
    totals: {
        reach: 140,
        impressions: 280,
        likes: 10,
        comments: 0,
        shares: 0,
        saves: 0,
        clicks: 0,
    },
    by_network: [
        {
            platform: 'linkedin',
            channel: 'direct:linkedin',
            via: 'direct',
            reach: 100,
            impressions: 200,
            likes: 5,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
            posts: 1,
        },
        {
            platform: 'linkedin',
            channel: 'zernio:linkedin',
            via: 'zernio',
            reach: 40,
            impressions: 80,
            likes: 5,
            comments: 0,
            shares: 0,
            saves: 0,
            clicks: 0,
            posts: 1,
        },
    ],
    series: [{ date: '2026-10-01', 'direct:linkedin': 100, 'zernio:linkedin': 40 }],
    top_posts: [
        {
            post_id: 88,
            title: 'Q4 release',
            platform: 'linkedin',
            via: 'direct',
            reach: 100,
            impressions: 200,
            likes: 5,
            published_at: '2026-11-02T09:00:04+00:00',
        },
        {
            post_id: 88,
            title: 'Q4 release',
            platform: 'linkedin',
            via: 'zernio',
            reach: 40,
            impressions: 80,
            likes: 5,
            published_at: '2026-11-02T09:00:04+00:00',
        },
    ],
    notes: [],
} satisfies AnalyticsSummary
