import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as platforms from '../../src/lib/platforms'
import {
    brandColorVar,
    channelFromKey,
    channelKey,
    channelLabel,
    chartColorVar,
    charCount,
    composeText,
    NETWORKS_WITH_A_COLOUR,
    networkLabel,
    networksOnTwoRoutes,
    parseHashtags,
    routeLabel,
    uniqueChannels,
} from '../../src/lib/platforms'
import { CONFIG_PAYLOAD } from '../recorded'

const rules = CONFIG_PAYLOAD.rules

/**
 * The lightness a hashed chart colour carries.
 *
 * The hashed colours are written as `hsl(<hue> <saturation>% <lightness>%)`,
 * so the lightness is the third number.
 */
function lightnessOf(color: string): number {
    const match = /hsl\(\d+ \d+% (\d+)%\)/.exec(color)
    if (match === null) throw new Error(`no lightness in ${color}`)
    return Number(match[1])
}

describe('lib/platforms', () => {
    it('carries no copy of the limits', () => {
        // The backend enforces these, so a copy here is a copy that warns
        // about a number the backend no longer refuses.
        const source = readFileSync(join(process.cwd(), 'src/lib/platforms.ts'), 'utf8')

        expect(source).not.toContain('PLATFORM_CONSTRAINTS')
        expect(source).not.toContain('maxText')
        expect(source).not.toContain('mediaTypes')
        expect(source).not.toContain('maxMediaBytes')
        expect(Object.keys(platforms)).not.toContain('PLATFORM_CONSTRAINTS')
    })

    it('carries no copy of the networks’ names', () => {
        // The label is the backend's: a copy here is a name nobody updates.
        const source = readFileSync(join(process.cwd(), 'src/lib/platforms.ts'), 'utf8')

        expect(source).not.toContain('PLATFORM_LABELS')
        expect(source).not.toContain('PLATFORMS')
        expect(Object.keys(platforms)).not.toContain('PLATFORM_LABELS')
    })

    it('reads the character limit from the backend’s rule', () => {
        expect(rules['direct:linkedin']?.max_text).toBe(3000)
        expect(rules['direct:facebook']?.max_text).toBe(63206)
        expect(rules['direct:instagram']?.max_text).toBe(2200)
    })

    it('flags a body past the limit, and a body close to it', () => {
        const limit = rules['direct:linkedin']!.max_text

        expect(charCount('a'.repeat(limit), limit).over).toBe(false)
        expect(charCount('a'.repeat(limit + 1), limit).over).toBe(true)
        expect(charCount('a'.repeat(Math.floor(limit * 0.95)), limit).near).toBe(true)
        expect(charCount('short', limit).near).toBe(false)
    })

    it('counts in code points, so an emoji does not read as two', () => {
        // A surrogate pair is two UTF-16 code units and one code point. The
        // platforms count code points, so a caption of 2,200 emoji is at the
        // limit — not twice over it.
        const emoji = '😀'
        const limit = rules['direct:instagram']!.max_text

        expect(charCount(emoji.repeat(limit), limit).n).toBe(limit)
        expect(charCount(emoji.repeat(limit), limit).over).toBe(false)
        expect(charCount(emoji.repeat(limit + 1), limit).over).toBe(true)
    })

    it('counts an absent body as no characters', () => {
        expect(charCount('', rules['direct:linkedin']!.max_text).n).toBe(0)
    })

})

