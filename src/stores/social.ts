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
import { ApiError } from '../api/client'
import { t } from '../i18n'
import * as socialApi from '../api/social'
import type {
    AccountHealth,
    AnalyticsSummary,
    CalendarPayload,
    ConnectAccountResult,
    CreatePostPayload,
    Platform,
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
     * The rules the backend enforces, per platform.
     *
     * Empty until the config has been read, and empty for good when the
     * config could not be read: the composer must not fall back to a limit
     * of its own.
     */
    const rules = computed<Partial<Record<Platform, PlatformRules>>>(() => config.value?.rules ?? {})

    /**
     * Every account, from every connection.
     *
     * The composer's picker chooses an *account*, and the accounts now arrive
     * inside their connection — so they are flattened here, once.
     */
    const accounts = computed<SocialAccount[]>(() =>
        connections.value.flatMap((connection) => connection.accounts),
    )

    function fail(e: unknown, fallback: string): void {
        error.value = e instanceof ApiError ? e.message : fallback
    }

    function setNotice(message: string | null): void {
        notice.value = message
    }

    async function loadConnections(principalId: number): Promise<void> {
        try {
            connections.value = await socialApi.listConnections(principalId)
        } catch (e) {
            fail(e, t('Could not load the connections.'))
        }
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
     * The config: the platform entries and the rules every screen reads.
     *
     * Read once. The composer needs the rules and the accounts screen needs
     * the entries, and a second read would be a second answer to a question
     * that has not changed — so a caller that arrives while the read is in
     * flight waits for that read instead of starting another.
     *
     * A failed read is not final: the next caller tries again, because a
     * config that could not be read is a temporary state and the rules are
     * what the composer judges the body against.
     */
    async function loadConfig(): Promise<void> {
        if (configPromise !== null && configError.value === null) return configPromise

        configPromise = (async () => {
            try {
                config.value = await socialApi.getConfig()
                configError.value = null
            } catch (e) {
                configError.value = e instanceof ApiError ? e.message : t('Could not read the plugin configuration.')
                fail(e, t('Could not read the plugin configuration.'))
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
        createPost,
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
