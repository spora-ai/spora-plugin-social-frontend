/**
 * The connections: one login per provider, and the accounts it covers.
 *
 * The screen shows connections rather than platforms because that is what the
 * operator holds — a Meta login publishes as an Instagram professional account
 * *and* as a Facebook Page, under one token. The token's health belongs to
 * the connection, not to the accounts inside it.
 */
import { t } from '../i18n'
import { daysUntil } from './format'
import type { ConnectionStatus, Provider, SocialConnection } from '../types'

/** The providers' own names. They read the same in every language. */
export const PROVIDER_LABELS: Record<Provider, string> = {
    meta: 'Meta',
    linkedin: 'LinkedIn',
}

export const PROVIDERS: Provider[] = ['meta', 'linkedin']

/**
 * Whether a provider is one of the plugin's own logins.
 *
 * Anything else is an aggregator's slug — which is also the route its
 * accounts publish through.
 */
export function isNativeProvider(provider: string): provider is Provider {
    return (PROVIDERS as string[]).includes(provider)
}

/**
 * The provider's own name.
 *
 * A provider the plugin does not know falls back to its own name: an
 * aggregator's slug is a route, and the screen names it from the config.
 */
export function providerLabel(provider: Provider | string): string {
    return isNativeProvider(provider) ? PROVIDER_LABELS[provider] : provider
}

/**
 * The connection's token, in the operator's terms.
 *
 * A null expiry is not a missing value: the platform sent none, so there is
 * no renewal to schedule — and saying so is the difference between a
 * connection that looks broken and one that is fine.
 */
export function connectionExpiryNote(connection: SocialConnection, now: number = Date.now()): string {
    if (connection.expires_at === null) return t('Never expires')

    const days = daysUntil(connection.expires_at, now)
    if (days === null) return t('Never expires')
    if (days < 0) return t('Expired {n}d ago', { n: Math.abs(days) })
    if (days < 10) return t('Expires in {n}d', { n: days })
    return t('Token valid for {n}d', { n: days })
}

/** The connection's status, in words. */
export function connectionStatusLabel(status: ConnectionStatus): string {
    switch (status) {
        case 'active':
            return t('Connected')
        case 'expired':
            return t('Token expired')
        case 'revoked':
            return t('Revoked')
        case 'error':
            return t('Error')
    }
}

export function connectionStatusClass(status: ConnectionStatus): string {
    switch (status) {
        case 'active':
            return 'pill-published'
        case 'expired':
            return 'pill-expired'
        case 'revoked':
            return 'pill-expired'
        case 'error':
            return 'pill-failed'
    }
}

/** Whether the connection needs a human. */
export function needsAttention(connection: SocialConnection): boolean {
    return connection.needs_reconnect || connection.status !== 'active'
}