describe('lib/platforms — the channel', () => {
    it('names a channel by the route and the network', () => {
        expect(channelKey('direct', 'linkedin')).toBe('direct:linkedin')
        expect(channelKey('zernio', 'bluesky')).toBe('zernio:bluesky')
    })

    it('reads a channel back out of its key', () => {
        expect(channelFromKey('zernio:bluesky')).toEqual({
            key: 'zernio:bluesky',
            network: 'bluesky',
            via: 'zernio',
        })
    })

    it('reads a bare network name as the plugin’s own route to it', () => {
        // The backend reads one that way too, so a key off the wire and a
        // key built here are the same key.
        expect(channelFromKey('linkedin').key).toBe('direct:linkedin')
    })

    it('takes the label of a channel from the rules', () => {
        expect(channelLabel(channelFromKey('direct:linkedin'), rules)).toBe('LinkedIn')
        expect(channelLabel(channelFromKey('zernio:bluesky'), rules)).toBe('Bluesky')
    })

    it('has no label for a channel the plugin does not offer', () => {
        // A network with no rules row is one the plugin cannot publish to:
        // no limits, no name, no colour. The fallback to another route's
        // label would name it after a channel the plugin does offer.
        expect(channelLabel(channelFromKey('zernio:myspace'), rules)).toBe('')
    })

    it('names a channel while the rules have not arrived', () => {
        // The rules are unknown, not refused: until the config has been read
        // there is no row for any channel, and an empty chip says nothing.
        expect(channelLabel(channelFromKey('direct:linkedin'), {})).toBe('LinkedIn')
    })

    it('names a network from any of its channels', () => {
        expect(networkLabel('linkedin', rules)).toBe('LinkedIn')
        expect(networkLabel('bluesky', rules)).toBe('Bluesky')
    })

    it('names the plugin’s own route, and an aggregator by its own name', () => {
        expect(routeLabel('direct', {})).toBe('Direct')
        expect(routeLabel('zernio', CONFIG_PAYLOAD.aggregators)).toBe('Zernio')
    })

    it('names the networks a post reaches through two routes', () => {
        const channels = [
            channelFromKey('direct:linkedin'),
            channelFromKey('zernio:linkedin'),
            channelFromKey('direct:bluesky'),
        ]

        expect(networksOnTwoRoutes(channels)).toEqual(['linkedin'])
    })

    it('names no network when each one is reached through one route', () => {
        const channels = [channelFromKey('direct:linkedin'), channelFromKey('zernio:bluesky')]

        expect(networksOnTwoRoutes(channels)).toEqual([])
    })

    it('folds two entries of one channel into one', () => {
        // The backend sends one entry per target, and a target is an
        // account: two accounts on one channel are one channel.
        const channels = uniqueChannels([
            channelFromKey('direct:linkedin'),
            channelFromKey('direct:linkedin'),
            channelFromKey('zernio:linkedin'),
        ])

        expect(channels.map((channel) => channel.key)).toEqual([
            'direct:linkedin',
            'zernio:linkedin',
        ])
    })

    it('keeps two routes to one network apart', () => {
        const channels = uniqueChannels([
            channelFromKey('direct:linkedin'),
            channelFromKey('zernio:linkedin'),
        ])

        expect(channels.map((channel) => channel.key)).toEqual([
            'direct:linkedin',
            'zernio:linkedin',
        ])
    })
})

