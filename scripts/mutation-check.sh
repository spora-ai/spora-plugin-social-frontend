#!/usr/bin/env bash
# Mutation check: each fix is reverted in turn, and the test that guards it
# must fail. A test that passes without its fix proves nothing.
set -u
cd "$(dirname "$0")/.."

BACKUP=$(mktemp -d)
cp -R src tests "$BACKUP/"

restore() {
    rm -rf src tests
    cp -R "$BACKUP/src" "$BACKUP/tests" .
}

replace() {
    python3 - "$1" "$2" "$3" <<'PY'
import sys
path, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, encoding='utf-8') as handle:
    text = handle.read()
if old not in text:
    sys.exit(2)
with open(path, 'w', encoding='utf-8') as handle:
    handle.write(text.replace(old, new, 1))
PY
}

check() {
    local name="$1"; shift
    local file="$1"; shift
    local pattern="$1"; shift
    local replacement="$1"; shift
    local testfile="$1"; shift

    if ! replace "$file" "$pattern" "$replacement"; then
        echo "SKIP  $name — the mutation did not apply"
        restore
        return
    fi
    if npx vitest run "$testfile" >/dev/null 2>&1; then
        echo "FAIL  $name — the test still passed without its fix"
    else
        echo "OK    $name — the test fails without its fix"
    fi
    restore
}

# 1. Host → local is a replace, not a push.
check "host→local replace" src/main.ts \
  'void router.replace({ path: localPath, query: to.query as LocationQueryRaw }).catch(() => {})' \
  'void router.push({ path: localPath, query: to.query as LocationQueryRaw }).catch(() => {})' \
  tests/main-mount.spec.ts

# 2. The echo guard that makes ping-pong impossible.
check "echo guard" src/main.ts \
  'if (current.path === localPath && sameQuery(current.query, to.query)) return' \
  'if (false) return' \
  tests/main-mount.spec.ts

# 3. The local path is the host path minus /apps/social.
check "prefix strip" src/lib/hostRoute.ts \
  'return `/${path.slice(prefix.length + 1)}`' \
  'return `/table-of-kinds/${path.slice(prefix.length + 1)}`' \
  tests/lib/hostRoute.spec.ts

# 4. An unknown section is canonicalised, not blanked.
check "unknown section canonicalised" src/App.vue \
  'const canonical = canonicalLocalPath(route.path, route.name, resolved)' \
  'const canonical: string | null = null' \
  tests/main-mount.spec.ts

# 5. A principal the caller cannot act as is never selected.
check "foreign principal never selected" src/App.vue \
  'const resolved = principals.isVisible(named) ? named : principals.defaultPrincipalId()' \
  'const resolved = named ?? principals.defaultPrincipalId()' \
  tests/main-mount.spec.ts

# 6. Switching the principal replaces the URL rather than pushing it.
check "principal switch replaces" src/composables/usePrincipalSwitcher.ts \
  'await router.replace(sectionPath(id, section.value))' \
  'await router.push(sectionPath(id, section.value))' \
  tests/components/PrincipalSwitcher.spec.ts

# 7. The media strip badges the fit for the targeted platforms.
check "media fit badge" src/components/MediaStrip.vue \
  'return fit.fits ? null : { platform, reason: fit.reason, remedy: fit.remedy }' \
  'return null' \
  tests/components/MediaStrip.spec.ts

# 8. The chart series use the chart tokens, not the brand hues.
check "chart series colours" src/components/AnalyticsView.vue \
  'background: `hsl(${chartColorVar(platform)})`,' \
  'background: `hsl(${brandColorVar(platform)})`,' \
  tests/components/AnalyticsView.spec.ts


# 10. The theme toggle writes the persisted value.
check "theme toggle persists" src/composables/useTheme.ts \
  'localStorage.setItem(THEME_STORAGE_KEY, next)' \
  'void next' \
  tests/lib/theme.spec.ts

