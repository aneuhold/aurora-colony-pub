# Contact Form Implementation Plan

## Context

The repo already documents a contact form flow in `docs/worker-details.md` and lists `aurora-contact` as a deployed Worker in the README. The scaffolding is in place — `workers/contact/` has the Sentry wrapper, `RATE_LIMITER` binding, and an `Env` interface with `TURNSTILE_SECRET` + `RESEND_API_KEY` placeholders — but the `fetch` handler is a stub, and the site has no contact page or form component yet.

This plan finishes the loop end-to-end:

1. A `ContactForm` Svelte 5 island (name / email / message + honeypot + Turnstile widget) embedded as a section on the home page.
2. The `aurora-contact` Worker that accepts the POST, runs cheap defenses first (honeypot → rate-limit → format validation), then verifies Turnstile, then delivers via Resend with the visitor's address in `Reply-To`.
3. The minimal external-account setup the user needs to perform (Resend signup, Turnstile site creation) and the `wrangler secret put` commands to wire it up.

No new abstractions, no new libraries beyond what's strictly needed (Turnstile is loaded via its public script tag — no wrapper package). The Worker stays single-file like its siblings.

---

## Phase 0 — Setup status (done)

- **Turnstile widget** `aurora-turnstile` exists. Sitekey `0x4AAAAAADVCwonowFDxQAhi` is hardcoded in the Svelte component (public by design).
- **Resend account** created (`agneuhold@gmail.com`). No sending domain yet — that's launch-time work, see [`post-acceptance-steps.md`](./post-acceptance-steps.md) §2–§3.
- **Worker secrets** `CLOUDFLARE_TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` already set in Cloudflare via `wrangler secret put`.

The form ships in its **interim** Resend configuration: sends from `onboarding@resend.dev` to `agneuhold@gmail.com` (Resend's shared host only delivers to the account owner's address). The launch-time swap to `mail.auroracolonypub.com` → `corey@auroracolonypub.com` is two `vars` value changes in `wrangler.jsonc` — documented in `post-acceptance-steps.md` §3.

---

## Phase 1 — Worker: implement the contact handler

All changes are in `workers/contact/`. The file structure stays as it is today (single `src/index.ts`); the cms-auth split into services is overkill here.

### 1.1 `workers/contact/wrangler.jsonc`
- Add `vars` entries. Initial values are the interim ones; the launch-time swap is in `post-acceptance-steps.md` §3.
  - `OWNER_EMAIL`: `agneuhold@gmail.com`
  - `FROM_EMAIL`: `Aurora Colony Pub <onboarding@resend.dev>`
  - `ALLOWED_ORIGIN`: comma-separated, e.g. `https://aurora-colony-pub-frontend.pages.dev,http://localhost:4321`
- Pin the local dev port: `"dev": { "port": 8787 }`. Matches the `globalConstants.contactWorkerUrl` dev branch.
- Update the existing comment block: rename the `TURNSTILE_SECRET` placeholder to `CLOUDFLARE_TURNSTILE_SECRET_KEY` and list the new `vars`.
- Leave `ratelimits` (5/60s, namespace 1003) and `compatibility_date` alone.

### 1.2 `workers/contact/src/index.ts`
Extend the existing handler. The shape stays identical to siblings — `Sentry.withSentry`, then `fetch` with the rate-limit-first pattern.

First, update the `Env` interface so the Turnstile secret field is named `CLOUDFLARE_TURNSTILE_SECRET_KEY` (the current placeholder is `TURNSTILE_SECRET`). Add `OWNER_EMAIL: string`, `FROM_EMAIL: string`, and `ALLOWED_ORIGIN: string` alongside the existing `RESEND_API_KEY` and `RATE_LIMITER` fields.

Handler logic, in this order so cheap checks bail before any network call:

