# Aurora Colony Pub Website

The main website for the Aurora Colony Pub.

## Infrastructure

- Focus is on incredibly performant frontend with outstanding SEO. So we use [Astro](https://astro.build/).
- Islands will use Svelte for the clean reactivity and compile-based output step. No shadow-DOM.
- For content that is dynamic, we use a backend of serverless functions. CloudFlare workers seems to be the plan. [Link to docs on the free-tier limits](https://developers.cloudflare.com/workers/platform/limits/).

### Facebook Feed Pipeline

The feed is served via a two-pipeline design so visitors never wait on Facebook and we stay well inside free-tier limits.

**Read path** (every page view):

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

**Sync path** (independent, refreshes KV):

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

### Deployment

- Uses GitHub Actions for most of the build process to keep things centralized
