# Post-Acceptance Steps

The steps that need to be completed if the owner of Aurora Colony Pub accepts the new system.

## 1. Update the GitHub action for lighthouse to make the prod URL auroracolonypub.com again

Update the GitHub action in 2 spots + the astro config

## 2. Migrate DNS from Wix to Cloudflare

Owner-coordinated. At **GoDaddy**, change `auroracolonypub.com` nameservers to the two Cloudflare assigns when the zone is added (free plan). Before flipping NS, audit Cloudflare's auto-imported records against Wix — keep Google `MX`, apex SPF TXT, and any Google site-verification TXT intact. Apex `A`/`CNAME` stays **DNS only** (gray cloud).

## 3. Finalize Resend sending domain

After step 2 is live (the domain is now pointing at the new site):

1. In [Resend](https://resend.com/domains/add/3b909ea5-d584-4197-892e-f479d76e1f1a), add domain `mail.auroracolonypub.com`. Paste the displayed records into Cloudflare DNS.
2. Wait for green checks.
3. In `workers/contact/wrangler.jsonc`, flip the two `vars`:
   - `FROM_EMAIL`: `Aurora Colony Pub <noreply@mail.auroracolonypub.com>`
   - `OWNER_EMAIL`: `corey@auroracolonypub.com`
4. `pnpm deploy:workers` to push the new values.
5. Submit a real test message through the contact form and confirm delivery to Corey's inbox.
