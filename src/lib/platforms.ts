/**
 * The networks, the routes to them, and the colours they carry.
 *
 * **The limits and the names are the backend's.** `/config` carries them,
 * because the backend is what refuses the publish — a copy here warns about
 * a number the backend no longer enforces, and a copy of a name is where a
 * name goes stale. So the composer reads the rules it is given and has none
 * of its own.
 *
 * **A network and a route are two axes.** A network is where a post goes
 * (LinkedIn, Bluesky, TikTok); a route is how it gets there (the plugin's
 * own APIs, or an aggregator's). The same network on two routes is two
 * accounts with two tokens and two sets of limits, so the two together are
 * the channel's identity.
 */
import { t } from '../i18n'
import type { Channel, Network, PlatformRules, Route } from '../types'

/** The rules, keyed by the channel's key. */
export type ChannelRules = Record<string, PlatformRules>

/** The plugin's own route to a network. */
export const DIRECT_ROUTE = 'direct'

/**
 * The name of a route.
 *
 * The plugin's own route has a name of its own; an aggregator's slug is the
 * route's own name until the config names it.
 */
export function routeLabel(via: Route): string {
    if (via === DIRECT_ROUTE) return t('Direct')
    return via
}

/**
 * The channel's key — the route, then the network.
 *
 * The two parts are normalised the way the backend normalises them, so a key
 * the frontend builds is the key the backend looks a rule up by.
 */
export function channelKey(via: Route, network: Network): string {
    return `${normalise(via)}:${normalise(network)}`
}

/** The channel a route and a network name. */
export function channelOf(via: Route, network: Network): Channel {
    return {
        key: channelKey(via, network),
        network: normalise(network),
        via: normalise(via),
    }
}

/**
 * The channel a key names.
 *
 * The key is the route, then the network — the shape the backend uses, so
 * a key off the wire and a key built here are the same key. A bare network
 * name is the plugin's own route to it, which is how the backend reads one.
 */
export function channelFromKey(key: string): Channel {
    const normalised = normalise(key)
    const separator = normalised.indexOf(':')

    if (separator === -1) return channelOf(DIRECT_ROUTE, normalised)

    return {
        key: normalised,
        network: normalised.slice(separator + 1),
        via: normalised.slice(0, separator),
    }
}

/**
 * The label of a channel — the network's name, in the rules' words.
 *
 * A channel with no rule has no label: the plugin does not offer it, so
 * there is nothing to name.
 */
export function channelLabel(channel: Channel, rules: ChannelRules): string {
    const rule = rules[channel.key]
    if (rule !== undefined) return rule.label
    return networkLabel(channel.network, rules)
}

/**
 * Every network's label, from the rules.
 *
 * A network reached through two routes carries the same name twice, so the
 * map is keyed by the network and not by the channel.
 */
function networkLabels(rules: ChannelRules): Record<string, string> {
    const labels: Record<string, string> = {}

    for (const rule of Object.values(rules)) {
        if (labels[rule.network] === undefined) labels[rule.network] = rule.label
    }

    return labels
}

/**
 * The label of a network, from the rules.
 *
 * The name is the rules' — a copy here would be a name nobody updates. A
 * network with no rule falls back to its own name, which is the best a
 * screen can say about a network the plugin does not offer.
 */
export function networkLabel(network: Network, rules: ChannelRules): string {
    return networkLabels(rules)[network] ?? network
}

/**
 * The networks a set of channels reaches more than once.
 *
 * The same network through two routes is two accounts, and the plugin cannot
 * know they are the same page — so the composer says so and lets the
 * operator go ahead. Posting to a member profile *and* an organisation page
 * is a thing an operator means.
 */
export function networksOnTwoRoutes(channels: Channel[]): Network[] {
    const routes = new Map<Network, Set<Route>>()

    for (const channel of channels) {
        const seen = routes.get(channel.network) ?? new Set<Route>()
        seen.add(channel.via)
        routes.set(channel.network, seen)
    }

    return [...routes.entries()].filter(([, seen]) => seen.size > 1).map(([network]) => network)
}

/**
 * The networks the plugin has a colour for.
 *
 * Three networks carry a hand-picked hue in the stylesheet — LinkedIn's and
 * Facebook's blues are too close to tell apart in a stacked bar, so the
 * chart series got a set of their own. Every other network's colour is
 * hashed from its name, so a network the backend adds needs no line of CSS.
 *
 * `tests/lib/platforms.spec.ts` checks this list against the stylesheet: a
 * name here with no variable there renders an invisible chip.
 */
const NETWORKS_WITH_A_COLOUR: Network[] = ['linkedin', 'facebook', 'instagram']

