# Aurora Colony Pub Website

The main website for the Aurora Colony Pub.

## Deployments

| Resource             | Type         | Cloudflare Dashboard                                                                                                                                |
| -------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend site        | Pages        | [aurora-colony-pub-frontend](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/pages/view/aurora-colony-pub-frontend)                    |
| Facebook feed (read) | Worker       | [aurora-fb-feed-read](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/workers/services/view/aurora-fb-feed-read/production)            |
| Facebook feed (sync) | Worker       | [aurora-fb-feed-sync](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/workers/services/view/aurora-fb-feed-sync/production)            |
| Contact form         | Worker       | [aurora-contact](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/workers/services/view/aurora-contact/production)                      |
| CMS auth             | Worker       | [aurora-cms-auth](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/workers/services/view/aurora-cms-auth/production)                    |
| Shared storage       | KV Namespace | [aurora-colony-pub-kv](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/workers/kv/namespaces/8fed7593c2ac43debc5267788e2a5dd3/metrics) |

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
