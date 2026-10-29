<script setup lang="ts">
/**
 * The theme toggle.
 *
 * The host owns the theme and its navbar carries a toggle too; this one is the
 * app's own, because the plugin is a full page with its own chrome. Both go
 * through the host's store, so they cannot disagree.
 */
import { useI18n } from 'vue-i18n'
import { Moon, Sun } from 'lucide-vue-next'
import { useTheme } from '../composables/useTheme'

const { t } = useI18n()
const { isDark, toggle } = useTheme()
</script>

<template>
    <button
        type="button"
        class="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        :aria-label="isDark ? t('Switch to the light theme') : t('Switch to the dark theme')"
        data-test="theme-toggle"
        @click="toggle"
    >
        <Sun v-if="isDark" class="h-4 w-4" />
        <Moon v-else class="h-4 w-4" />
        {{ isDark ? t('Light theme') : t('Dark theme') }}
    </button>
</template>