/**
 * The colour a network's name hashes to.
 *
 * The same name always gives the same colour, so a network looks the same
 * on every screen and in every chart.
 *
 * FNV-1a: small, fast and well spread. The saturation and the lightness
 * come out of the same hash, so two networks whose hues happen to agree
 * still differ in the chip and in the bar.
 */
function networkColour(network: Network): { hue: number; saturation: number; lightness: number } {
    let hash = 0x811c9dc5

    for (let index = 0; index < network.length; index += 1) {
        hash ^= network.charCodeAt(index)
        hash = Math.imul(hash, 0x01000193) >>> 0
    }

    return {
        hue: hash % 360,
        saturation: 64 + ((hash >>> 9) % 3) * 6,
        lightness: 38 + ((hash >>> 17) % 3) * 4,
    }
}

/**
 * The chart series colour for a network.
 *
 * Deliberately not the platform brand hue: LinkedIn's and Facebook's blues
 * are too close to tell apart in a stacked bar. The brand hue is for the
 * chip, where it is the only colour on the element.
 *
 * A hashed colour is mixed towards the foreground, because the foreground
 * is what the theme inverts — the same hue is a dark blue on a white card
 * and a pale blue on a near-black one.
 */
export function chartColorVar(network: Network): string {
    if (NETWORKS_WITH_A_COLOUR.includes(network)) return `hsl(var(--chart-${network}))`

    const { hue, saturation, lightness } = networkColour(network)

    return `color-mix(in oklab, hsl(${hue} ${saturation}% ${lightness}%) 78%, hsl(var(--foreground)))`
}

/** The network brand hue — a chip accent, never a chart series. */
export function brandColorVar(network: Network): string {
    if (NETWORKS_WITH_A_COLOUR.includes(network)) return `hsl(var(--platform-${network}))`

    const { hue, saturation, lightness } = networkColour(network)

    return `color-mix(in oklab, hsl(${hue} ${saturation}% ${lightness}%) 62%, hsl(var(--foreground)))`
}

function normalise(value: string): string {
    return value.trim().toLowerCase()
}

export interface CharCount {
    n: number
    limit: number
    /** Past the limit — the post cannot go out as it is. */
    over: boolean
    /** Close enough to the limit to be worth saying. */
    near: boolean
}

/**
 * The character count for one body against one network's limit.
 *
 * Counted in **code points**, not UTF-16 code units: a surrogate pair is two
 * units and one code point, and the platforms count code points — so a
 * caption of 2,200 emoji is at the limit, not twice over it.
 */
export function charCount(text: string, limit: number): CharCount {
    const n = [...(text ?? '')].length
    return { n, limit, over: n > limit, near: n <= limit && n > limit * 0.9 }
}

/**
 * The text a post goes out with: its body, and its hashtags under it.
 *
 * The mirror of `PlatformFit::composeText()` in the backend, which is the
 * authority: the backend composes the text it publishes, so a preview that
 * composed it differently would show the operator something the network
 * never receives.
 *
 * The blank line only appears when there is a body to separate the tags
 * from — a post that is nothing but tags has no leading empty line.
 */
export function composeText(body: string, hashtags: string[]): string {
    const tags = hashtags.map((hashtag) => `#${hashtag}`)
    if (tags.length === 0) return body

    const text = tags.join(' ')
    return body === '' ? text : `${body}\n\n${text}`
}

/**
 * The tags an operator typed, as the plain list the backend stores.
 *
 * The operator writes them the way they write them in a post — `#one, #two`
 * or `one two` — and the hashes are added when the post is composed, so
 * what travels is the tag without them.
 */
export function parseHashtags(raw: string): string[] {
    const tags: string[] = []

    for (const piece of raw.split(/[\s,]+/)) {
        const tag = piece.replace(/^#+/, '').trim()
        if (tag === '' || tags.includes(tag)) continue
        tags.push(tag)
    }

    return tags
}

export interface MediaFit {
    fits: boolean
    /** What the network accepts, in its own words. */
    reason: string
    /** What the operator can do about it. */
    remedy: string
}

/**
 * Can this asset be published to this network as it is?
 *
 * The rules are the backend's, and so is the wording: the note names the
 * rule and the remedy names the action, so the badge on an attachment and
 * the refusal at publish time read as one thing.
 */
export function mediaFit(
    asset: { mime_type: string | null; size_bytes?: number | null },
    rule: PlatformRules,
): MediaFit {
    const mime = asset.mime_type ?? ''

    if (mime !== '' && !rule.mime_types.includes(mime)) {
        return {
            fits: false,
            reason: rule.media_note,
            remedy: mime.startsWith('video/') ? rule.video_remedy : rule.media_remedy,
        }
    }

    const size = asset.size_bytes
    if (typeof size === 'number' && size > rule.max_bytes) {
        return { fits: false, reason: rule.media_note, remedy: rule.size_remedy }
    }

    return { fits: true, reason: '', remedy: '' }
}
