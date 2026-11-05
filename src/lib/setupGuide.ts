/**
 * The setup guide: how to configure a provider, and where its credentials go.
 *
 * **The steps are the plugin's own copy.** The backend sends the facts — the
 * redirect URL and whether the provider is set up — and the platforms' own
 * steps are the plugin's to write, in the plugin's catalogue, so they are
 * translated like the rest of the screen.
 *
 * **The copy is read when the guide is opened, not while this module loads.**
 * `t()` outside a component reads the composer of the mounted app, and there
 * is none while a module is still being evaluated.
 */
import { t } from '../i18n'
import type { Provider } from '../types'

/** One thing the operator does. */
export interface SetupStep {
    body: string
}

/** Where the provider's app is created. */
export interface SetupConsole {
    label: string
    href: string
}

export interface SetupGuide {
    developerConsole: SetupConsole
    steps: SetupStep[]
}

/**
 * The guide for a provider.
 *
 * One app serves both Meta networks: the Instagram API with Unified Login is
 * built on Facebook Login for Business, so the steps name one app, one
 * configuration and one redirect URL.
 */
export function setupGuide(provider: Provider): SetupGuide {
    return provider === 'meta' ? metaGuide() : linkedInGuide()
}

function metaGuide(): SetupGuide {
    return {
        developerConsole: {
            label: t('Meta app dashboard'),
            href: 'https://developers.facebook.com/apps',
        },
        steps: [
            {
                body: t('Create a Business app — a Consumer app cannot use Instagram — and copy its App ID and App Secret into Settings → Plugins.'),
            },
            {
                body: t('Add the Facebook Login for Business product, then the Instagram use case with API setup with Unified login.'),
            },
            {
                body: t('Open Facebook Login for Business → Configurations, create a configuration for the Instagram professional account and the Facebook Page, and copy the Configuration ID into Settings → Plugins.'),
            },
            {
                body: t('Register the redirect URL below with that configuration.'),
            },
            {
                body: t('Request the permissions: instagram_basic, instagram_content_publish, instagram_manage_insights, pages_show_list, pages_manage_posts, pages_read_engagement and read_insights.'),
            },
        ],
    }
}

function linkedInGuide(): SetupGuide {
    return {
        developerConsole: {
            label: t('LinkedIn developer portal'),
            href: 'https://www.linkedin.com/developers/apps',
        },
        steps: [
            {
                body: t('Create an app, add the Sign in with LinkedIn product, and copy the Client ID and the Client Secret into Settings → Plugins.'),
            },
            {
                body: t('Register the redirect URL below with the app.'),
            },
            {
                body: t('Add the Share on LinkedIn product. Posting as a member needs no review — this app posts as the member who signed in.'),
            },
            {
                body: t('Posting to an organisation page is a different app: the Community Management API has to be the only product on an app, so Share on LinkedIn blocks it. It also has to be asked for by a registered legal organisation — LinkedIn does not grant it to an individual.'),
            },
        ],
    }
}
