# GitHub CI/CD Design

## Overview

A single GitHub Actions workflow that runs lint, tests, and deploys to GitHub Pages for the no2drummer SvelteKit static site.

## Trigger

- `push` to `main`
- `pull_request` targeting `main`

## Environment

- Runner: `ubuntu-latest`
- Bun: 1.3.11 (pinned, via `oven-sh/setup-bun`)
- Node: 24 (pinned, via `actions/setup-node` — needed for Playwright/Vitest browser tooling)

## Caching

- Bun global cache (`~/.bun/install/cache`) cached via `actions/cache`, keyed on `bun.lock`
- Playwright browsers cached separately, keyed on Playwright version

## Jobs

Three sequential jobs in a single workflow file (`.github/workflows/ci.yml`):

### 1. `lint`

Runs on all triggers.

Steps:
1. Checkout code
2. Setup Bun 1.3.11 + Node 24
3. Restore Bun cache
4. `bun install`
5. `bun run lint`

### 2. `test`

Runs after `lint` passes. Runs on all triggers.

Steps:
1. Checkout code
2. Setup Bun 1.3.11 + Node 24
3. Restore Bun cache + Playwright browser cache
4. `bun install`
5. Install Playwright browsers (`bunx playwright install --with-deps chromium`)
6. `bun run test:unit` — runs server, client (browser), and storybook test projects
7. `bun run test:e2e` — runs Playwright E2E tests

### 3. `deploy`

Runs after `test` passes. **Only on `main` branch** (not on PRs).

Steps:
1. Checkout code
2. Setup Bun 1.3.11 + Node 24
3. Restore Bun cache
4. `bun install`
5. `bun run build`
6. Upload `build/` directory via `actions/upload-pages-artifact`
7. Deploy via `actions/deploy-pages`

Permissions required on this job:
- `pages: write`
- `id-token: write`

Environment: `github-pages`

## Repository Setup Required

- Repository Settings → Pages → Source must be set to **"GitHub Actions"**

## Prerequisite Code Changes

These changes are needed for CI compatibility:

1. **Fix `playwright.config.ts`** — change webServer command from `npm run build && npm run preview` to `bun run build && bun run preview`
2. **Remove `package-lock.json`** — stale lockfile from npm, `bun.lock` is the source of truth

## Approach Rationale

- **Sequential jobs (not parallel):** Lint is fast and catches issues early; no point running expensive browser tests if lint fails
- **Single workflow (not two):** Simple project, no need for separate CI and deploy workflows
- **GitHub's official Pages actions:** `upload-pages-artifact` + `deploy-pages` is the recommended flow and avoids needing a deploy key or personal access token
- **Bun native:** Aligns with project's stated package manager; faster installs than npm/pnpm
