import { describe, it, expect } from 'vitest'
import AnalyticsView from '../../src/components/AnalyticsView.vue'
import { SUMMARY_PAYLOAD } from '../recorded'
import { mountComponent } from '../mountPage'

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
        const legend = wrapper.find('[data-test="legend-linkedin"]').html()

        expect(legend).toContain('--chart-linkedin')
        expect(legend).not.toContain('--platform-linkedin')
    })

    it('keeps one series per network instead of summing them into one', () => {
        const wrapper = mountComponent(AnalyticsView, { summary: SUMMARY_PAYLOAD })

        // A row per network, and a series per network in the chart: a summed
        // series would lose the difference between them.
        expect(wrapper.find('[data-test="network-row-linkedin"]').exists()).toBe(true)
        expect(wrapper.find('[data-test="network-row-instagram"]').exists()).toBe(true)
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

        expect(wrapper.find('[data-test="network-reach-instagram"]').text()).toBe('—')
        expect(wrapper.find('[data-test="network-impressions-instagram"]').text()).toBe('—')
        // The rate is over an unknown reach, so there is none to state.
        expect(wrapper.find('[data-test="network-row-instagram"]').text()).toContain('—')
    })

    it('shows a dash in the reach tile when no network reported a reach', () => {
        const summary = {
            ...SUMMARY_PAYLOAD,
            by_network: SUMMARY_PAYLOAD.by_network.map((network) => ({
                ...network,
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
})
