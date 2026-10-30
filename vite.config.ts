import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

/**
 * Vite config for the Social IIFE bundle.
 *
 * Mirrors `spora-plugin-team-graph-frontend/vite.config.ts` for the shape
 * (lib.formats/name/fileName/external/output.globals/assetFileNames,
 * server.port, test block); only the slug, lib.name (must match
 * `apps/registry.ts → globalFor('social') → `SporaAppSocial`), the dev port
 * and the externals differ.
 *
 * Tailwind runs as a **Vite** plugin, not through PostCSS — v4 has no
 * `normalizeTailwindDirectives` and therefore none of the
 * `@layer components`-without-`@tailwind components` breakage that forced
 * the old `scopeVendorLayers` pre-plugin in `postcss.config.js`. All
 * Tailwind configuration lives in `src/style.css` (with `important` shimmed
 * through `tailwind.config.ts` via `@config`); see that file for the
 * no-preflight and layer-ordering rationale.
 *
 * **`vue` and `pinia` are the only externals.** The host publishes both on
 * `window` (`spora-frontend/src/utils/publishPluginGlobals.ts`), so the
 * plugin shares the host's Vue and Pinia instances instead of shipping a
 * second copy. `vue-router` is *bundled*: the plugin installs its own
 * router on `createMemoryHistory` and never touches the host's, so sharing
 * the host's copy would buy nothing and would couple the plugin's router
 * version to the host's.
 */
export default defineConfig({
    plugins: [vue(), tailwindcss()],
    define: {
        // `process.env.NODE_ENV` has to be replaced at build time.
        //
        // Vite replaces it for an *app* build, but not for a **library**
        // build — and this is a library build (`build.lib.formats: ['iife']`).
        // So the `process.env.NODE_ENV` inside vue-i18n survives into the
        // bundle, where `process` does not exist: the app dies on load with
        // "process is not defined" before it renders a single string.
        //
        // vue-i18n only uses it to decide whether to *warn* — every use is a
        // `!== 'production'` guard — so replacing it with the real build mode
        // removes the development warnings and changes nothing else. The host
        // SPA gets the same replacement for free, which is why only a plugin
        // bundle hits it.
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    },
    // Must match the host's SPORA_PLUGIN_DEV_PORTS=social:5195 for dev-proxy.
    base: '/plugins/social/',
    build: {
        outDir: 'frontend',
        emptyOutDir: false,
        lib: {
            entry: 'src/main.ts',
            formats: ['iife'],
            name: 'SporaAppSocial',
            fileName: () => 'main.js',
        },
        rollupOptions: {
            external: ['vue', 'pinia'],
            output: {
                globals: {
                    vue: 'window.Vue',
                    pinia: 'window.Pinia',
                },
                assetFileNames: (assetInfo) => {
                    if (assetInfo.name?.endsWith('.css')) {
                        return 'style.css'
                    }
                    return assetInfo.name ?? 'asset'
                },
            },
        },
    },
    server: {
        port: 5195,
        strictPort: false,
        cors: true,
    },
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['tests/**/*.{test,spec}.{js,ts}'],
        // Installs the i18n instance on every mounted component — the
        // components translate their copy through `t()`.
        setupFiles: ['tests/setup.ts'],
        reporters: process.env.CI
            ? [
                ['default'],
                [
                    'junit',
                    {
                        outputFile: './coverage/test-report.xml',
                    },
                ],
            ]
            : ['default'],
        coverage: {
            // lcov for SonarCloud; html for the PR comment.
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            reportsDirectory: './coverage',
            // Every source file the tests could exercise, Vue SFCs included:
            // the components are the app, and a coverage number that leaves
            // them out says nothing about what the operator sees.
            include: ['src/**/*.{ts,vue}'],
            // `dev-main.ts` is the dev sandbox's bootstrap — only index.html
            // loads it, production ships main.ts — and `types.ts` is
            // type-only, so it is erased before the code runs and has nothing
            // to measure.
            exclude: ['src/dev-main.ts', 'src/types.ts', 'src/**/*.css'],
            // The floor the suite has to stay above. Without a threshold the
            // coverage report is a number nobody looks at, and coverage
            // drifts down one uncovered branch at a time.
            thresholds: {
                statements: 90,
                branches: 90,
                functions: 90,
                lines: 90,
            },
        },
    },
})
