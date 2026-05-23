# Aurora Colony Pub Website

[![Live Site](https://img.shields.io/badge/Live%20Site-aurora--colony--pub-blue?style=for-the-badge&logo=cloudflare&logoColor=white)](https://aurora-colony-pub-frontend.pages.dev/)
[![Admin](https://img.shields.io/badge/Admin-Sveltia%20CMS-purple?style=for-the-badge)](https://aurora-colony-pub-frontend.pages.dev/admin)

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
- For the CMS, [Sveltia](https://sveltiacms.app/en/) seemed to be the best choice because we don't need a full editable UI, and just need targeted fields to be edited + images uploaded / removed. [Link to the Aurora Colony Pub CMS OAuth App settings in GitHub](https://github.com/settings/applications/3619717).

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
- Assets are stored in `site/src/assets` so that Astro can optimize them at build time.

### Deployment

- Uses GitHub Actions for most of the build process to keep things centralized
- The token used for the GitHub actions as far as CloudFlare is described [here](docs/cloudflare-token-setup.md).

## Development

1. Install everything with `pnpm i`
1. Checkout the [root package.json](package.json) for the commands.

### Sveltia CMS Development

1. Run `pnpm dev` like normal
2. Navigate to http://localhost:4321/admin and select local mode. It will ask you to choose the repository, so choose the `aurora-colony-pub` folder, not the site folder.
3. Make updates to see them make changes locally to the code. It works best with text updates. But you can add images. Just need to stop then start the dev server for that to work right because Astro needs to optimize them.

When changing the content model itself — adding, updating, renaming, moving, or removing a collection or its fields — use the [`cms-content`](.claude/skills/cms-content/SKILL.md) skill (`/cms-content <what to change>` in Claude Code). It walks through the paired Sveltia + Astro edits so neither side falls out of sync.