# 11. The analytics view is a route, not a flag.
check "analytics is a route" src/pages/PostsPage.vue \
  ':to="principalId === null ? analyticsPath(0) : analyticsPath(principalId)"' \
  ':to="principalId === null ? postsPath(0) : postsPath(principalId)"' \
  tests/pages/PostsPage.spec.ts

# 12. The API paths are the contract's paths.
check "api paths" src/api/social.ts \
  '`${BASE}/analytics/summary`' \
  '`${BASE}/analytics-summary`' \
  tests/api/social.spec.ts


# 15. The posts table carries the reach column.
check "reach column" src/lib/metrics.ts \
  'return reported.length === 0 ? null : reported.reduce((sum, reach) => sum + reach, 0)' \
  'return reported.reduce((sum, reach) => sum + reach, 0)' \
  tests/components/PostsTable.spec.ts

# 17. The posts table carries a thumbnail.
check "posts table thumbnail" src/components/PostsTable.vue \
  '                            <PostImage
                                v-if="thumbnail(post) !== null"
                                :media="thumbnail(post)!"
                                alt=""
                                variant="thumb"
                            />
' \
  '' \
  tests/components/PostsTable.spec.ts

# 18. The table shows no thumbnail for an image whose asset is gone.
check "no thumbnail without an asset" src/components/PostsTable.vue \
  'return ordered.find((item) => item.asset_url !== null) ?? null' \
  'return ordered[0] ?? null' \
  tests/components/PostsTable.spec.ts

# 19. A post without an image leaves no empty box behind.
check "no empty box without an image" src/components/PostsTable.vue \
  '                            <PostImage
                                v-if="thumbnail(post) !== null"
                                :media="thumbnail(post)!"
                                alt=""
                                variant="thumb"
                            />
' \
  '                            <PostImage
                                v-if="thumbnail(post) !== null"
                                :media="thumbnail(post)!"
                                alt=""
                                variant="thumb"
                            />
                            <div
                                v-else
                                class="h-11 w-11 rounded-lg bg-muted"
                                data-test="post-image-placeholder-empty"
                            />
' \
  tests/components/PostsTable.spec.ts

# 19. The drawer puts the image above the text.
check "drawer image above the text" src/pages/PostsPage.vue \
  '<div v-if="drawerMedia.length > 0" class="space-y-2" data-test="drawer-media">' \
  '<div v-if="false" class="space-y-2" data-test="drawer-media">' \
  tests/pages/PostsPage.spec.ts

# 20. The remaining attachments appear as a strip.
check "drawer media strip" src/pages/PostsPage.vue \
  '<div v-if="drawerMedia.length > 1" class="flex flex-wrap gap-2" data-test="drawer-media-strip">' \
  '<div v-if="false" class="flex flex-wrap gap-2" data-test="drawer-media-strip">' \
  tests/pages/PostsPage.spec.ts

# 21. A missing asset renders a placeholder, not a broken image.
check "missing asset placeholder" src/components/PostImage.vue \
  '<div
        v-else' \
  '<img
        v-else
        :src="media.asset_url ?? \"\""
        alt=""' \
  tests/pages/PostsPage.spec.ts

# 22. The drawer does not read a null reach as a number.
check "drawer null reach" src/pages/PostsPage.vue \
  '{{ formatCounter(target.metrics.reach) }}' \
  '{{ target.metrics.reach.toLocaleString() }}' \
  tests/pages/PostsPage.spec.ts

# 23. The table shows a dash for a reach that was never reported.
check "table null reach" src/components/PostsTable.vue \
  '{{ formatCounter(postReach(post)) }}' \
  '{{ (postReach(post) ?? 0).toLocaleString() }}' \
  tests/components/PostsTable.spec.ts

# 24. The table shows a dash for a rate there is none of.
check "table null rate" src/components/PostsTable.vue \
  '{{ rateLabel(post) }}' \
  '{{ ((postEngagementRate(post) ?? 0) * 100).toFixed(1) }}% engagement' \
  tests/components/PostsTable.spec.ts

