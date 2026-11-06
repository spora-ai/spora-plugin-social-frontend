import { describe, it, expect } from 'vitest'
import type { DOMWrapper } from '@vue/test-utils'
import AnalyticsView from '../../src/components/AnalyticsView.vue'
import { CONFIG_PAYLOAD, SUMMARY_PAYLOAD, TWO_ROUTE_SUMMARY_PAYLOAD } from '../recorded'
import { mountComponent } from '../mountPage'

/**
 * The background colour an element was painted with.
 *
 * The chart paints its segments and its legend swatches inline, and the two
 * have to be the same colour — a legend that does not match the bar it labels
 * is worse than no legend.
 */
function backgroundOf(element: DOMWrapper<Element>): string {
    return /background:\s*([^;]+)/.exec(element.attributes('style') ?? '')?.[1] ?? ''
}

/**
 * The analytics view, against the backend's **recorded** summary.
 *
 * The recorded payload is what makes these assertions honest: it has a
 * network with no reach, a top post with no numbers, and a day whose series
 * omits a platform.
 */
describe('AnalyticsView', () => {
    it('draws the chart series with the chart tokens, not the brand hues', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })
        const chart = wrapper.find('[data-test="reach-chart"]').html()

        // LinkedIn's and Facebook's blues are indistinguishable in a stacked
        // bar, so the series carry their own colours.
        expect(chart).toContain('--chart-linkedin')
        expect(chart).toContain('--chart-facebook')
        expect(chart).toContain('--chart-instagram')
        expect(chart).not.toContain('--platform-linkedin')
        expect(chart).not.toContain('--platform-facebook')
        expect(chart).not.toContain('--platform-instagram')
    })

    it('gives the legend the same colours as the bars it labels', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        const legend = wrapper.find('[data-test="legend-direct:linkedin"] .rounded-sm')
        const bar = wrapper.find('[data-test="chart-segment-direct:linkedin"]')

        expect(backgroundOf(legend)).toBe(backgroundOf(bar))
        expect(backgroundOf(legend)).toContain('--chart-linkedin')
        expect(backgroundOf(legend)).not.toContain('--platform-linkedin')
    })

    it('keeps one series per channel instead of summing them into one', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        // A row per channel, and a segment per channel in the chart: a
        // summed series would lose the difference between them.
        expect(wrapper.find('[data-test="network-row-direct:linkedin"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="network-row-direct:instagram"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="reach-chart"]').html()).toContain('--chart-facebook')
    })

    it('labels the summed reach a rough figure', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        // Three networks count reach differently, so their sum is not a fact.
        expect(wrapper.find('[data-test="kpi-reach"]').text()).toContain('a rough figure')
    })

    it('writes the caveat under the numbers', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })
        const caveat = wrapper.find('[data-test="network-caveat"]')

        expect(caveat.exists()).toBe(true)
        expect(caveat.text()).toContain('each network counts reach its own way')
    })

    it('renders the notes the backend sent', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        expect(wrapper.find('[data-test="analytics-notes"]').text()).toContain(
            'LinkedIn member posts report reactions only',
        )
    })

    it('says so when there are no numbers yet', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: null })
        expect(wrapper.text()).toContain('No numbers yet')
    })

    it('shows a dash for a network counter that was never reported', () => {
        // The recorded summary's instagram row reports no reach.
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        expect(wrapper.find('[data-test="network-reach-direct:instagram"]').text()).toBe('—')
        expect(wrapper.find('[data-test="network-impressions-direct:instagram"]').text()).toBe('—')
        // The rate is over an unknown reach, so there is none to state.
        expect(wrapper.find('[data-test="network-row-direct:instagram"]').text()).toContain('—')
    })

    it('shows a dash in the reach tile when no network reported a reach', () => {
        const summary = {
            ...SUMMARY_PAYLOAD,
            by_network: SUMMARY_PAYLOAD.by_network.map((row) => ({
                ...row,
                reach: null,
                impressions: null,
            })),
        }
        const wrapper = mountComponent(AnalyticsView, { summary })

        expect(wrapper.find('[data-test="kpi-reach-value"]').text()).toBe('—')
    })

    it('shows a dash for a top post whose reach was never reported', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        expect(wrapper.find('[data-test="top-post-reach-89"]').text()).toBe('—')
        expect(wrapper.find('[data-test="top-post-reach-88"]').text()).toBe('4,820')
    })

    it('counts a day whose series omits a platform, instead of printing NaN', () => {
        // The recorded series omits facebook on the second day: an absent key
        // is not a zero, and the total must still add up.
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        const title = wrapper.find('[data-test="chart-day-2026-10-02"]').attributes('title')
        expect(title).toContain('330 reach')
        expect(title).not.toContain('NaN')
    })

    it('counts a counter nobody reported as no engagement at all', () => {
        const summary = {
            ...SUMMARY_PAYLOAD,
            by_network: [
                {
                    platform: 'linkedin',
                    channel: 'direct:linkedin',
                    via: 'direct',
                    reach: 1000,
                    impressions: null,
                    likes: null,
                    comments: null,
                    shares: null,
                    saves: null,
                    clicks: null,
                    posts: 1,
                },
            ],
        }
        const wrapper = mountComponent(AnalyticsView, { summary })

        // A counter nobody reported contributes nothing, the same way a
        // missing reach does.
        expect(wrapper.find('[data-test="network-row-direct:linkedin"]').text()).toContain('0')
    })

    it('states no rate over a counted zero', () => {
        const summary = {
            ...SUMMARY_PAYLOAD,
            by_network: [
                {
                    platform: 'linkedin',
                    channel: 'direct:linkedin',
                    via: 'direct',
                    reach: 0,
                    impressions: 0,
                    likes: 0,
                    comments: 0,
                    shares: 0,
                    saves: 0,
                    clicks: 0,
                    posts: 0,
                },
            ],
        }
        const wrapper = mountComponent(AnalyticsView, { summary })

        // 0/0 is not a rate.
        expect(wrapper.find('[data-test="network-row-direct:linkedin"]').text()).toContain('—')
    })

    it('states a rate of zero when nothing was engaged', () => {
        const summary = {
            ...SUMMARY_PAYLOAD,
            by_network: [
                {
                    platform: 'linkedin',
                    channel: 'direct:linkedin',
                    via: 'direct',
                    reach: 1000,
                    impressions: 1000,
                    likes: 0,
                    comments: 0,
                    shares: 0,
                    saves: 0,
                    clicks: 0,
                    posts: 1,
                },
            ],
        }
        const wrapper = mountComponent(AnalyticsView, { summary })

        expect(wrapper.find('[data-test="network-row-direct:linkedin"]').text()).toContain('0.0%')
    })

    it('names the columns of the top posts table', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        // A table without headers is a table a screen reader cannot read.
        const headers = wrapper.findAll('table th')
        expect(headers.length).toBeGreaterThan(0)
        expect(headers.map((header) => header.text())).toContain('Post')
    })

    it('reads a post once, not once per reading', () => {
        // The backend's rows are one per metric reading — the daily
        // collector writes a row per day — so the same post arrives ten
        // times with a different reach each.
        const readings = Array.from({ length: 10 }, (_, day) => ({
            ...SUMMARY_PAYLOAD.top_posts[0]!,
            reach: 4820 - day,
        }))

        const wrapper = mountComponent(AnalyticsView, {
            summary: { ...SUMMARY_PAYLOAD, top_posts: readings },
        })

        expect(wrapper.findAll('[data-test="top-post-reach-88"]')).toHaveLength(1)
    })
})

