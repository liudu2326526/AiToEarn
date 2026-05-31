# AGENTS.md

This file provides guidance to Codex when working with code in this repository.

## Communication

- Reply in Simplified Chinese by default.

## Project Overview

AitoBee (formerly AiToEarn) — a social media content management platform supporting multi-platform publishing, AI-driven content generation, engagement automation, and a creator/advertiser task marketplace. Monorepo with a Next.js frontend and NestJS backend.

The historical `AiToEarn` name still appears in package names, repository paths, docs, and third-party platform copy. Do not bulk-rename it in unrelated changes.

## Repository Structure

```
project/
├── aitoearn-web/              # Next.js App Router frontend (local port 6061)
├── aitoearn-backend/          # Nx monorepo with NestJS apps + shared libs
│   ├── apps/
│   │   ├── aitoearn-server/   # Main API server (local port 3002)
│   │   └── aitoearn-ai/       # AI service (local port 3010)
│   └── libs/                  # Shared libraries
│       ├── channel-db/        # Mongoose schemas & repositories for channel domain
│       ├── mongodb/           # Core MongoDB (users, api-keys)
│       ├── helpers/           # Metric events, utilities
│       ├── aitoearn-auth/     # Auth module (JWT, guards)
│       ├── aitoearn-queue/    # BullMQ job queues
│       └── ...
├── aitoearn-extension/        # Browser extension and local publishing bridge code
│   ├── multipost-extension/   # Vendored MultiPost extension source
│   └── xhs-bridge/            # Local Xiaohongshu bridge (WebSocket on :9333)
└── aitoearn-electron/         # Electron desktop shell and related local app code
    ├── electron/              # Electron main/preload code
    ├── server/                # Desktop app local server pieces
    ├── src/                   # Renderer/source code
    └── scripts/               # Electron app scripts
```

## Commands

