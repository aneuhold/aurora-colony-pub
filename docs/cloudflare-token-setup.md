# Cloudflare Token Setup

How to (re-)create the `CLOUDFLARE_API_TOKEN` and find the `CLOUDFLARE_ACCOUNT_ID` used by this repo.

## `CLOUDFLARE_ACCOUNT_ID`

1. Log in to https://dash.cloudflare.com.
2. Go to **Workers & Pages** (or pick any zone).
3. Copy the **Account ID** from the right-hand sidebar. It's also visible in the URL: `dash.cloudflare.com/<account-id>/...`.

## `CLOUDFLARE_API_TOKEN`

The current token name is `aurora-colony-pub-repo-token` as of 5/23/2026.

1. Go to https://dash.cloudflare.com/profile/api-tokens.
2. Click **Create Token** → **Create Custom Token**.
3. Configure the token as below, then **Create** and copy the token immediately (it's only shown once).

### Permissions

| Type    | Resource           | Access |
| ------- | ------------------ | ------ |
| Account | Workers Scripts    | Edit   |
| Account | Workers KV Storage | Edit   |
| Account | Cloudflare Pages   | Edit   |
| Account | Account Settings   | Read   |

> Zone permissions (e.g. `Workers Routes: Edit`) were **not** added — this repo doesn't bind custom routes.

### Account Resources

- **Include**: this specific account.

### Zone Resources

- Not configured.

## Where the values are used

- Local development: `.env` (gitignored) for `wrangler` commands.
- CI: GitHub Actions secrets.