describe('AnalyticsView — two routes to one network', () => {
    it('draws a row per channel, so the two routes are two rows', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        // The same network on two routes is two accounts with two sets of
        // numbers, and one row per network would hide which is which.
        expect(wrapper.findAll('[data-test^="network-row-"]')).toHaveLength(2)
        expect(wrapper.find('[data-test="network-row-direct:linkedin"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="network-row-zernio:linkedin"]').exists()).toBe(true)
    })

    it('gives the two rows keys of their own', async () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        const row = wrapper.find('[data-test="network-row-direct:linkedin"]').element

        // The rows swap places. Two rows keyed by the network are the same
        // key twice, and the row that was first would be patched into the
        // row that is now first — one account's row wearing the other's
        // numbers.
        await wrapper.setProps({
            summary: {
                ...TWO_ROUTE_SUMMARY_PAYLOAD,
                by_network: [...TWO_ROUTE_SUMMARY_PAYLOAD.by_network].reverse(),
            },
        })

        expect(wrapper.find('[data-test="network-row-direct:linkedin"]').element).toBe(row)
        expect(wrapper.findAll('[data-test^="network-row-"]')).toHaveLength(2)
    })

    it('names the route on every row', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        // A row that says only "LinkedIn" says nothing about which of the
        // two it is.
        expect(wrapper.find('[data-test="network-route-direct:linkedin"]').text()).toBe('Direct')
        expect(wrapper.find('[data-test="network-route-zernio:linkedin"]').text()).toBe('Zernio')
    })

    it('names the route in the legend, so the two swatches can be told apart', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="legend-direct:linkedin"]').text()).toContain('Direct')
        expect(wrapper.find('[data-test="legend-zernio:linkedin"]').text()).toContain('Zernio')
    })

    it('gives the legend the same colours as the bars it labels', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        const legend = wrapper.find('[data-test="legend-zernio:linkedin"] .rounded-sm')
        const bar = wrapper.find('[data-test="chart-segment-zernio:linkedin"]')

        expect(backgroundOf(legend)).toBe(backgroundOf(bar))
    })

    it('paints the two routes of one network in two colours', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        const direct = backgroundOf(wrapper.find('[data-test="legend-direct:linkedin"] .rounded-sm'))
        const aggregated = backgroundOf(
            wrapper.find('[data-test="legend-zernio:linkedin"] .rounded-sm'),
        )

        // The hue is the network's on both routes — it is the same network —
        // and the aggregator's route is lighter, so the two segments of one
        // bar can be told apart.
        expect(direct).toContain('--chart-linkedin')
        expect(aggregated).toContain('--chart-linkedin')
        expect(aggregated).toContain('calc(l + 8)')
        expect(direct).not.toContain('calc(l + 8)')
    })

    it('names the route on the best channel', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        expect(wrapper.find('[data-test="kpi-best-channel"]').text()).toContain('LinkedIn')
        expect(wrapper.find('[data-test="kpi-best-route"]').text()).toBe('Direct')
    })

    it('names the route on a top post', () => {
        const wrapper = mountComponent(AnalyticsView, {
            summary: TWO_ROUTE_SUMMARY_PAYLOAD,
            config: CONFIG_PAYLOAD,
        })

        // The same post on two routes is two rows, and each says which.
        expect(wrapper.find('[data-test="top-post-route-88"]').text()).toBe('Direct')
    })
})
