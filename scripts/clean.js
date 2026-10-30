#!/usr/bin/env node
/**
 * Removes the build artifacts so a clean `npm run build` can run.
 *
 * We can't use `rm -rf` cross-platform from a Node script, so this is a
 * portable equivalent. Run with `npm run clean`.
 */
import { rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const targets = ['frontend/main.js', 'frontend/style.css']

// The removals run together: an `await` inside a `for` loop is the shape the
// analyser flags (javascript:S9382), and two files need no order.
const removed = await Promise.all(
    targets.map(async (target) => {
        if (!existsSync(target)) return null
        await rm(target)
        return target
    }),
)

for (const target of removed) {
    if (target !== null) console.log(`Removed ${target}`)
}
