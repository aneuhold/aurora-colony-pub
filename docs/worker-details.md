# CloudFlare Worker Details

This lists out the sequence diagrams and process flows for each worker

## Facebook Feed Workers (2 Workers)

The feed is served via a two-pipeline design so visitors never wait on Facebook and we stay well inside free-tier limits.

**Worker 1: Read path** (every page view):

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Worker as CF Worker (read path)
    participant KV as Cloudflare KV

    User->>Browser: visits page
    Browser->>Browser: check cache (2min TTL)
    alt Cache fresh
        Browser-->>User: render feed
    else Cache stale or missing
        Browser->>Worker: GET /api/fb-feed
        Worker->>KV: read feed
        KV-->>Worker: feed JSON
        Worker-->>Browser: JSON + Cache-Control: max-age=120
        Browser-->>User: render feed
    end
```

**Worker 2: Sync path** (independent, refreshes KV):

```mermaid
sequenceDiagram
    participant Trigger as Cron Trigger / Manual button
    participant Worker as CF Worker (sync path)
    participant FB as Facebook Graph API
    participant KV as Cloudflare KV

    Trigger->>Worker: every 30 min, or authed manual call
    Worker->>FB: fetch latest posts
    FB-->>Worker: feed JSON
    Worker->>KV: write feed
```

- **Read path** never calls Facebook — it only reads from KV.
- **Sync path** is the only thing that talks to Facebook. Cron fires every 30 minutes; a protected manual endpoint lets us force a refresh ahead of demos or right after a new post.
- Browser cache + KV together mean Facebook is called at most ~48 times/day from cron, plus the occasional manual sync.

## Form Worker (1 Worker)

A single Worker handles contact form submissions. Defenses run cheapest-first so obvious garbage bails out before any network calls.

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Worker as CF Worker (contact)
    participant Turnstile as Turnstile Verify API
    participant Resend as Resend API

    User->>Browser: fills out form, clicks submit
    Browser->>Worker: POST /api/contact (fields + Turnstile token)
    Worker->>Worker: honeypot empty? rate-limit OK? format valid?
    alt Local checks fail
        Worker-->>Browser: 4xx
        Browser-->>User: show error
    else Local checks pass
        Worker->>Turnstile: verify token (server-side secret)
        Turnstile-->>Worker: pass / fail
        alt Turnstile fails
            Worker-->>Browser: 4xx
            Browser-->>User: show error
        else Turnstile passes
            Worker->>Resend: send email to owner
            Resend-->>Worker: 200 OK
            Worker-->>Browser: 200 OK
            Browser-->>User: show confirmation
        end
    end
```

- Local checks (honeypot, rate-limit, format validation) run first so garbage requests never trigger an outbound API call.
- Turnstile verification uses the secret key server-side. Only the public sitekey is ever exposed in the browser.
- Resend handles email delivery to the owner. The customer's address goes in `Reply-To` so the owner can respond directly from their inbox.
- If Resend returns a 5xx (rare), the Worker propagates a 5xx so the form can surface a retry-friendly error to the user.

## CMS Auth Worker (1 Worker)

A drop-in deployment of [`sveltia/sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) that completes the GitHub OAuth handshake for the Sveltia CMS admin UI. The client secret can't live in the browser, so this Worker is the server-side half of the [authorization code flow](https://sveltiacms.app/en/docs/backends/github#authorization-code-flow).

```mermaid
sequenceDiagram
    actor Editor
    participant Browser as Browser (Sveltia CMS)
    participant Worker as CF Worker (auth)
    participant GitHub as GitHub OAuth

    Editor->>Browser: click "Login with GitHub"
    Browser->>Worker: GET /auth (opens popup)
    Worker->>GitHub: redirect to authorize URL (client_id, scope)
    GitHub->>Editor: prompt to authorize
    Editor->>GitHub: approve
    GitHub->>Worker: GET /callback?code=...
    Worker->>GitHub: POST /access_token (code + client_secret)
    GitHub-->>Worker: access_token
    Worker-->>Browser: postMessage(token) to opener
    Browser->>Browser: store token, close popup
    Browser-->>Editor: CMS loaded, talking to GitHub directly
```

- Only runs during login, so it sits well inside free-tier limits.
- After login the browser talks straight to the GitHub API with the token — the Worker is not in the read/write path for CMS content.
- The GitHub OAuth App's client secret lives only in the Worker's environment, never in the static site bundle.
