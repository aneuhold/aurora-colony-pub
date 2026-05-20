# Aurora Colony Pub Website

The main website for the Aurora Colony Pub.

## Infrastructure

- Focus is on incredibly performant frontend with outstanding SEO. So we use [Astro](https://astro.build/).
- Islands will use Svelte for the clean reactivity and compile-based output step. No shadow-DOM.
- For content that is dynamic, we use a backend of serverless functions. CloudFlare workers seems to be the plan. [Link to docs on the free-tier limits](https://developers.cloudflare.com/workers/platform/limits/). See [the details on the workers here](docs/worker-details.md).
- For persitent storage, CloudFlare KV is going to be used to keep things simple, and in-house. This could have been a different NoSQL DB provider though. [Link to the docs for the free-tier limits](https://developers.cloudflare.com/kv/platform/limits/).
- Transactional Email Service will be [Resend](https://resend.com/), so a lot of the hoops for email not being blocked by spam blockers can be jumped through more easily.

### Security

- Form security
  - Turnstile Captcha for blocking bots automatically
  - Hidden input honeypot field
  - Worker-side rate-limiting
  - Basic format validation

### Deployment

- Uses GitHub Actions for most of the build process to keep things centralized
