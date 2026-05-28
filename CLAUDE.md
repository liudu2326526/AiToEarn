# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AitoBee (formerly AiToEarn) — a social media content management platform supporting multi-platform publishing, AI-driven content generation, engagement automation, and a creator/advertiser task marketplace. Monorepo with a Next.js frontend and NestJS backend.

## Repository Structure

```
project/
├── aitoearn-web/          # Next.js App Router frontend (port 6061)
└── aitoearn-backend/      # Nx monorepo with NestJS apps + shared libs
    ├── apps/
    │   ├── aitoearn-server/   # Main API server (port 7001)
    │   └── aitoearn-ai/       # AI service
    └── libs/                  # Shared libraries
        ├── channel-db/        # Mongoose schemas & repositories for channel domain
        ├── mongodb/           # Core MongoDB (users, api-keys)
        ├── helpers/           # Metric events, utilities
        ├── aitoearn-auth/     # Auth module (JWT, guards)
        ├── aitoearn-queue/    # BullMQ job queues
        └── ...
```

## Commands

### Frontend (`project/aitoearn-web/`)

```bash
pnpm dev                    # Dev server on :6061
pnpm build                  # Production build
pnpm run type-check         # TypeScript check (tsc --noEmit)
pnpm run lint               # ESLint
pnpm run lint:fix           # ESLint autofix
pnpm test                   # Playwright e2e tests
pnpm test tests/e2e/home/   # Run specific test directory
```

### Backend (`project/aitoearn-backend/`)

```bash
pnpm nx serve aitoearn-server    # Dev server on :7001
pnpm nx run aitoearn-server:build  # Build
pnpm nx run aitoearn-server:test   # Run all tests (vitest)
pnpm exec vitest run <path>        # Run specific test file
pnpm run lint                      # Lint all projects
```

### Root

```bash
pnpm run server:serve       # Alias for nx serve aitoearn-server
pnpm run ai:serve           # Alias for nx serve aitoearn-ai
```

## Architecture Patterns

### Backend

- **Module pattern**: Each domain is a NestJS module under `apps/aitoearn-server/src/core/`. Modules register in `app.module.ts`.
- **Schema/Repository pattern**: Mongoose schemas in `libs/channel-db/src/schemas/`, one file per collection. Schemas must be registered in `schemas/index.ts` `schemas` array. Repositories in `libs/channel-db/src/repositories/` extend a base repository.
- **Schema conventions**: All schemas extend `BaseTemp` (from `./time.tamp`), use `DEFAULT_SCHEMA_OPTIONS` from `channel-db.constants`, and set `collection` name explicitly.
- **Validation**: Zod (v4) for DTOs, not class-validator.
- **Package scope**: `@yikart/*` for all internal libs.

### Frontend

- **Next.js App Router** with `[lng]` dynamic segment for i18n routing.
- **State**: Zustand stores, typically co-located with page components.
- **API client**: Functions in `src/api/` using a custom `FetchService` wrapper (`src/utils/request.ts`). Pattern: `http.get<T>(path)` / `http.post<T>(path, data)`. Base URL from `NEXT_PUBLIC_API_URL`.
- **i18n**: `i18next` with locale files in `src/app/i18n/locales/{lang}/`. Type generation via `i18next-resources-for-ts`.
- **UI**: Ant Design + Radix UI + Tailwind CSS + Lucide icons.
- **Path alias**: `@/*` maps to `./src/*`.

### Conventions

- Package manager: **pnpm** (v10). No npm/yarn.
- Pre-commit hook: lint-staged runs ESLint on affected files via Nx.
- Commit messages: enforced by `git-commit-msg-linter`.
- Backend env config: `apps/aitoearn-server/src/config.ts`.
- Frontend env: `.env` / `NEXT_PUBLIC_*` vars.

## Key Integration Points

- **Channel accounts** (`libs/channel-db`): Platform OAuth credentials and social accounts.
- **Publishing pipeline** (`core/channel/publishing`): Platform-specific publishers.
- **XHS plugin bridge** (`src/store/plugin/plats/xhs`): Browser extension communication for Xiaohongshu data capture.
- **Metric events** (`libs/helpers/src/metric-event`): Predefined event constants for tracking.
- **BullMQ queues** (`libs/aitoearn-queue`): Async job processing with Redis.
