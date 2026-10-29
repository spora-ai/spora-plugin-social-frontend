/**
 * Vitest global setup — the i18n instance every mounted component needs.
 *
 * The locale is pinned to `en` — `en.json` is an identity map, so the English
 * assertions in the suite keep asserting English.
 */
import { config } from '@vue/test-utils'
import { createPluginI18n } from '../src/i18n'

config.global.plugins = [createPluginI18n('en')]