1. **CORS preflight** — if `request.method === 'OPTIONS'`, return 204 with the CORS headers (origin from `ALLOWED_ORIGIN` allowlist; vary on Origin).
2. **Method check** — only `POST` is allowed; everything else returns 405.
3. **Origin check** — reject if `Origin` header is missing or not in `ALLOWED_ORIGIN`.
4. **Rate limit** — existing `env.RATE_LIMITER.limit({ key: ip })` block, unchanged.
5. **Parse JSON body** — wrap in try/catch; malformed body → 400.
6. **Honeypot check** — body has a `website` field; if non-empty, return 200 silently (don't tip off bots) but do *not* send mail.
7. **Format validation** — `name` (1–100 chars), `email` (RFC-ish regex, 5–254 chars), `message` (1–5000 chars), `turnstileToken` (non-empty string). Any miss → 400 with `{ field, error }` JSON.
8. **Turnstile verification** — `POST` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with `secret=env.CLOUDFLARE_TURNSTILE_SECRET_KEY`, `response=turnstileToken`, `remoteip=ip`. On `success === false` → 400.
9. **Send via Resend** — `POST https://api.resend.com/emails` with `Authorization: Bearer ${env.RESEND_API_KEY}`. Body:
   - `from`: `env.FROM_EMAIL`
   - `to`: `[env.OWNER_EMAIL]`
   - `reply_to`: the visitor's email
   - `subject`: `New contact form message from <name>`
   - `text` and `html`: plain-text fallback + a small HTML version including name, email, IP, message. Escape the HTML version.
   - Resend non-2xx → propagate a 502 (so the form shows a retry-friendly error). Sentry captures the rejection automatically via `withSentry`.
10. **Success** — return 200 with `{ ok: true }` and the CORS headers.

Keep everything in `index.ts`. Add small local helpers (`jsonResponse`, `corsHeaders(origin)`, `isAllowedOrigin`, `escapeHtml`) inline rather than a `services/` folder — there's not enough surface to justify the split yet.

### 1.3 `workers/contact/src/index.integration.test.ts`
Replace the placeholder with focused cases (real implementations via miniflare bindings, no `vi.mock` of business logic — only stub the external `fetch` to `siteverify` and `api.resend.com` using `vi.spyOn(globalThis, 'fetch')` since those are external HTTP calls):

- `OPTIONS` returns 204 + CORS headers.
- `GET` returns 405.
- POST with bad origin returns 403.
- POST with empty `website` honeypot filled returns 200 *without* calling Resend.
- POST with missing `email` returns 400.
- POST with valid body + Turnstile failure → 400.
- POST with valid body + Turnstile pass + Resend 200 → 200, asserts Resend payload (correct `reply_to`, subject contains name).
- POST with Resend 500 → 502.
- Provide `CLOUDFLARE_TURNSTILE_SECRET_KEY` / `RESEND_API_KEY` / `OWNER_EMAIL` / `FROM_EMAIL` / `ALLOWED_ORIGIN` via `bindings` in `vitest.config.ts` per the `WorkerVitestOptions` pattern in `workers/vitest.shared.ts`.

### 1.4 `workers/contact/vitest.config.ts`
Switch from the `export { default } from '../vitest.shared'` re-export to calling `createWorkerVitestConfig({ bindings: {...} })` so the test secrets above are injected. Matches the documented `WorkerVitestOptions` contract.

### 1.5 `workers/contact/src/index.e2e.test.ts`
Leave as-is for now (it hits the deployed URL; after first deploy + secret setup, the user can run `pnpm --filter @aurora/worker-contact test:e2e` to confirm). Add one assertion that an `OPTIONS` request returns 204 — sanity check that the deployed Worker is reachable.

---

## Phase 2 — Site: contact page + Svelte island

All changes under `site/`.

### 2.1 `site/src/util/globalConstants.ts` (new)
The worker URL isn't a secret — the browser sees it in DevTools the moment anyone submits the form — so there's no reason to route it through `.env` and GitHub Actions. Commit it instead.

- Create `site/src/util/globalConstants.ts` exporting a single `globalConstants` object. Use `import.meta.env.DEV` to switch between the local worker and the deployed worker so `pnpm dev` "just works" when the worker is also running locally:

  ```ts
  export const globalConstants = {
    contactWorkerUrl: import.meta.env.DEV
      ? 'http://localhost:8787'
      : 'https://aurora-contact.agneuhold.workers.dev'
  };
  ```

- Consumers import via the existing `$util/*` path alias (see `site/tsconfig.json`).
- The Turnstile sitekey stays hardcoded directly in the form component (§2.3) since it's only used in one place.

### 2.2 `site/src/pages/index.astro`
- Import `ContactForm` from `$components-svelte/ContactForm` (the new barrel — §2.3) and render `<ContactForm client:load />` as a new section after `<Gallery />`.
- Add `<script is:inline src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>` to the page so `window.turnstile` is available by the time the island hydrates. The island should still defensively check for `window.turnstile` before calling `render()` (poll briefly if not ready) since `async defer` doesn't guarantee load order vs. island hydration.

### 2.3 `site/src/components-svelte/ContactForm/` (new folder)
Mirrors the `components-astro/Gallery/` pattern:

```
ContactForm/
├── ContactForm.svelte
├── ContactForm.test.ts
└── index.ts          // export { default } from './ContactForm.svelte';
```

`ContactForm.svelte` — Svelte 5 with runes, following the `HelloIsland.svelte` style.

- `$state` for `name`, `email`, `message`, `website` (honeypot), `status` (`'idle' | 'submitting' | 'success' | 'error'`), `errorMessage`, `turnstileToken`.
- Declare the sitekey as a module-level constant at the top of the component: `const TURNSTILE_SITEKEY = '0x4AAAAAADVCwonowFDxQAhi';`.
- `$effect` (`$effect.root` if needed) on mount: call `window.turnstile.render(...)` into a `<div bind:this={turnstileEl} />`, passing `sitekey: TURNSTILE_SITEKEY`, `callback: (token) => turnstileToken = token`, and `'expired-callback'` / `'error-callback'` that clear the token. Tear down with `window.turnstile.remove(widgetId)` in the cleanup function.
- Submit handler:
  - `preventDefault`, set `status = 'submitting'`.
  - `fetch(globalConstants.contactWorkerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, message, website, turnstileToken }) })` — import from `$util/globalConstants`.
  - On 200 → success state, clear fields, reset Turnstile widget.
  - On 4xx → show the server's error message (or a generic one).
  - On 5xx → show a retry-friendly message.
- UI: native `<form>` + `<input>` / `<textarea>` styled with Tailwind utilities + the design tokens from `site/src/styles/global.css` (`bg-[color:var(--background)]`, `text-[color:var(--foreground)]`, `border-[color:var(--border)]`, primary button uses `--primary`). Honeypot field is a `<input type="text" name="website" tabindex="-1" autocomplete="off" class="absolute left-[-9999px]" />`. No UI library — matches the repo convention.
- Disable the submit button while `status === 'submitting'` or `turnstileToken === ''`.

### 2.4 `ContactForm.test.ts` (in the new folder)
Vitest + `@testing-library/svelte`, mirroring whatever pattern other Svelte tests use (or just establish a simple one):
- Renders all fields.
- Submit disabled until token present + required fields filled.
- Honeypot field is offscreen / has the right attributes.
- Submit calls `fetch` with the expected JSON shape; mock fetch with `vi.spyOn(globalThis, 'fetch')`.

> If no Svelte tests exist yet, keep this test small — one or two assertions — so it serves as an example without overreaching.

---

## Phase 3 — Documentation

### 3.1 `README.md`
- Under **Development**, add a short subsection "Contact form":
  - Worker URL lives in `site/src/util/globalConstants.ts` (auto-switches between local and deployed via `import.meta.env.DEV`). No `.env` setup needed for the site.
  - Note that the form runs in interim Resend mode (`onboarding@resend.dev` → `agneuhold@gmail.com`); launch swap lives in `docs/post-acceptance-steps.md`.

### 3.2 `docs/worker-details.md`
- No diagram changes — the sequence diagram already matches the implementation. Optionally add a short "Local dev" note: `pnpm dev` at the repo root spins up the site and all workers concurrently with pinned ports (see Phase 4).

---

## Phase 4 — Local dev wiring

So `pnpm dev` at the repo root starts the site **and** every worker in parallel, each on a pinned port. Avoids the multi-terminal dance and the "what port is that on again?" friction.

### 4.1 Pin a unique dev port in every worker's `wrangler.jsonc`
Add `"dev": { "port": <port> }` to each. Allocation:

| Worker                 | Port | File                                  |
| ---------------------- | ---- | ------------------------------------- |
| `aurora-contact`       | 8787 | `workers/contact/wrangler.jsonc` (§1.1) |
| `aurora-fb-feed-read`  | 8788 | `workers/fb-feed-read/wrangler.jsonc` |
| `aurora-fb-feed-sync`  | 8789 | `workers/fb-feed-sync/wrangler.jsonc` |
| `aurora-cms-auth`      | 8790 | `workers/cms-auth/wrangler.jsonc`     |

### 4.2 Root `package.json` — fan `dev` out to all packages
- Change the `dev` script to run the site and every worker in parallel:
  ```
  "dev": "pnpm -r --parallel --filter \"./site\" --filter \"./workers/*\" dev"
  ```
- Add `"dev:site": "pnpm --filter site dev"` as an escape hatch for when you don't need any worker.
- `fb-feed-sync`'s `dev` script is currently `wrangler dev --test-scheduled` — leave it alone; the `--test-scheduled` flag still works alongside the pinned port.

> Output is interleaved across processes, which is mildly noisy but tolerable. If it becomes an issue later, swap to `concurrently --names site,contact,fbr,fbs,cms ...` for prefixed lines.

---

## Verification

Run from the repo root after implementation:

1. `pnpm lint --fix` — repo lint passes.
2. `pnpm check` — TypeScript + Astro `astro check` pass (Worker `tsc --noEmit` runs via its own `check`).
3. `pnpm test` — site + Worker unit/integration tests pass.
4. `pnpm build` — full static + Worker dry-run build succeeds.
5. Local smoke test:
   - Pre-req: `workers/contact/.dev.vars` exists with `CLOUDFLARE_TURNSTILE_SECRET_KEY` and `RESEND_API_KEY` so the dev worker can call the real services.
   - `pnpm dev` at the repo root — site on `localhost:4321`, contact worker on `localhost:8787`, others on 8788–8790. `globalConstants` auto-routes to the local contact worker.
   - Open `http://localhost:4321/`, scroll to the contact form, submit a real message. Confirm:
     - Honeypot rejects silently when set.
     - Bad email shows inline 400 error.
     - Successful submit lands in `agneuhold@gmail.com` with `Reply-To` set.
     - Hammering submit hits 429 after 5 in 60s.
6. Deploy: `pnpm deploy:workers` then push to `main` to trigger Pages deploy. Re-run the smoke test against `https://aurora-colony-pub-frontend.pages.dev/`.
7. Optional: `pnpm --filter @aurora/worker-contact test:e2e` against the deployed Worker.

---

## Open items / call-outs

- **Sending domain.** Interim mode ships now (`onboarding@resend.dev` → `agneuhold@gmail.com`). Verified domain + cutover are in `post-acceptance-steps.md` §2–§3.
- **CMS-managed owner email.** Left out intentionally — it's a single value that changes ~never, and putting it in `wrangler.jsonc` `vars` keeps the worker self-contained. If the owner ever wants to change it without a redeploy, lift it into KV under a key like `contact:owner-email` later.
- **Spam logging.** Not adding KV-backed submission archival yet. Sentry will surface unexpected 5xx; legitimate submissions live in the owner's inbox. Add KV later only if abuse forensics become necessary.
- **Phone / address fields.** Not in scope per the docs — contact form is name / email / message only.