Use `pnpm` for both frontend and backend workspaces. The repository root does not have a unified package setup; do not run install/build commands from the root unless a root-level script is explicitly required.

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
pnpm nx serve aitoearn-server      # Dev server, usually proxied locally through :7001
pnpm nx run aitoearn-server:build  # Build
pnpm nx run aitoearn-server:test   # Run all tests (vitest)
pnpm exec vitest run <path>        # Run specific test file
pnpm run lint                      # Lint all projects
```

### Root

Avoid root package commands for normal verification. For local full-stack startup, prefer the repository scripts already used by this project, such as `./scripts/local-restart.sh --skip-build`.

## Architecture Patterns

### Backend

- **Module pattern**: Each domain is a NestJS module under `apps/aitoearn-server/src/core/`. Modules register in `app.module.ts`.
- **Schema/Repository pattern**: Mongoose schemas in `libs/channel-db/src/schemas/`, one file per collection. Schemas must be registered in `schemas/index.ts` `schemas` array. Repositories in `libs/channel-db/src/repositories/` extend a base repository.
- **Schema conventions**: All schemas extend `BaseTemp` (from `./time.tamp`), use `DEFAULT_SCHEMA_OPTIONS` from `channel-db.constants`, and set `collection` name explicitly.
- **Validation**: Zod (v4) and `createZodDto` for DTOs, not class-validator unless the existing module clearly already uses that style.
- **Package scope**: `@yikart/*` for all internal libs.
- **Async work**: Prefer the existing BullMQ/Redis queue integrations in `libs/aitoearn-queue`; do not add independent polling services unless there is a clear reason.

### Frontend

- **Next.js App Router** with `[lng]` dynamic segment for i18n routing.
- **State**: Zustand stores, typically co-located with page components.
- **API client**: Functions in `src/api/` using a custom `FetchService` wrapper (`src/utils/request.ts`). Pattern: `http.get<T>(path)` / `http.post<T>(path, data)`. Base URL from `NEXT_PUBLIC_API_URL`.
- **i18n**: `i18next` with locale files in `src/app/i18n/locales/{lang}/`. Type generation via `i18next-resources-for-ts`.
- **UI**: Ant Design + Radix UI + Tailwind CSS + Lucide icons.
- **AitoBee visual style**: Use a lightweight productivity-console look: light backgrounds, white or near-white translucent panels, subtle blue-gray borders, restrained shadows, compact spacing, and content-first hierarchy.
- **Surface treatment**: Prefer `bg-background/95`, `bg-white/90`, `rgba(255,255,255,0.9+)`, `border-border/70`, or `#e8edf5` style borders. Use 8-12px radius for panels/cards/modals and avoid heavy nested cards.
- **Controls**: Buttons and compact selectors should generally use translucent pill styling, light borders, small line icons, and soft shadows. Primary actions may use soft blue or solid blue only when they are the main decision action; destructive actions should be red but still visually restrained.
- **Tabs and navigation**: Prefer Ant Design line tabs with a blue underline for first-level navigation. Avoid adding secondary segmented controls when the item can be promoted to a first-level tab.
- **Switches and status**: Keep switch controls visually simple and translucent. Do not put long status text inside the switch; show status with nearby text or a small tag while the switch remains the binary control.
- **Content management pages**: Match the existing content-management/draft-detail style: left navigation plus a large work surface, translucent generation/tool panels, pill parameter chips, image-first draft cards, and focused modal detail views with a blurred overlay.
- **Path alias**: `@/*` maps to `./src/*`.
- **App Router query params**: If a page only branches by query params, prefer a client component with `useSearchParams()` instead of making a server page dynamic by accident.

### Conventions

- Package manager: **pnpm** (v10). No npm/yarn.
- Pre-commit hook: lint-staged runs ESLint on affected files via Nx.
- Commit messages: enforced by `git-commit-msg-linter`.
- Backend env config: `apps/aitoearn-server/src/config.ts`.
- Frontend env: `.env` / `NEXT_PUBLIC_*` vars.
- Documentation-only changes should run at least `git diff --check`.
- Do not write user-provided third-party keys into repository files. Use shell environment variables or private local config files for temporary verification, and avoid echoing full keys.

## Key Integration Points

- **Channel accounts** (`libs/channel-db`): Platform OAuth credentials and social accounts.
- **Publishing pipeline** (`core/channel/publishing`): Platform-specific publishers. The frontend publishing entry reuses `PublishDialog`.
- **XHS plugin bridge** (`src/store/plugin/plats/xhs`): Browser extension communication for Xiaohongshu data capture and publishing. When the plugin or bridge is missing, show setup guidance instead of a generic network error.
- **XHS publish-to-monitoring memory** (`docs/memory/xhs-publish-monitoring-pipeline.md`): Before making substantial changes to XHS publishing, MultiPost callbacks, `publish_record` result handling, work-data monitored-post backfill, or XHS data/comment collection, read this memory document. If the chain changes materially, update the document in the same change.
- **Engagement/interactions** (`core/channel/engagement`, `core/channel/interact`): Comments, AI replies, and related interaction flows.
- **Metric events** (`libs/helpers/src/metric-event`): Predefined event constants for tracking.
- **BullMQ queues** (`libs/aitoearn-queue`): Async job processing with Redis.

## Local Runtime

- "Local deployment" means non-Docker local deployment by default. Do not reintroduce Docker or Compose unless explicitly requested.
- Default local ports: frontend `6061`, backend server `3002`, AI service `3010`, local API proxy `7001`, XHS bridge `9333`.
- Local dependencies usually include MongoDB, Redis, and MinIO. Check processes, listening ports, logs, and key APIs when debugging runtime issues.
- Local file uploads and generated assets depend on object storage through `ASSETS_CONFIG`. With MinIO, confirm the bucket exists and `cdnEndpoint`/`publicEndpoint` are reachable by the backend.

## Documentation

- Public root README docs include `README.md`, `README_EN.md`, and `README_JA.md`. User-facing capability, installation, OpenClaw, MCP, Relay, API key, or environment URL changes should update all three by default.
- Docker deployment changes should check both `DOCKER_DEPLOYMENT_CN.md` and `DOCKER_DEPLOYMENT_EN.md`.
- Keep README changes minimal and practical. Do not paste large blocks from reference docs.
- User-facing README, skill, and capability reference docs should describe current capabilities and environment rules, not internal dev/test provenance.

## Environment Rules

- OpenClaw, MCP, and Relay must distinguish China and international environments: `*.aitoearn.cn` is China, and `*.aitoearn.ai` is international.
- China API keys only work with `aitoearn.cn` URLs; international API keys only work with `aitoearn.ai` URLs. Mixing environments and keys causes 401 errors.
- MCP examples should distinguish `https://aitoearn.cn/api/unified/mcp` and `https://aitoearn.ai/api/unified/mcp`; SSE examples follow the same split with `/api/unified/sse`.
- Relay examples should choose `RELAY_SERVER_URL` based on `RELAY_API_KEY` origin: China uses `https://aitoearn.cn/api`, international uses `https://aitoearn.ai/api`.

## AI Draft Generation

- `Generate Draft(Video)` goes through `aitoearn-ai` at `ai/draft-generation/v2`; it is not just frontend configuration.
- Debug draft generation failures across the frontend request, server proxy, AI service, Redis queue, MongoDB `AiLog`, and asset writes.
- Full video draft mode first calls the planning model to generate the video prompt, title, description, and topics. The default planning model comes from `config.ai.draftGeneration.planner.defaultModel` and usually requires `OPENAI_API_KEY` plus `OPENAI_BASE_URL`.
- Grok Video uses `grok-imagine-video` and requires `GROK_API_KEY`.
- Seedance uses Volcengine Ark models such as `doubao-seedance-2-0-260128` or `doubao-seedance-2-0-fast-260128`; the core requirement is `VOLCENGINE_API_KEY`.
- `VOLCENGINE_VOD_SPACE_NAME` and `VOLCENGINE_URL_AUTH_PRIMARY_KEY` mainly affect VOD upload, playback auth, Aideo, and video editing flows. Simple Seedance Ark generation usually does not depend on them.
- Draft-only generation does not require platform OAuth. OAuth `CLIENT_ID`/`CLIENT_SECRET` and account authorization are only required when actually publishing to social platforms.
