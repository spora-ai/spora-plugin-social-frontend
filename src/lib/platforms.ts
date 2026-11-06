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
import type { AggregatorConfig, Channel, PlatformRules } from '../types'

/** The rules, keyed by the channel's key. */
export type ChannelRules = Record<string, PlatformRules>

/** The plugin's own route to a network. */
export const DIRECT_ROUTE = 'direct'

/**
 * The name of a route.
 *
 * The plugin's own route has a name of its own; an aggregator's is the name
 * the operator knows it by, which the backend sends with the config — so
 * the route reads as a product and not as a category.
 */
export function routeLabel(via: string, aggregators: Record<string, AggregatorConfig>): string {
    if (via === DIRECT_ROUTE) return t('Direct')
    return aggregators[via]?.label ?? via
}

/**
 * The channel's key — the route, then the network.
 *
 * The two parts are normalised the way the backend normalises them, so a key
 * the frontend builds is the key the backend looks a rule up by.
 */
export function channelKey(via: string, network: string): string {
    return `${normalise(via)}:${normalise(network)}`
}

/** The channel a route and a network name. */
export function channelOf(via: string, network: string): Channel {
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
 * The channels a set of channel entries names — one per channel.
 *
 * The backend sends one entry per **target**, and a target is an account:
 * two accounts on one channel arrive as two entries that name the same
 * channel. A screen that draws a chip per entry would draw the same chip
 * twice, so the entries are folded by the channel's key.
 */
export function uniqueChannels(channels: Channel[]): Channel[] {
    const unique: Channel[] = []

    for (const channel of channels) {
        if (!unique.some((existing) => existing.key === channel.key)) unique.push(channel)
    }

    return unique
}

/**
 * The label of a channel — the network's name, in the rules' words.
 *
 * A channel with no rule has no label: the plugin does not offer it, so
 * there is nothing to name.
 *
 * **Rules that have not arrived are not a rule that says no.** Until the
 * config has been read there is no row for any channel, and an empty chip
 * says nothing at all — so the network's own name stands in until the rules
 * are there.
 */
export function channelLabel(channel: Channel, rules: ChannelRules): string {
    const rule = rules[channel.key]
    if (rule !== undefined) return rule.label
    if (Object.keys(rules).length === 0) return networkLabel(channel.network, rules)
    return ''
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
        labels[rule.network] ??= rule.label
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
export function networkLabel(network: string, rules: ChannelRules): string {
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
export function networksOnTwoRoutes(channels: Channel[]): string[] {
    const routes = new Map<string, Set<string>>()

    for (const channel of channels) {
        const seen = routes.get(channel.network) ?? new Set<string>()
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
 * `tests/lib/platforms.spec.ts` pins this list to the stylesheet: the two
 * have to be the same set, both ways. A name here with no variable there
 * renders an invisible chip, and a variable there with no name here is
 * dead CSS.
 */
export const NETWORKS_WITH_A_COLOUR = new Set(['linkedin', 'facebook', 'instagram'])

/**
 * How much lighter an aggregator's route is than the plugin's own.
 *
 * A stacked bar tells its segments apart by colour, so two routes of one
 * network must not share one — and eight points of lightness is enough to
 * tell them apart while the hue still says which network it is.
 */
const AGGREGATOR_LIGHTNESS = 8

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
function networkColour(network: string): { hue: number; saturation: number; lightness: number } {
    let hash = 0x811c9dc5

    for (const character of network) {
        hash ^= character.codePointAt(0) ?? 0
        hash = Math.imul(hash, 0x01000193) >>> 0
    }

    return {
        hue: hash % 360,
        saturation: 64 + ((hash >>> 9) % 3) * 6,
        lightness: 38 + ((hash >>> 17) % 3) * 4,
    }
}

/**
 * The chart series colour for a channel.
 *
 * Deliberately not the platform brand hue: LinkedIn's and Facebook's blues
 * are too close to tell apart in a stacked bar. The brand hue is for the
 * chip, where it is the only colour on the element.
 *
 * **The hue is the network's and the lightness is the route's.** The same
 * network on two routes is two segments of one bar, and two segments of one
 * colour cannot be told apart — so the aggregator's route is lighter than
 * the plugin's own. The hue stays the network's, because it is the same
 * network's brand.
 *
 * A hashed colour is mixed towards the foreground, because the foreground
 * is what the theme inverts — the same hue is a dark blue on a white card
 * and a pale blue on a near-black one.
 */
export function chartColorVar(channel: Channel): string {
    const network = channel.network
    const shift = channel.via === DIRECT_ROUTE ? 0 : AGGREGATOR_LIGHTNESS

    if (NETWORKS_WITH_A_COLOUR.has(network)) {
        const variable = `var(--chart-${network})`

        if (shift === 0) return `hsl(${variable})`

        // The relative colour syntax shifts the variable's own lightness, so
        // the hand-picked hue survives the theme's two values instead of
        // being written down twice.
        return `hsl(from hsl(${variable}) h s calc(l + ${shift}))`
    }

    const { hue, saturation, lightness } = networkColour(network)

    return `color-mix(in oklab, hsl(${hue} ${saturation}% ${lightness + shift}%) 78%, hsl(var(--foreground)))`
}

/** The network brand hue — a chip accent, never a chart series. */
export function brandColorVar(network: string): string {
    if (NETWORKS_WITH_A_COLOUR.has(network)) return `hsl(var(--platform-${network}))`

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