# 25. A post with no reported reach has no reach at all.
check "post reach null" src/lib/metrics.ts \
  'return reported.length === 0 ? null : reported.reduce((sum, reach) => sum + reach, 0)' \
  'return reported.reduce((sum, reach) => sum + reach, 0)' \
  tests/lib/metrics.spec.ts

# 26. The network table shows a dash for a counter that was never reported.
check "network null reach" src/components/AnalyticsView.vue \
  '{{ formatCounter(network.reach) }}' \
  '{{ network.reach.toLocaleString() }}' \
  tests/components/AnalyticsView.spec.ts

# 27. The reach tile shows a dash when no network reported a reach.
check "kpi null reach" src/components/AnalyticsView.vue \
  '{{ formatCounter(summedReach) }}' \
  '{{ (summedReach ?? 0).toLocaleString() }}' \
  tests/components/AnalyticsView.spec.ts

# 28. A day whose series omits a platform still adds up.
check "chart day total" src/components/AnalyticsView.vue \
  '${dayTotal(day).toLocaleString()} reach' \
  '${(day.linkedin + day.facebook + day.instagram).toLocaleString()} reach' \
  tests/components/AnalyticsView.spec.ts

# 29. The top-posts table shows a dash for a reach that was never reported.
check "top post null reach" src/components/AnalyticsView.vue \
  '{{ formatCounter(post.reach) }}' \
  '{{ post.reach.toLocaleString() }}' \
  tests/components/AnalyticsView.spec.ts

# 40. The platform entry's flag is read, not the entry itself.
check "the platform flag is read" src/api/social.ts \
  '        configured: entry?.configured === true,' \
  '        configured: entry !== undefined,' \
  tests/api/social.spec.ts

# 41. A platform entry that is absent means "not configured".
check "a missing entry is not configured" src/api/social.ts \
  '        configured: entry?.configured === true,' \
  '        configured: true,' \
  tests/api/social.spec.ts




# 45. A list that arrives as something else is loud.
check "a wrong shape is loud" src/api/social.ts \
  '        throw new Error(`${what} did not answer with a list.`)' \
  '        return [] as never' \
  tests/api/social.spec.ts

# 46. A calendar post is keyed by `post_id`.
check "the calendar post is keyed by post_id" src/components/CalendarGrid.vue \
  ':data-test="`calendar-post-${post.post_id}`"' \
  ':data-test="`calendar-post-${(post as unknown as { id: number }).id}`"' \
  tests/components/CalendarGrid.spec.ts

# 47. The rail has four tabs, not five.
check "the rail has four tabs" src/App.vue \
  "    { key: 'accounts', label: t('Accounts'), hint: t('The accounts you publish to'), icon: Users },
]" \
  "    { key: 'accounts', label: t('Accounts'), hint: t('The accounts you publish to'), icon: Users },
    { key: 'recurring', label: t('Recurring'), hint: t('What repeats'), icon: Users },
]" \
  tests/App.spec.ts

# 48. The route table has no recurring route, so a stale link is canonicalised.
check "the recurring route is gone" src/lib/routes.ts \
  "    { path: '/p/:principalId/post/:postId', name: 'post', component: PostsPage }," \
  "    { path: '/p/:principalId/recurring', name: 'recurring', component: ComposePage },
    { path: '/p/:principalId/post/:postId', name: 'post', component: PostsPage }," \
  tests/App.spec.ts

# 49. The calendar carries no slot tint.
check "the calendar has no tint" src/components/CalendarGrid.vue \
  '                :data-today="cell.today"' \
  '                :data-today="cell.today"
                :data-recurring="true"' \
  tests/components/CalendarGrid.spec.ts

