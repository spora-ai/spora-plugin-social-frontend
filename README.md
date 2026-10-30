# spora-plugin-social-frontend

Vue 3 admin SPA for the Spora **social** app. The host SPA (`spora-frontend`) lazy-loads it at `/plugins/social/main.js` — the parent plugin's `plugin.json#slug`, not this package's name — and mounts it into the `/apps/social` slot via the global `window.SporaAppSocial`.

The PHP half of the app lives in `spora-plugin-social`; this repo ships only the built assets. The wire contract is the plugin's own routes (`/api/v1/plugins/social/*`) plus the host's `/principals/me`; read them before changing anything under `src/api/`.

## The package

A Composer package of type `spora-plugin-frontend`. `SporaPluginFrontendInstaller` reads `composer.json#extra.spora-plugin-slug` (`social` — it must equal the parent plugin's `plugin.json#slug`, and the installer refuses to install when it does not) and copies the built `frontend/` directory into the host's `public/plugins/social/`.

The build is a Vite **library** build in IIFE format: `npm run build` writes `frontend/main.js` and `frontend/style.css`, and the host injects the stylesheet and lazy-loads the script. Vue and Pinia are the only externalised modules — they are published on `window.Vue` / `window.Pinia` by the host. `vue-router` is bundled: the app installs its own router on a memory history and never touches the host's, so sharing the host's copy would buy nothing and would couple the plugin's router version to the host's.

`frontend/` is gitignored here: the release tarball is built by CI from the tagged commit, not from a committed artefact.

## What the app does

Four screens, behind a rail, with the principal switcher at the top of the rail:

- **Compose** — the landing screen. The composer with per-platform character counters, the target account picker, the media strip and the publish/schedule controls, plus the "up next" queue and the accounts that need attention. The schedule control is the one-shot path and is unchanged by the cut of the static slot.
- **Calendar** — the month grid, with the month's posts on the day they go out.
- **Posts** — the post list, with the reach column, and — behind a segmented control — **Analytics**, which is a *route* (`/apps/social/p/{pid}/posts/analytics`), not a flag. A post the agent wrote says so, and a scheduled one says that the agent will publish it.
- **Accounts** — the **connections**, one card per login. A provider is a login, not a network: one Meta login publishes as an Instagram professional account *and* as a Facebook Page, under one token — so the card names the provider, carries the token's health, and lists the accounts it covers with their platform badges and their report notes. A provider with no connection gets a **Connect Meta** / **Connect LinkedIn** button; a provider that is not configured yet also says what to add and where — the app id, the secret and the configuration id live in **Settings → Plugins**, and so does the redirect URI to register with the platform.

There is **no Recurring tab**. The static slot — a fixed slot that posted the same words every week — was cut: its template only knew date and time variables, and LinkedIn and Meta ship native scheduled posts anyway. The agent-driven mode replaced it: core's scheduler wakes an agent, the agent drafts the copy, and the post it creates is a scheduled post like any other — so the recurrence itself lives in the agent's own Schedules tab.

## Routing

**The host URL is the source of truth.** The plugin installs a local `vue-router` on `createMemoryHistory` and mirrors the host URL in both directions:

- **host → local is `replace`** — the host has already pushed, so counting it again would leave the local stack out of step with the browser's;
- **local → host is `push`** — a destination the operator chose earns a history entry, and without this direction nothing the app shows is linkable, bookmarkable or reloadable;
- both directions guard on *"is the other side already there"*, which is what makes ping-pong impossible — no timers, no sequence numbers;
- the local path is the host path **minus `/apps/social`** — a prefix strip and an append, not a table of kinds, so a page added later cannot be left out.

The plugin cannot use the host's router: the host registers `/apps/:appName/:rest*` as a catch-all with no named children, and a catch-all wins over anything a plugin could add beside it.

The principal is on **every** path, because every account and post belongs to one and the plugin's API is principal-scoped. `src/lib/paths.ts` holds the pure builders, so a forgotten principal at one call site cannot reopen the bug. A `p/{pid}` the caller cannot act as is never selected: `GET /principals/me` is the gate, the URL is replaced with the canonical one, and the operator is told why.

## Build

```bash
npm install
npm run build   # vue-tsc --noEmit && vite build → frontend/main.js + frontend/style.css
npm run smoke   # static guard on the IIFE global, the mount contract and the CSS scope
```

`npm run smoke` reads the built assets as text: a missing global, a rewritten CSS layer or a dropped utility looks exactly like a working build in a diff, and an invalid CSS value is discarded at computed-value time without an error anywhere. The checks are the reason the stylesheet's hand-written rules stay inside the plugin boundary.

## Dev mode (plugin author)

```bash
npm run dev   # vite dev server on :5195
```

The dev sandbox stubs the REST API, so the app renders without a backend. To exercise the real wire surface, run the host SPA's plugin dev-proxy (`SPORA_PLUGIN_DEV_PORTS=social:5195 npm run dev` in `spora-frontend`) and visit `/apps/social`.

The dev page has no host CSS variables: every colour resolves through the host's tokens and nothing in this repo declares them. Load the app through the dev-proxy before judging any colour.

## Languages

The app ships its own `vue-i18n` instance (`src/i18n/index.ts`) built from its own catalogue — the host does not publish its instance, because that would couple every plugin to the host's catalogue lifetime and to a version-skewed peer range. The locale comes from the host through `PluginHostContext.locale`; the dev sandbox reads it from `?locale=de`.

```
src/locales/en.json   generated identity map — every key maps to itself
src/locales/de.json   the German catalogue
```

**The catalogue key is the English source string** — `t('Save draft')`, not a slug. `en.json` is therefore generated, never hand-edited, and a copy edit orphans the German entry that was paired with it — which is exactly what the extractor's orphan rule catches.

```bash
npm run i18n:extract   # regenerate en.json from the source and report what is untranslated
npm run i18n:check     # the CI gate: en.json drift, a locale's key set, untranslated values, and copy outside t()
```

`npm run i18n:check` fails on an operator-facing string that is not wrapped in `t()`. In this app that failure is fatal rather than advisory: the app is the operator's whole surface, so a string that missed the catalogue is a string the operator reads in English.

### What stays English, and why

Three kinds of string are deliberately not in the catalogue:

- **The networks' names** — "LinkedIn", "Facebook", "Instagram". They are the platforms' brand, they read the same in every language, and an invented translation would break the link between a chip and the account it names.
- **`Principal` / `Principals`** — the house term. The host's own German catalogue keeps it untranslated ("Ziel-Principal", "einen anderen Principal"), so a German operator reads "Principal" here too, and translating it would put two words for one concept on the same screen.
- **`Spora`** — the house's own name.

These are the extractor's `EXCLUDED_TERMS` — it leaves them in the template as raw text instead of reporting them as untranslated copy.

## The theme

**Light by default.** The host owns the theme: `localStorage.theme` holds `'light'` or `'dark'`, the `dark` class sits on `<html>`, and the host's navbar carries the toggle. The plugin reads the host's store through `hostContext.pinia` rather than keeping a second one — two stores would disagree the moment the operator used the host's toggle. There is no operating-system colour-preference query anywhere in this repo: an OS block would override the explicit choice the toggle makes.

## Connections, not platforms

The plugin holds **one OAuth connection per provider**, not one per platform. A Meta connection covers an Instagram professional account *and* a Facebook Page under one token; a LinkedIn connection covers a member and the organisations they administer.

So the Accounts screen shows connections: the token's expiry, its status and the "needs reconnect" flag belong to the connection, and each account carries only what is its own — its platform, its name, its audience and the note that says whether it can report numbers at all. The composer's picker still picks **accounts**, so they are flattened out of their connections where it needs them.

The platform **limits** are the backend's: `/config` carries them, because the backend is what refuses the publish. The frontend keeps no copy of them.

## The media

The composer opens the **host's** media picker: `host.openMediaPicker({ multi: true, mediaKind: 'image' })`. The plugin ships no upload dialog of its own — the host's picker lists the Media Archive *and* uploads, and its two-step shape is kept: a tile click chooses, the Attach button commits.

Each attachment carries its fit state **for the platforms currently targeted**, with the remedy named ("Convert to JPEG"), because the operator can act on that and not on a platform's error text.

## Mount contract

The IIFE bundle installs `window.SporaAppSocial` (the PascalCase of the slug) with two methods:

- `mount(target: HTMLElement, hostContext)` — create the app, install the local Pinia and the plugin's own i18n instance, mirror the host URL, mount into the host's slot. It is **async**: the app can be mounted onto a URL that already names a principal and a section, and `RouterView` renders nothing until that navigation resolves.
- `unmount(target: HTMLElement)` — tear down.

The host's `apps/registry.ts` reads both. The bundle name must stay aligned with `social` → `SporaAppSocial` (see `vite.config.ts → build.lib.name`).

## Commands

```bash
npm install
npm run dev            # standalone sandbox on :5195 with stubbed payloads
npm run lint           # eslint
npm run typecheck      # vue-tsc --noEmit
npm test               # vitest run
npm run test:coverage  # vitest run --coverage → coverage/lcov.info
npm run build          # vue-tsc --noEmit && vite build → frontend/
npm run smoke          # static guard on the IIFE bundle + the CSS scope
npm run i18n:extract   # regenerate src/locales/en.json
npm run i18n:check     # the catalogue gate
npm run clean          # removes frontend/main.js + frontend/style.css
```

CI runs lint, type-check, the catalogue gate, the tests, the build, the smoke check, a bundle-size budget and the SonarCloud scan on every push.

## Tests

- `tests/lib/paths.spec.ts` — every path builder, and the principal on every path.
- `tests/lib/hostRoute.spec.ts` — the round trip in both directions, the slug, and the canonicalisation of an unknown section or a foreign principal.
- `tests/main-mount.spec.ts` — the mount contract: host → local is a replace, local → host is a push, no ping-pong, the URL round trip, the canonicalisation and the foreign principal.
- `tests/App.spec.ts` — the rail's four tabs, and a stale `/recurring` link being canonicalised rather than blanked.
- `tests/components/` — the principal switcher, the media strip, the accounts grid, the analytics view, the posts table and the calendar grid.
- `tests/pages/` — the two views of the Posts tab, the composer, the accounts and the calendar.
- `tests/api/social.spec.ts` — the exact paths and the shapes.
- `tests/lib/theme.spec.ts` — light on load, the toggle, the persisted value.

## Releasing

See [RELEASING.md](./RELEASING.md). In short: bump `package.json` **and** `composer.json` (including `dist.url`), then tag `v<version>`. The `build-and-release` job fails if `dist.url` does not match the tag.

## License

MIT — declared in `composer.json#license`.
