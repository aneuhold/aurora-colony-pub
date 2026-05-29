# Facebook Page Access Token — Setup Runbook

How the non-expiring Page Access Token for the Aurora Colony Pub feed was
obtained, start to finish. Written so this can be re-done from scratch (e.g.
the token gets invalidated and we need to re-mint it).

**Key facts that make the rest make sense:**

- We use the **Business Portfolio → System User** path because it yields a
  Page Access Token that **does not expire by time** — unlike a user token
  exchange, which breaks when the user changes their FB password, loses Page
  admin, etc.
- There are **two different tokens** in play. The System User token is what
  you generate in the console; you then use it to **mint the Page Access
  Token**. The Page token is the one the worker actually uses. Confusing
  these two is the #1 gotcha (see step 6).

---

## 1. Get shared access to the pub's Page

The pub owns its Facebook Page in their own Business Portfolio. We requested
**shared access** to it from our (freelance) portfolio.

- Shared-access request sent; the pub's portfolio admin must approve it.
- Request status:
  <https://business.facebook.com/latest/settings/pages/?business_id=1592741911818216&selected_asset_id=465497836965753&selected_asset_type=page>
- Once approved, the Page appears under **Business Settings → Accounts →
  Pages** with the granted access level.
- **Do not proceed past this step until approval lands** — the System User
  cannot see the Page otherwise.

The pub's Page ID is **`465497836965753`** (also visible as
`selected_asset_id` in the URL above, and in the Page's About section). It's
public, so it lives as a code constant (`fbFeedSyncConstants.pageId`), not a
secret.

## 2. Create a Meta developer app

[docs](https://developers.facebook.com/docs/development/create-an-app/)

- <https://developers.facebook.com/apps> → **Create App**.
- **Use case**: pick **"Manage everything on your Page"**. That bundle ships
  `pages_show_list`, `pages_manage_engagement`, `pages_read_engagement`, and
  `business_management` — enough to call `GET /{page-id}/posts`.
  ([use-case mapping](https://developers.facebook.com/docs/development/create-an-app/use-cases-permission-mapping/),
  [permission reference](https://developers.facebook.com/docs/permissions/))
- **Business Portfolio**: connect the app to the freelance portfolio.

## 3. Create a System User

[docs](https://developers.facebook.com/docs/business-management-apis/system-users/)

- **Business Settings → Users → System Users → Add.** Type: **Admin**.
- **Naming gotcha:** Facebook rejects System User names containing reserved
  words — `Admin`, `Facebook`, `Meta`, `Instagram`, `FB`, `Page`, etc. —
  with *"You choose an invalid System User name."* A plain name like
  **`Aurora Colony Pub Sync`** works. The name is just a label; it isn't
  referenced anywhere in code.
- **Add Assets → Pages →** select the pub's Page → grant content/management
  access. (Without this asset assignment the System User can't mint a Page
  token.)

## 4. Generate the System User token

[docs](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/)

- On the System User: **Generate New Token** → pick the app from step 2.
- Select scopes **`pages_show_list`** + **`pages_read_engagement`**.
- **Leave "Set token expiration" OFF** so it's non-expiring (the alternative
  is a 60-day expiring token — we don't want that).
- **Copy the token now — it's only shown once.** This is the *System User
  token*, the input to step 6, **not** the token the worker uses.

## 5. (If needed) Access-level / verification check

[Standard vs Advanced Access](https://developers.facebook.com/docs/graph-api/overview/access-levels/)

- If the smoke test in step 7 returns posts, **Standard Access is enough**;
  the app can stay in development mode forever (server-to-server calls from
  the Worker don't need it Live). Skip the dashboard's "Business
  verification" and "Publish your app" checklist items.
- If you instead get `(#10)` / `(#200)` / "requires Advanced Access", run
  [Business Verification](https://developers.facebook.com/docs/development/release/business-verification/).
  Since the Page is *shared into* our portfolio rather than owned by it,
  Standard Access is the expected path.

## 6. Mint the Page Access Token from the System User token

**This is the step that's easy to miss.** Calling `/{page-id}/posts` with
the System User token directly fails under Meta's "new Pages experience":

```
{"error":{"message":"Invalid OAuth 2.0 Access Token","type":"OAuthException",
"code":190,"error_subcode":2069032,
"error_user_title":"User Access Token Is Not Supported",
"error_user_msg":"A Page access token is required for this call for the new
Pages experience."}}
```

The System User token is a *user-type* token. Use it to ask the Graph API
for the **Page's own** token:

```bash
curl "https://graph.facebook.com/v21.0/465497836965753?fields=access_token&access_token={SYSTEM_USER_TOKEN}"
```

Response:

```json
{ "access_token": "EAA...", "id": "465497836965753" }
```

That `access_token` is the **Page Access Token**. Because it's derived from
a System User token, it's also **non-expiring**. This is the value that goes
into `FB_PAGE_ACCESS_TOKEN`.

If the response has no `access_token` field, re-check:
- The shared-access approval from step 1 actually landed.
- The System User is assigned to the Page asset with a content/management
  task (step 3).
- The generated token's scopes include `pages_read_engagement` (step 4).

## 7. Smoke-test the Page token

```bash
curl "https://graph.facebook.com/v21.0/465497836965753/posts?fields=id,message,permalink_url&limit=1&access_token={PAGE_TOKEN}"
```

Posts come back → you're done. This is the token to wire into secrets.

## 8. Wire the token into the worker

Sync worker only — the read worker never talks to Facebook.

```bash
pnpm --filter ./workers/fb-feed-sync exec wrangler secret put FB_PAGE_ACCESS_TOKEN
```

- Local dev: add `FB_PAGE_ACCESS_TOKEN` to the repo-root `.env` so
  `wrangler dev --env-file ../../.env` picks it up (same pattern as
  `FB_MANUAL_SYNC_TOKEN`).
- The Page ID is **not** a secret — it's the `pageId` constant in
  `fbFeedSyncConstants.ts`.

## Token summary

| Token | Type | Where it comes from | Where it lives |
|---|---|---|---|
| System User token | User-type | Generated in step 4 | Nowhere in code — only used to mint the Page token in step 6. Keep it somewhere safe in case you need to re-mint. |
| **Page Access Token** | Page | Minted in step 6 | `FB_PAGE_ACCESS_TOKEN` secret + local `.env` |
| `FB_MANUAL_SYNC_TOKEN` | App-internal | Random string *you* generate (`openssl rand -hex 32`) | `FB_MANUAL_SYNC_TOKEN` secret + local `.env` — gates the worker's manual-trigger HTTP endpoint; unrelated to Facebook |

## If the token ever breaks

System User tokens don't expire by time, but they can still be invalidated —
Page admin role removed, password reset on an account tied to the System
User, scope revocation, or Meta security intervention
([reference](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/debugging-and-error-handling)).

When that happens the sync worker starts returning 5xx, Sentry catches it,
and we re-mint: redo step 6 (and step 4 first if the System User token itself
was invalidated). No auto-refresh is built.