# 50. The calendar says nothing about a tinted day.
check "the calendar has no footnote" src/components/CalendarGrid.vue \
  '                <h2 class="text-sm font-semibold">{{ monthLabel }}</h2>' \
  '                <h2 class="text-sm font-semibold">{{ monthLabel }}</h2>
                <p class="text-xs text-muted-foreground">{{ t("A tinted day is one a fixed slot fires on.") }}</p>' \
  tests/components/CalendarGrid.spec.ts


# 52. An agent-written post says so.
check "the agent is named" src/lib/postSource.ts \
  "    return source === 'ai' ? t('By an agent') : t('Manual')" \
  "    return source === 'ai' ? 'ai' : 'manual'" \
  tests/components/PostsTable.spec.ts

# 53. A scheduled agent post says the agent will publish it.
check "the agent will publish it" src/lib/postSource.ts \
  "    return post.source === 'ai' && post.status === 'scheduled'" \
  '    return false' \
  tests/components/PostsTable.spec.ts

# 54. The rules are the backend's, not a table of the frontend's own.
check "rules come from the config" src/stores/social.ts \
  'const rules = computed<Partial<Record<Platform, PlatformRules>>>(() => config.value?.rules ?? {})' \
  'const rules = computed<Partial<Record<Platform, PlatformRules>>>(() => ({}))' \
  tests/stores/social.spec.ts

# 55. The config is read once, not once per caller.
check "the config is read once" src/stores/social.ts \
  'if (configPromise !== null && configError.value === null) return configPromise' \
  'if (false) return configPromise' \
  tests/stores/social.spec.ts

# 56. The counter counts against the limit the backend sent.
check "the counter uses the backend's limit" src/components/ComposerPanel.vue \
  'const count = rule === undefined ? null : charCount(bodyFor(platform), rule.max_text)' \
  'const count = rule === undefined ? null : charCount(bodyFor(platform), 2200)' \
  tests/pages/ComposePage.spec.ts

# 57. The badge quotes the backend's wording.
check "the badge quotes the backend" src/lib/platforms.ts \
  '            reason: rule.media_note,' \
  "            reason: 'The media does not fit this network'," \
  tests/components/MediaStrip.spec.ts

# 58. The frontend carries no copy of the limits.
check "no copy of the limits" src/lib/platforms.ts \
  'export const PLATFORMS: Platform[] = [' \
  'export const PLATFORM_CONSTRAINTS = { linkedin: { maxText: 3000 } }
export const PLATFORMS: Platform[] = [' \
  tests/lib/platforms.spec.ts

# 59. The preview shows the rule the backend sent.
check "the preview shows the rule" src/components/ComposerPanel.vue \
  '                            {{ preview.rule.media_note }}' \
  '                            {{ preview.platform }}' \
  tests/pages/ComposePage.spec.ts

# 54. The accounts screen shows one card per connection.
check "one card per connection" src/components/ConnectionsGrid.vue \
  '                v-for="connection in connections"' \
  '                v-for="connection in connections.slice(0, 1)"' \
  tests/components/ConnectionsGrid.spec.ts

# 55. A Meta connection shows both of the accounts it covers.
check "both accounts of a connection" src/components/ConnectionsGrid.vue \
  '                        v-for="account in connection.accounts"' \
  '                        v-for="account in connection.accounts.slice(0, 1)"' \
  tests/components/ConnectionsGrid.spec.ts

# 56. One Connect button per provider that has no connection.
check "one connect button per provider" src/components/ConnectionsGrid.vue \
  '    PROVIDERS.filter(
        (provider) => !props.connections.some((connection) => connection.provider === provider),
    ),' \
  '    PROVIDERS.filter(() => false),' \
  tests/components/ConnectionsGrid.spec.ts


# 58. A token that never expires says so.
check "never expires" src/lib/providers.ts \
  "    if (connection.expires_at === null) return t('Never expires')" \
  '    if (connection.expires_at === null) return NO_VALUE' \
  tests/components/ConnectionsGrid.spec.ts