describe('lib/platforms — the colours', () => {
    it('keeps the chart series away from the brand hues', () => {
        // LinkedIn's and Facebook's blues are indistinguishable in a stacked
        // bar, so the series carry their own tokens.
        expect(chartColorVar(channelFromKey('direct:linkedin'))).toContain('--chart-linkedin')
        expect(chartColorVar(channelFromKey('direct:facebook'))).toContain('--chart-facebook')
        expect(chartColorVar(channelFromKey('direct:instagram'))).toContain('--chart-instagram')
        expect(brandColorVar('linkedin')).toContain('--platform-linkedin')
        expect(chartColorVar(channelFromKey('direct:linkedin'))).not.toBe(brandColorVar('linkedin'))
    })

    it('gives a network with no variable the hashed colour instead', () => {
        // Bluesky has no hand-picked hue, so it gets one hashed from its
        // name — and the colour is not the brand hue of anything.
        expect(chartColorVar(channelFromKey('direct:bluesky'))).not.toContain('--chart-')
        expect(brandColorVar('bluesky')).not.toContain('--platform-')
    })

    it('gives the same network the same colour on every screen', () => {
        // The hue is hashed from the name, so a network looks the same in
        // the chip, in the chart and in the legend.
        expect(brandColorVar('bluesky')).toBe(brandColorVar('bluesky'))
        expect(chartColorVar(channelFromKey('direct:tiktok'))).toBe(
            chartColorVar(channelFromKey('direct:tiktok')),
        )
    })

    it('hashes the hue from the network’s name', () => {
        // Pinned, so a change to the hash is a deliberate one: a colour
        // that moved under the operator's feet is a colour nobody can learn.
        expect(brandColorVar('bluesky')).toContain('hsl(198 64% 38%)')
        expect(brandColorVar('tiktok')).toContain('hsl(83 76% 46%)')
        // The chart and the chip share the hue; only the mix differs.
        expect(chartColorVar(channelFromKey('direct:bluesky'))).toContain('hsl(198 64% 38%)')
    })

    it('gives two different networks different colours', () => {
        expect(brandColorVar('bluesky')).not.toBe(brandColorVar('tiktok'))
    })

    it('keeps the hand-picked hue for the plugin’s own route', () => {
        const direct = chartColorVar(channelFromKey('direct:linkedin'))

        // The stylesheet holds the hue, and the direct route is that hue.
        expect(direct).toContain('--chart-linkedin')
        expect(direct).not.toContain('calc(')
    })

    it('gives an aggregator route the network’s hue and a lighter shade of it', () => {
        const direct = chartColorVar(channelFromKey('direct:bluesky'))
        const aggregated = chartColorVar(channelFromKey('zernio:bluesky'))

        // The hue and the saturation are the network's on both routes — it
        // is the same network.
        expect(direct).toContain('hsl(198 64%')
        expect(aggregated).toContain('hsl(198 64%')
        // Eight points lighter, so the two segments of one bar can be told
        // apart.
        expect(lightnessOf(aggregated)).toBe(lightnessOf(direct) + 8)
    })

    it('shifts the hand-picked hue’s lightness on an aggregator route', () => {
        const aggregated = chartColorVar(channelFromKey('zernio:linkedin'))

        // The variable's own hue, with the variable's own lightness shifted —
        // so the hand-picked hue survives the theme's two values.
        expect(aggregated).toContain('--chart-linkedin')
        expect(aggregated).toContain('calc(l + 8)')
    })

    it('names the networks with a hand-picked hue, and the stylesheet agrees', () => {
        // The stylesheet declares the hues; the list here names the networks
        // they belong to. The two have to be the same set, both ways.
        const stylesheet = readFileSync(join(process.cwd(), 'src/style.css'), 'utf8')

        for (const network of NETWORKS_WITH_A_COLOUR) {
            expect(stylesheet).toContain(`--platform-${network}:`)
            expect(stylesheet).toContain(`--chart-${network}:`)
        }

        const declared = new Set(
            [...stylesheet.matchAll(/--(?:platform|chart)-([a-z]+):/g)].map((match) => match[1]!),
        )

        // A name here with no variable there renders an invisible chip...
        expect([...NETWORKS_WITH_A_COLOUR].filter((network) => !declared.has(network))).toEqual([])
        // ...and a variable there with no name here is dead CSS.
        expect([...declared].filter((network) => !NETWORKS_WITH_A_COLOUR.has(network))).toEqual([])
    })
})

describe('lib/platforms — the composition', () => {
    it('leaves the body alone when there are no hashtags', () => {
        expect(composeText('We shipped…', [])).toBe('We shipped…')
    })

    it('puts the hashtags under the body', () => {
        // The mirror of `PlatformFit::composeText()`: the tags go under the
        // body, separated by a blank line.
        expect(composeText('We shipped…', ['one', 'two'])).toBe('We shipped…\n\n#one #two')
    })

    it('puts nothing above the tags when there is no body', () => {
        expect(composeText('', ['one'])).toBe('#one')
    })

    it('composes an empty post into nothing', () => {
        expect(composeText('', [])).toBe('')
    })

    it('reads the hashtags the way an operator writes them', () => {
        expect(parseHashtags('#one, #two')).toEqual(['one', 'two'])
        expect(parseHashtags('one two')).toEqual(['one', 'two'])
    })

    it('keeps one of each tag', () => {
        expect(parseHashtags('#one, one #two')).toEqual(['one', 'two'])
    })

    it('reads no tag out of nothing', () => {
        expect(parseHashtags('   ')).toEqual([])
        expect(parseHashtags('#')).toEqual([])
    })
})
