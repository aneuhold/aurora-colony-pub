# Aurora Colony Pub Website

The main website for the Aurora Colony Pub.

## Infrastructure

- Focus is on incredibly performant frontend with outstanding SEO. So we use [Astro](https://astro.build/).
- Islands will use Svelte for the clean reactivity and compile-based output step. No shadow-DOM.
- For content that is dynamic, we use a backend of serverless functions. CloudFlare workers seems to be the plan. [Link to docs on the free-tier limits](https://developers.cloudflare.com/workers/platform/limits/). See [the details on the workers here](docs/worker-details.md).
- For persistent storage, CloudFlare KV is going to be used to keep things simple, and in-house. This could have been a different NoSQL DB provider though. [Link to the docs for the free-tier limits](https://developers.cloudflare.com/kv/platform/limits/).
- Transactional Email Service will be [Resend](https://resend.com/), so a lot of the hoops for email not being blocked by spam blockers can be jumped through more easily.
- For the CMS, [Sveltia](https://sveltiacms.app/en/) is going to be tried first, but that isn't set in stone.

### Security

- Form security
  - Turnstile Captcha for blocking bots automatically
  - Hidden input honeypot field
  - Worker-side rate-limiting
  - Basic format validation
- General worker security
  - Rate limits are applied, which is a built-in feature of CF workers, [link to docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/). See the code for the workers in the `wrangler.jsonc` file for each worker's current rate limits.

### Assets

- If size becomes an issue, then it can be investigated. But for now, it seems committing right to the repo is fine.

### Deployment

- Uses GitHub Actions for most of the build process to keep things centralized
- The token used for the GitHub actions as far as CloudFlare is described [here](docs/cloudflare-token-setup.md).

## Development

1. Install everything with `pnpm i`
1. Checkout the [root package.json](package.json) for the commands.