# 59. The report note is rendered.
check "the report note" src/components/ConnectionsGrid.vue \
  '                            v-if="account.report_note"' \
  '                            v-if="false"' \
  tests/components/ConnectionsGrid.spec.ts

# 60. The removed endpoints are never called.
check "no account endpoints" src/api/social.ts \
  'await getApi().get<unknown>(`${BASE}/connections`, { principal_id: principalId })' \
  'await getApi().get<unknown>(`${BASE}/accounts`, { principal_id: principalId })' \
  tests/api/social.spec.ts

# 61. The accounts are flattened out of their connections.
check "the accounts are flattened" src/stores/social.ts \
  '        connections.value.flatMap((connection) => connection.accounts),' \
  '        [],' \
  tests/stores/social.spec.ts

# 62. The composer's picker offers the connection's accounts.
check "the picker offers the accounts" src/components/AccountPicker.vue \
  '    props.accounts.reduce(' \
  '    props.accounts.slice(0, 1).reduce(' \
  tests/pages/ComposePage.spec.ts

# 54. A token that never expires has no Refresh button to press.
check "no refresh on a token that never expires" src/components/ConnectionsGrid.vue \
  '                        v-if="connection.expires_at !== null"' \
  '                        v-if="true"' \
  tests/components/ConnectionsGrid.spec.ts

# 55. A token that expires keeps its Refresh button.
check "refresh stays on a token that expires" src/components/ConnectionsGrid.vue \
  '                        v-if="connection.expires_at !== null"' \
  '                        v-if="false"' \
  tests/components/ConnectionsGrid.spec.ts

                    <code>/api/v1/plugins/social/oauth/linkedin/callback</code>
                    <button type="button" data-test="copy-redirect-uri-linkedin">Copy</button>
                </div>
                <!-- The setup instruction names what is missing and where to add' \
  tests/components/ConnectionsGrid.spec.ts



# 59. The server's setup message surfaces; the client does not refuse it itself.
check "the server's message surfaces" src/pages/AccountsPage.vue \
  '    const result = await social.connectProvider(principalId.value, provider)' \
  '    social.setNotice(t("Could not start the connection."))
    return

    const result = await social.connectProvider(principalId.value, provider)' \
  tests/pages/AccountsPage.spec.ts

# 60. The frontend reads no redirect_uri from the config.
check "no redirect uri is read" src/api/social.ts \
  '        config_id: entry?.config_id ?? null,' \
  '        config_id: entry?.config_id ?? null,
        redirect_uri: entry?.redirect_uri ?? null,' \
  tests/stores/social.spec.ts

# 58. The setup card renders the backend's wording.
check "the setup card renders the backend's wording" src/components/ConnectionsGrid.vue \
  '{{ setupNotice(provider)!.title }}' \
  "{{ 'Setup needed' }}" \
  tests/components/ConnectionsGrid.spec.ts

# 59. The frontend keeps no wording of its own.
check "no wording of its own" src/lib/providers.ts \
  'export function providerLabel(provider: Provider): string {' \
  "export function providerLabel(provider: Provider): string {
    // Meta integration needs setup — Add the app id in Settings → Plugins.
    void 'Meta integration needs setup'
" \
  tests/components/ConnectionsGrid.spec.ts

# 60. A provider with no notice renders no card.
check "no card without a notice" src/components/ConnectionsGrid.vue \
  '    return entry.needs_setup' \
  "    return entry.needs_setup ?? { title: 'Setup needed', body: 'Add the settings.' }" \
  tests/components/ConnectionsGrid.spec.ts

# 53. The card is keyed on the notice alone.
check "the notice alone decides" src/components/ConnectionsGrid.vue \
  '    return props.config?.providers[provider]?.needs_setup ?? null' \
  '    const entry = props.config?.providers[provider]
    if (entry === undefined || entry.configured) return null
    return entry.needs_setup' \
  tests/components/ConnectionsGrid.spec.ts

rm -rf "$BACKUP"
