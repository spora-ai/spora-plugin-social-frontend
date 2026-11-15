/**
 * The social data the app shows: connections, posts, the calendar and the
 * analytics summary.
 *
 * Every read is principal-scoped, because the plugin's own API is: a request
 * without a principal is a 422, and a request with the *wrong* one is a
 * scope the operator did not choose. The principal comes from the URL, and
 * `App.vue` is what reconciles it — so every action here takes it as an
 * argument rather than reading a store field that could be stale.
 */
import { defineStore, acceptHMRUpdate } from 'pinia'
import { computed, ref } from 'vue'
import { apiMessage } from '../api/client'
import { t } from '../i18n'
import * as socialApi from '../api/social'
import type {
    AccountHealth,
    AggregatorResult,
    AnalyticsSummary,
    CalendarPayload,
    ConnectAccountResult,
    CreatePostPayload,
    PlatformRules,
    PostList,
    PostQuery,
    Provider,
    SocialAccount,
    SocialConfig,
    SocialConnection,
    SocialPost,
} from '../types'

export const useSocialStore = defineStore('social', () => {
    /** The read of the config, while it is in flight. */
    let configPromise: Promise<void> | null = null
    /**
     * The principal the in-flight config read is for.
     *
     * Tracked apart from the principal the *resolved* config belongs to: a
     * read that has not landed yet has no principal to compare a second
     * caller against, and that caller has to find the read already on its
     * way instead of asking a second time.
     */
    let configPendingPrincipalId: number | null = null
    /**
     * The principal the cached config belongs to.
     *
     * The aggregators' flags are the principal's — the key is the operator's
     * — so a config read for one principal says nothing about another's.
     */
    let configPrincipalId: number | null = null
    /**
     * Counts the config reads.
     *
     * A read for the principal the operator has left answers after the one
     * for the principal they are on now — and it must not overwrite it.
     */
    let configToken = 0

    /** The read of the connections, while it is in flight. */
    let connectionsPromise: Promise<void> | null = null
    /**
     * The principal the in-flight connections read is for.
     *
     * Apart from the principal the loaded ones belong to: a read that has
     * not landed yet has no principal to compare a second caller against.
     */
    let connectionsPendingPrincipalId: number | null = null
    /** The principal the connections on screen belong to. */
    let connectionsPrincipalId: number | null = null
    /**
     * The connections on screen are the ones from before the last read.
     *
     * A read that has not answered yet confirms nothing, and a refresh that
     * failed confirms less: the list may stay on screen — an empty grid
     * would be worse — but it is not what the backend says now, so the next
     * caller has to ask again.
     */
    let connectionsStale = false
    /**
     * Counts the connections reads.
     *
     * A read for the principal the operator has left answers after the one
     * for the principal they are on now — and it must not overwrite it.
     */
    let connectionsToken = 0

    const connections = ref<SocialConnection[]>([])
    const posts = ref<SocialPost[]>([])
    const postsTotal = ref(0)
    const analytics = ref<AnalyticsSummary | null>(null)
    const calendar = ref<CalendarPayload | null>(null)
    const config = ref<SocialConfig | null>(null)
    /** The config could not be read, so the rules are not there. */
    const configError = ref<string | null>(null)

    const loading = ref(false)
    const error = ref<string | null>(null)
    const notice = ref<string | null>(null)

    /**
     * The rules the backend enforces, per channel.
     *
     * Empty until the config has been read, and empty for good when the
     * config could not be read: the composer must not fall back to a limit
     * of its own.
     */
    const rules = computed<Record<string, PlatformRules>>(() => config.value?.rules ?? {})

    /**
     * Every account, from every connection.
     *
     * The composer's picker chooses an *account*, and the accounts now arrive
     * inside their connection — so they are flattened here, once.
     */
    const accounts = computed<SocialAccount[]>(() =>
        connections.value.flatMap((connection) => connection.accounts),
    )

    /**
     * What the operator is told.
     *
     * The backend's sentence names the part that was refused and where to
     * fix it; a generic sentence hides both. The fallback is for the
     * failures that carry no sentence at all — a network that never
     * answered.
     */
    function fail(e: unknown, fallback: string): void {
        error.value = apiMessage(e, fallback)
    }

    function setNotice(message: string | null): void {
        notice.value = message
    }

    /**
     * The connections of a principal, and the accounts they cover.
     *
     * Read once per principal, like the config: two owners asking for the
     * same principal's connections are one question, and the second caller
     * waits for the read that is already on its way.
     */
    async function loadConnections(principalId: number, force = false): Promise<void> {
        if (!force) {
            if (connectionsPendingPrincipalId === principalId && connectionsPromise !== null) {
                return connectionsPromise
            }

            // The connections are here and they are this principal's.
            if (connectionsPrincipalId === principalId && !connectionsStale) return
        }

        const token = ++connectionsToken
        connectionsPendingPrincipalId = principalId

        if (connectionsPrincipalId !== principalId) {
            // The accounts on screen belong to the principal being left;
            // showing them under the new one would be a lie about whose
            // accounts they are.
            connections.value = []
            connectionsPrincipalId = null
        }

        // The read has not answered yet, so nothing on screen is confirmed.
        connectionsStale = true

        connectionsPromise = (async () => {
            try {
                const loaded = await socialApi.listConnections(principalId)
                if (token !== connectionsToken) return
                connections.value = loaded
                connectionsPrincipalId = principalId
                connectionsStale = false
            } catch (e) {
                if (token !== connectionsToken) return
                fail(e, t('Could not load the connections.'))
            } finally {
                // Only the newest read may clear the pending state: an older
                // one that lands later must not un-claim the read that
                // replaced it.
                if (token === connectionsToken) {
                    connectionsPendingPrincipalId = null
                    connectionsPromise = null
                }
            }
        })()

        return connectionsPromise
    }

    async function loadPosts(principalId: number, query: PostQuery = {}): Promise<void> {
        try {
            const result: PostList = await socialApi.listPosts(principalId, query)
            posts.value = result.items
            postsTotal.value = result.total
        } catch (e) {
            fail(e, t('Could not load the posts.'))
        }
    }

    async function loadAnalytics(principalId: number, days = 30): Promise<void> {
        try {
            analytics.value = await socialApi.getAnalyticsSummary(principalId, days)
        } catch (e) {
            fail(e, t('Could not load the analytics.'))
        }
    }

    async function loadCalendar(principalId: number, month: string): Promise<void> {
        try {
            calendar.value = await socialApi.getCalendar(principalId, month)
        } catch (e) {
            fail(e, t('Could not load the calendar.'))
        }
    }

    /**
     * Give up on the read that is in flight.
     *
     * The token moves on, so the answer is discarded when it lands, and the
     * pending state goes with it: the next caller starts a read of its own
     * rather than joining one whose answer is thrown away.
     */
    function abandonConfigRead(): void {
        if (configPendingPrincipalId === null) return
        configToken++
        configPendingPrincipalId = null
        configPromise = null
    }

    /**
     * The config: the provider entries, the aggregators and the rules every
     * screen reads.
     *
     * Read once per principal. The composer needs the rules and the accounts
     * screen needs the entries, and a second read would be a second answer to
     * a question that has not changed — so a caller that arrives while the
     * read is in flight waits for that read instead of starting another.
     *
     * A failed read is not final: the next caller tries again, because a
     * config that could not be read is a temporary state and the rules are
     * what the composer judges the body against.
     *
     * The aggregators' flags are the principal's, so another principal is
     * another config — and a forced read is what a changed key asks for.
     */
    async function loadConfig(principalId: number, force = false): Promise<void> {
        if (!force) {
            if (configPendingPrincipalId === principalId && configPromise !== null) {
                return configPromise
            }

            // The config is here and it is this principal's.
            if (configPrincipalId === principalId && configError.value === null) {
                // The app is on this principal, so a read for another one is
                // for a principal the operator has left — and its answer must
                // not land on this config.
                abandonConfigRead()
                return
            }
        }

        const token = ++configToken
        configPendingPrincipalId = principalId

        configPromise = (async () => {
            try {
                const loaded = await socialApi.getConfig(principalId)
                // A read for the principal the operator has left answers late;
                // it must not overwrite the config of the one they are on.
                if (token !== configToken) return
                config.value = loaded
                configPrincipalId = principalId
                configError.value = null
            } catch (e) {
                if (token !== configToken) return
                configError.value = apiMessage(e, t('Could not read the plugin configuration.'))
                fail(e, t('Could not read the plugin configuration.'))
            } finally {
                // Only the newest read may clear the pending state: an older
                // one that lands later must not un-claim the read that
                // replaced it.
                if (token === configToken) {
                    configPendingPrincipalId = null
                    configPromise = null
                }
            }
        })()

        return configPromise
    }

    /**
     * Start the OAuth round trip.
     *
     * The backend signs a `state` that carries the principal and a nonce; the
     * browser has to visit the returned URL, so the caller redirects.
     */
    async function connectProvider(
        principalId: number,
        provider: Provider,
    ): Promise<ConnectAccountResult | null> {
        try {
            return await socialApi.connectProvider(principalId, provider)
        } catch (e) {
            fail(e, t('Could not start the connection.'))
            return null
        }
    }

    async function disconnectConnection(principalId: number, id: number): Promise<void> {
        try {
            await socialApi.disconnectConnection(principalId, id)
            connections.value = connections.value.filter((connection) => connection.id !== id)
        } catch (e) {
            fail(e, t('Could not disconnect the connection.'))
        }
    }

    async function refreshConnection(principalId: number, id: number): Promise<void> {
        try {
            const updated = await socialApi.refreshConnection(principalId, id)
            replaceConnection(updated)
        } catch (e) {
            fail(e, t('Could not refresh the token.'))
        }
    }

    async function checkConnectionHealth(principalId: number, id: number): Promise<AccountHealth | null> {
        try {
            return await socialApi.checkConnectionHealth(principalId, id)
        } catch (e) {
            fail(e, t('Could not check the connection.'))
            return null
        }
    }

    function replaceConnection(updated: SocialConnection): void {
        connections.value = connections.value.map((connection) =>
            connection.id === updated.id ? updated : connection,
        )
    }

    /**
     * The aggregator's key, stored.
     *
     * The connections are read again afterwards: the aggregator's accounts
     * are discovered rather than connected, so they are only known once the
     * key is there. The config is read again too — its flag is what says
     * whether the aggregator is set up.
     */
    async function setAggregatorKey(
        principalId: number,
        aggregator: string,
        apiKey: string,
    ): Promise<AggregatorResult | null> {
        try {
            const result = await socialApi.setAggregatorKey(principalId, aggregator, apiKey)
            await Promise.all([loadConnections(principalId, true), loadConfig(principalId, true)])
            return result
        } catch (e) {
            fail(e, t('Could not save the key.'))
            return null
        }
    }

    /**
     * The aggregator's key, forgotten.
     *
     * The accounts stay in the aggregator: they are its accounts, and the
     * operator removes them there.
     */
    async function forgetAggregator(
        principalId: number,
        aggregator: string,
    ): Promise<AggregatorResult | null> {
        try {
            const result = await socialApi.forgetAggregator(principalId, aggregator)
            await Promise.all([loadConnections(principalId, true), loadConfig(principalId, true)])
            return result
        } catch (e) {
            fail(e, t('Could not forget the key.'))
            return null
        }
    }

    /** The aggregator's accounts, read again. */
    async function syncAggregator(principalId: number, aggregator: string): Promise<boolean> {
        try {
            await socialApi.syncAggregator(principalId, aggregator)
            await loadConnections(principalId, true)
            return true
        } catch (e) {
            fail(e, t('Could not read the accounts.'))
            return false
        }
    }

    async function createPost(payload: CreatePostPayload): Promise<SocialPost | null> {
        try {
            const post = await socialApi.createPost(payload)
            posts.value = [post, ...posts.value]
            return post
        } catch (e) {
            fail(e, t('Could not save the post.'))
            return null
        }
    }

    /**
     * Save the changes to a post.
     *
     * The post goes back into the list it came from: the drawer and the
     * composer read the store, and a post that was edited but still shows
     * its old copy is a post the operator cannot trust.
     */
    async function updatePost(
        principalId: number,
        id: number,
        payload: Partial<CreatePostPayload>,
    ): Promise<SocialPost | null> {
        try {
            const post = await socialApi.updatePost(principalId, id, payload)
            replacePost(post)
            return post
        } catch (e) {
            fail(e, t('Could not save the post.'))
            return null
        }
    }

    async function publishPost(principalId: number, id: number): Promise<SocialPost | null> {
        try {
            const post = await socialApi.publishPost(principalId, id)
            replacePost(post)
            return post
        } catch (e) {
            fail(e, t('Could not publish the post.'))
            return null
        }
    }

    async function retryPost(principalId: number, id: number): Promise<SocialPost | null> {
        try {
            const post = await socialApi.retryPost(principalId, id)
            replacePost(post)
            return post
        } catch (e) {
            fail(e, t('Could not retry the failed targets.'))
            return null
        }
    }

    /**
     * Take the published post back down.
     *
     * A network that cannot delete leaves its target published and says
     * why, so the post still comes back with the outcome on its targets.
     */
    async function unpublishPost(principalId: number, id: number): Promise<SocialPost | null> {
        try {
            const post = await socialApi.unpublishPost(principalId, id)
            replacePost(post)
            return post
        } catch (e) {
            fail(e, t('Could not take the post down.'))
            return null
        }
    }

    async function deletePost(principalId: number, id: number): Promise<void> {
        try {
            await socialApi.deletePost(principalId, id)
            posts.value = posts.value.filter((post) => post.id !== id)
        } catch (e) {
            fail(e, t('Could not delete the post.'))
        }
    }

    function replacePost(post: SocialPost): void {
        posts.value = posts.value.map((existing) => (existing.id === post.id ? post : existing))
    }

    function clearError(): void {
        error.value = null
    }

    return {
        connections,
        accounts,
        posts,
        postsTotal,
        analytics,
        calendar,
        config,
        configError,
        loading,
        error,
        notice,
        rules,
        loadConnections,
        loadPosts,
        loadAnalytics,
        loadCalendar,
        loadConfig,
        connectProvider,
        disconnectConnection,
        refreshConnection,
        checkConnectionHealth,
        setAggregatorKey,
        forgetAggregator,
        syncAggregator,
        createPost,
        updatePost,
        publishPost,
        retryPost,
        unpublishPost,
        deletePost,
        setNotice,
        clearError,
    }
})

if (import.meta.hot) {
    import.meta.hot.accept(acceptHMRUpdate(useSocialStore, import.meta.hot))
}
