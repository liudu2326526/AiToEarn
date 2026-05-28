# Email Registration and Credits Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verified email-password registration and make credit deduction failures user-friendly without implementing self-serve recharge in this pass.

**Architecture:** Reuse the existing NestJS login controller, Redis mail-code flow, password hashing utility, Mongoose user repository, and `CreditsHelperService`. The frontend keeps email-password login as the only login method, adds a verified registration path, and maps insufficient-balance failures to an administrator-contact message.

**Tech Stack:** NestJS, Nx, pnpm, Mongoose, MongoDB, Redis, PBKDF2 password utility, Next.js App Router, Zustand, existing fetch/toast/i18n helpers.

**Local Ports:** Follow `AGENTS.md`: frontend `6061`, local API proxy `7001`, server `3002`, and AI service `3010`. The frontend should normally call the local API proxy at `7001`; `3002` is the underlying server process port.

---

## Confirmed Decisions

1. Do not implement user-facing recharge/payment in this iteration.
   - No payment provider integration.
   - No recharge order page.
   - No self-serve `points/recharge` flow.
   - When balance is insufficient, show: `余额不足，请联系管理员充值`.
   - English fallback: `Insufficient balance. Please contact an administrator to recharge.`

2. Email-password registration must verify the email address.
   - Current backend already has email-code login and auto-register through `POST /login/mail` + `POST /login/mail/verify`.
   - Current frontend login is email + password only.
   - Current backend password login exists, but password registration does not.
   - New password registration must send and verify a mail code before creating a user with `password` and `salt`.

## Current State

### Email Auth

- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/login.controller.ts`
  - `POST /login/mail` sends a login/register code and stores `userMailLogin:${mail}` in Redis.
  - `POST /login/mail/verify` verifies the code and auto-registers a mail-only user if needed.
  - `POST /login/password` logs in an existing user with email and password.
  - `POST /login/repassword/mail` and `PUT /login/repassword/mail` reset password through an email code.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/login.dto.ts`
  - Has DTOs for mail-code login, email-password login, and reset password.
  - Does not have a DTO for email-password registration.

- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/user.service.ts`
  - Has `createUserByMail(mail)`.
  - Has password update support.
  - Needs a safe registration path that creates a user with password and salt after code verification.

- `project/aitoearn-web/src/app/[lng]/auth/login/components/LoginContent/EmailLoginForm.tsx`
  - Shows email-password login.
  - Does not expose verified registration.

### Credits

- `project/aitoearn-backend/libs/mongodb/src/schemas/user.schema.ts`
  - Stores `creditsBalance`.
  - Also stores nested `credits.balance`, `credits.total`, and last operation metadata.

- `project/aitoearn-backend/libs/mongodb/src/repositories/user.repository.ts`
  - `getCreditsBalanceById`.
  - `incrementCreditsById`.
  - `deductCreditsById`, with atomic `creditsBalance >= amount` protection.

- `project/aitoearn-backend/libs/helpers/src/credits/credits-helper.service.ts`
  - `addCredits`.
  - `deductCredits`.
  - Currently throws `BadRequestException('Insufficient credits')` when deduction fails.

- `project/aitoearn-web/src/api/apiReq.ts`
  - Still exposes legacy `getPointsRecordsApi` and `rechargePointsApi`.
  - There is no confirmed backend route for a user-facing recharge flow.

## File Structure

Backend modify:

- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/login.dto.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/login.controller.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/user.service.ts`
- `project/aitoearn-backend/apps/aitoearn-server/src/core/user/login.controller.spec.ts`
- `project/aitoearn-backend/libs/mongodb/src/repositories/user.repository.ts`
- `project/aitoearn-backend/libs/helpers/src/credits/credits-helper.service.ts`
- `project/aitoearn-backend/apps/aitoearn-ai/src/core/credits/credits-helper.service.spec.ts`
- AI service call sites that can start provider work before balance is checked:
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/chat/chat.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/image/image.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/aideo/aideo.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/aideo/video-style-transfer.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/aideo/drama-recap.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/video/volcengine/volcengine.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/video/grok/grok.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/video/openai/openai.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/video/gemini/gemini.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/ai/video/dashscope/dashscope.service.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/mcp/volcengine/video-edit.mcp.ts`
  - `project/aitoearn-backend/apps/aitoearn-ai/src/core/agent/services/agent-runtime.service.ts`

Frontend create:

- `project/aitoearn-web/src/app/[lng]/auth/register/page.tsx`
- `project/aitoearn-web/src/app/[lng]/auth/register/components/RegisterContent.tsx`

Frontend modify:

- `project/aitoearn-web/src/api/auth.ts`
- `project/aitoearn-web/src/api/types/auth.ts`
- `project/aitoearn-web/src/app/[lng]/auth/login/components/LoginContent/EmailLoginForm.tsx`
- `project/aitoearn-web/src/app/i18n/locales/zh-CN/login.json`
- `project/aitoearn-web/src/app/i18n/locales/en/login.json`
- `project/aitoearn-web/src/app/i18n/locales/zh-CN/common.json`
- `project/aitoearn-web/src/app/i18n/locales/en/common.json`
- `project/aitoearn-web/src/store/user.ts`
- `project/aitoearn-web/src/utils/FetchService/FetchService.ts`
- `project/aitoearn-web/src/app/[lng]/draft-box/components/AiBatchGenerateBar/index.tsx`
- `project/aitoearn-web/src/app/[lng]/draft-box/components/AiBatchGenerateBar/ToolBarInline/index.tsx`
- `project/aitoearn-web/src/api/apiReq.ts`

## Task 1: Lock Auth Behavior With Tests

- [ ] Add or update backend tests for the new email-password registration contract.

Required cases:

- [ ] `POST /login/register/mail` sends a registration code for a valid email.
- [ ] `POST /login/register` rejects missing, expired, or incorrect code.
- [ ] `POST /login/register` rejects an active existing email.
- [ ] `POST /login/register` creates a user with `mail`, `password`, and `salt` after code verification.
- [ ] A newly registered user can log in through `POST /login/password`.
- [ ] Registration does not log the full verification code in production.

Expected backend behavior:

- Registering by password without email verification is not allowed.
- Code-login auto-registration can remain supported backend-side for compatibility, but the visible frontend login surface remains email + password only.

## Task 2: Implement Verified Email-Password Registration

- [ ] Add DTOs in `login.dto.ts`.

Required DTOs:

- `MailRegisterCodeDto`
  - `mail: string`

- `MailPasswordRegisterDto`
  - `mail: string`
  - `code: string`
  - `password: string`

Validation rules:

- `mail` must be a valid email.
- `code` must be a 6-digit string.
- `password` should have a minimum length of 8.

- [ ] Add `POST /login/register/mail`.

Implementation rules:

- Use a separate Redis key: `userMailRegister:${mail}`.
- TTL: 5 minutes.
- Rate limit by email, same or stricter than login code.
- If the email already belongs to an active user, return an account-exists error.
- Use existing mail sending infrastructure.

- [ ] Add `POST /login/register`.

Implementation rules:

- Validate `userMailRegister:${mail}`.
- Delete the Redis registration key after successful verification.
- Reject active duplicate email.
- Hash password through `encryptPassword`.
- Create the user with `password` and `salt`.
- Return the same token shape as `POST /login/password`:
  - `type`
  - `token`
  - `exp`
  - `userInfo`

- [ ] Add a safe user-service method.

Recommended method:

```ts
createUserByMailWithPassword(mail: string, password: string, salt: string)
```

Rules:

- Keep `createUserByMail(mail)` unchanged for existing email-code login behavior.
- Do not revive soft-deleted users implicitly unless the existing project rule already supports it.
- Do not make `mail` globally unique until duplicate historical data is audited.

## Task 3: Add Frontend Registration Flow

- [ ] Create `/[lng]/auth/register`.

Required fields:

- Email.
- Verification code.
- Password.
- Confirm password.
- Send code button.
- Register button.

- [ ] Add a register link from the login page.

Rules:

- Login page remains email + password only.
- Google, phone, and email-code login must not be reintroduced into the visible login UI.
- After successful registration, store token/user info using the existing auth store path and enter the app.

- [ ] Add frontend API wrappers.

Required APIs:

- `sendEmailRegisterCodeApi`.
- `emailPasswordRegisterApi`.

- [ ] Add i18n strings.

Chinese copy:

- `注册`
- `发送验证码`
- `邮箱验证码`
- `请输入至少 8 位密码`
- `两次输入的密码不一致`
- `邮箱已注册，请直接登录`

English copy:

- `Register`
- `Send code`
- `Email verification code`
- `Password must be at least 8 characters`
- `Passwords do not match`
- `This email is already registered. Please sign in.`

## Task 4: Enforce Credits Before Expensive Work

Current risk:

- Production AI code does not currently call `CreditsHelperService.getBalance` as a preflight guard. `getBalance` is only used in tests and the helper itself.
- Several AI/provider paths calculate cost or call `deductCredits` only after provider work has started or completed. For example, Volcengine video creates the upstream task before deducting credits.
- This can consume third-party quota first, then throw an insufficient-balance error when `deductCredits` runs.
- Treat every listed `deductCredits` call site as needing an ordering audit, not just a message change.

- [ ] Add a central insufficient-balance helper or exception mapping.

Recommended backend message:

```text
余额不足，请联系管理员充值
```

Recommended English fallback:

```text
Insufficient balance. Please contact an administrator to recharge.
```

- [ ] Update `CreditsHelperService.deductCredits`.

Rules:

- Keep atomic deduction through `UserRepository.deductCreditsById`.
- Use a stable message or error code for insufficient balance.
- Preserve current `NotFoundException('User not found')` behavior for missing users.

- [ ] Move or add balance preflight before provider calls that can spend third-party quota.

Priority call sites:

- Chat completions.
- Image generation.
- Seedance/Volcengine video generation.
- Grok video generation.
- OpenAI/Gemini/Dashscope video generation.
- Aideo generation, video style transfer, and drama recap.
- Volcengine MCP video edit.
- Agent runtime model/tool execution.

Rules:

- If a task has deterministic cost, check or reserve credits before creating the upstream provider task.
- If final cost can differ from the estimate, reserve the estimate first and settle/refund after completion.
- Do not create paid upstream tasks when the user is already below the required balance.

## Task 5: Remove User-Facing Recharge Assumptions

- [ ] Keep recharge out of product scope for this pass.

Rules:

- Do not add a recharge page.
- Do not add a payment order API.
- Do not add Stripe/PayPal/Alipay/WeChat Pay integration.
- Do not expose a user-facing `rechargePointsApi` flow.

- [ ] Clean frontend assumptions that imply self-serve recharge.

Actions:

- Delete unused `rechargePointsApi`; current frontend code only defines it and has no import/call sites.
- If a balance UI exists, show a static support message instead of a recharge button.
- On insufficient-balance errors, show `余额不足，请联系管理员充值`.

- [ ] Keep administrator top-up as an operational action.

Rules:

- This plan does not implement an admin recharge console.
- If operations need a top-up tool later, add a separate admin-only plan with authorization and audit logging.

## Task 6: Surface Balance Clearly In The Frontend

- [ ] Add `creditsBalance` to frontend user types if missing.

Rules:

- Preserve existing persisted auth fields.
- Do not persist stale legacy point fields.

- [ ] Refresh user info or balance after successful credit-consuming task creation.

Rules:

- If the API returns a new balance, update the store immediately.
- If not, fetch current user info after task creation.

- [ ] Normalize error handling in `FetchService`.

Rules:

- Network errors remain network errors.
- Insufficient-balance backend errors map to the administrator-contact message.
- Do not show a recharge CTA.

## Task 7: Verification

Backend verification:

```bash
cd project/aitoearn-backend
pnpm exec vitest apps/aitoearn-server/src/core/user/login.controller.spec.ts apps/aitoearn-ai/src/core/credits/credits-helper.service.spec.ts
pnpm exec nx build aitoearn-server
pnpm exec nx build aitoearn-ai
```

Frontend verification:

```bash
cd project/aitoearn-web
pnpm run type-check
pnpm build
```

Manual browser verification:

- [ ] Open `http://127.0.0.1:6061/zh-CN/auth/login`.
- [ ] Confirm visible login is email + password only.
- [ ] Open register page from login.
- [ ] Try registering without code; expect failure.
- [ ] Request register code; verify backend receives mail-code request.
- [ ] Register with a valid code; expect login token and app entry.
- [ ] Register same email again; expect duplicate-email failure.
- [ ] Set user balance below estimated generation cost.
- [ ] Trigger draft/image/video generation.
- [ ] Confirm UI shows `余额不足，请联系管理员充值`.
- [ ] Confirm no paid upstream provider task is created when balance is insufficient.

Docs-only verification for this plan:

```bash
git diff --check
```

## Acceptance Criteria

- [ ] Email-password registration exists and requires email-code verification.
- [ ] Email-password login continues to work for registered users.
- [ ] The visible login UI only exposes email + password login.
- [ ] No user-facing recharge/payment feature is added.
- [ ] Insufficient balance consistently tells users to contact an administrator.
- [ ] Paid AI/provider work does not start when the user already lacks enough balance.
- [ ] Frontend and backend tests cover registration and insufficient-balance behavior.
- [ ] `git diff --check` passes.
