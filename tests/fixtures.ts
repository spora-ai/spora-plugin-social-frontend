/**
 * Fixtures for the wire shapes the plugin's REST contract defines.
 *
 * Every field of a fixture is present — the contract has no optional members
 * on the objects the app reads — so a test rendering a fixture exercises the
 * same shape the PHP serialiser emits. A partial fixture would let a typo'd
 * field name pass.
 */
import type { Principal } from '../src/api/principals'
import type {
    ComposerAttachment,
    Platform,
    PostMedia,
    PostMetrics,
    PostTarget,
    SocialAccount,
    SocialConnection,
    SocialPost,
} from '../src/types'

export function makePrincipal(overrides: Partial<Principal> = {}): Principal {
    return { id: 7, type: 'user', name: 'Maya Fischer', user_id: 3, group_id: null, ...overrides }
}

export function makeAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
    return {
        id: 12,
        account_id: 12,
        platform: 'linkedin',
        kind: 'organization',
        external_id: 'urn:li:organization:412078',
        display_name: 'Fabeat GmbH',
        username: 'fabeat-gmbh',
        followers: 4820,
        status: 'active',
        connected_at: '2026-10-20T08:12:00+00:00',
        can_report: true,
        report_note: null,
        ...overrides,
    }
}

/**
 * A connection: one login, and the accounts it covers.
 *
 * The token belongs to the connection — a Meta login publishes as an Instagram
 * professional account *and* as a Facebook Page.
 */
export function makeConnection(overrides: Partial<SocialConnection> = {}): SocialConnection {
    return {
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
        accounts: [makeAccount()],
        created_at: '2026-10-20T08:12:00+00:00',
        updated_at: '2026-10-20T08:12:00+00:00',
        ...overrides,
    }
}

export function makePost(overrides: Partial<SocialPost> = {}): SocialPost {
    return {
        id: 88,
        principal_id: 7,
        title: 'Q4 release',
        body: 'We shipped…',
        platform_bodies: {},
        status: 'published',
        source: 'manual',
        scheduled_for: null,
        timezone: 'Europe/Zurich',
        published_at: '2026-11-02T09:00:04+00:00',
            accounts: [{ id: 12, platform: 'linkedin', display_name: 'Fabeat GmbH' }],
        targets: [makeTarget()],
        media: [],
        metrics: null,
        created_at: '2026-11-01T12:00:00+00:00',
        updated_at: '2026-11-02T09:00:04+00:00',
        ...overrides,
    }
}

/**
 * One target's reading.
 *
 * Every counter is nullable, because a platform that does not report one
 * sends null — and that is not the same as a reported zero.
 */
export function makeMetrics(overrides: Partial<PostMetrics> = {}): PostMetrics {
    return {
        reach: 4820,
        impressions: 9310,
        likes: 12,
        comments: 3,
        shares: 1,
        saves: 0,
        clicks: 5,
        measured_at: '2026-11-03T06:00:00+00:00',
        ...overrides,
    }
}

/** A target of a post — one network's outcome and its numbers. */
export function makeTarget(overrides: Partial<PostTarget> = {}): PostTarget {
    return {
        id: 501,
        account_id: 12,
        platform: 'linkedin',
        status: 'published',
        external_id: 'urn:li:share:9',
        external_url: 'https://www.linkedin.com/feed/update/urn:li:share:9',
        error: null,
        published_at: '2026-11-02T09:00:04+00:00',
        metrics: makeMetrics(),
        ...overrides,
    }
}

export function makeMedia(overrides: Partial<PostMedia> = {}): PostMedia {
    return {
        media_asset_id: 'asset-1',
        position: 0,
        mime_type: 'image/png',
        filename: 'chart.png',
        asset_url: '/api/v1/assets/asset-1.png',
        ...overrides,
    }
}

export function makeAttachment(overrides: Partial<ComposerAttachment> = {}): ComposerAttachment {
    return {
        media_asset_id: 'asset-1',
        filename: 'chart.png',
        mime_type: 'image/png',
        size_bytes: 298000,
        asset_url: '/api/v1/assets/asset-1',
        ...overrides,
    }
}

/** The platforms in the order the UI lists them. */
export const ALL_PLATFORMS: Platform[] = ['linkedin', 'facebook', 'instagram']
