# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**no2drummer** — a SvelteKit static site using Svelte 5, TypeScript, and TailwindCSS v4.

See also:
- **ARCHITECTURE.md** — high-level system architecture and design
- **DECISIONS.md** — key project decisions and their rationale

**Always use `bun` as the package manager and script runner.** Do not use `npm`, `pnpm`, or `yarn`.

## Commands

| Task | Command |
|------|---------|
| Dev server | `bun dev` |
| Build | `bun run build` |
| Preview build | `bun run preview` |
| Type check | `bun run check` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| All tests | `bun run test` |
| Unit tests only | `bun run test:unit` |
| Single unit test | `bun run test:unit -- src/lib/path/to/file.spec.ts` |
| E2E tests | `bun run test:e2e` |

> **Do NOT use `bun test`** — that invokes Bun's native test runner, which is incompatible with Vitest. Always use `bun run test`.
| Storybook | `bun run storybook` |

## Architecture

- **Static site** — uses `@sveltejs/adapter-static`, output is fully pre-rendered
- **Svelte 5 runes** — use `$props()`, `$derived()`, `$state()`, etc. (no legacy reactive syntax)
- **MDSvex** — markdown files (`.svx`) are valid route/component sources alongside `.svelte`
- **TailwindCSS v4** — integrated via Vite plugin (`@tailwindcss/vite`), with `@tailwindcss/forms` and `@tailwindcss/typography` plugins. Global stylesheet at `src/routes/layout.css`

## Testing Setup

Three Vitest test projects configured in `vite.config.ts`:

1. **client** — browser-based component tests using Playwright provider + `vitest-browser-svelte`. File pattern: `*.svelte.{test,spec}.ts`
2. **server** — Node.js environment for non-component unit tests. File pattern: `*.{test,spec}.ts` (excluding `*.svelte.*`)
3. **storybook** — runs story-level tests via `@storybook/addon-vitest`

`expect.requireAssertions: true` is set globally — every test must contain at least one assertion.

**E2E tests** use Playwright directly (not Vitest). File pattern: `*.e2e.ts`. Config in `playwright.config.ts` — builds the app and serves on port 4173 during test runs.

## Code Style

- **Spaces** (2-space indent), **single quotes**, **no trailing commas**, **100 char print width** (see `.prettierrc`)
- Prettier plugins: `prettier-plugin-svelte`, `prettier-plugin-tailwindcss` (auto-sorts Tailwind classes)
- ESLint: flat config with TypeScript, Svelte, and Storybook plugins

## Svelte Component Pattern

```svelte
<script lang="ts">
  interface Props { /* ... */ }
  let { prop1, prop2 = 'default' }: Props = $props();
  let derived = $derived(/* ... */);
</script>
```

## Storybook

Stories use Svelte CSF format (`*.stories.svelte`) with `defineMeta` and `Story` components from `@storybook/addon-svelte-csf`. A11y addon is configured in 'todo' mode.

## Svelte MCP Server

The Svelte MCP server is available for up-to-date Svelte 5 and SvelteKit documentation:

1. **list-sections** — call FIRST to discover available documentation sections
2. **get-documentation** — fetch full content for relevant sections found via list-sections
3. **svelte-autofixer** — MUST be used when writing Svelte code; call repeatedly until no issues remain
4. **playground-link** — generates Svelte Playground links; only use after user confirms and never if code was written to project files
