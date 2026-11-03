# EVE Industry

An EVE Online dashboard with server status, PLEX prices, multi-character assets,
and a ship fitting workbench. Industry and planetary industry tracking are planned.

The pages use plain HTML/CSS/JavaScript. Vercel Node.js functions handle EVE login,
sessions, token renewal, and private asset requests. Public dashboard and fitting
requests still go directly to ESI from the browser.

## Deploying the server login

1. Create a persistent **Upstash Redis** database. Copy its REST URL and REST token
   from the database console. Use a database with eviction disabled so live
   sessions are not evicted when storage fills up.
2. In your EVE developer application's settings, register this callback URL exactly:

   ```text
   https://eveindustry.vercel.app/api/auth/callback
   ```

   Ensure the application allows the `esi-assets.read_assets.v1` scope.
3. In Vercel's project settings, add these environment variables for Production:

   | Variable | Value |
   | --- | --- |
   | `APP_URL` | `https://eveindustry.vercel.app` |
   | `EVE_CLIENT_ID` | Your EVE application client ID (the existing ID is in `.env.example`) |
   | `EVE_CLIENT_SECRET` | Your EVE application secret |
   | `SESSION_SECRET` | A newly generated random secret, at least 32 characters |
   | `UPSTASH_REDIS_REST_URL` | The database's HTTPS REST URL |
   | `UPSTASH_REDIS_REST_TOKEN` | The database's REST token with read/write access |

   Generate `SESSION_SECRET` locally with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Keep secrets in Vercel settings or an ignored `.env.local` file, never in Git.
4. Deploy this repository through the existing GitHub/Vercel connection. Vercel
   installs the `jose` dependency from the lockfile. Use the **Other** framework
   preset with no build command; the static HTML files remain at the project root.
   Keep Vercel's Node.js runtime on a supported LTS version, at least Node 22.
5. Open the website and use **+ Add Character**. Characters linked through the old
   browser implementation must be linked again. Existing browser-stored EVE tokens
   are removed automatically when either page loads.

Environment changes require a new Vercel deployment. Until configuration is complete,
the character API returns a configuration error; the public dashboard and fitting
workbench continue to work.

For a preview or local deployment, set `APP_URL` to that deployment's origin and
register its `/api/auth/callback` URL with EVE as well. Use separate environment
secrets and Redis databases for development and production. A plain static file
server cannot run the API functions; use Vercel's development tooling for local
end-to-end testing.

## How private data flows

```text
Browser -> /api/auth/login -> EVE SSO -> /api/auth/callback
Browser <- opaque HttpOnly session cookie
Browser -> /api/assets -> server refreshes EVE token if needed -> ESI
Browser <- item names and quantities
```

- Login uses a one-use state value and PKCE. The server verifies EVE's JWT
  signature, issuer, audiences, expiry, character ID, and asset scope.
- Access and refresh tokens are encrypted with AES-256-GCM before storage in Redis.
  The browser receives an opaque session identifier, never EVE tokens.
- Sessions expire after 30 days. Clearing cookies or signing out requires relinking.
  This release groups alts within a browser session; cross-device accounts and saved
  fits are not implemented.
- Private endpoints require a linked session. Mutations also check the request's
  origin. Character IDs alone do not grant access to another user's inventory.
- Asset retrieval follows every ESI page and combines quantities by item type,
  without the old 50-type limit. A page failure produces an error instead of
  incomplete totals. This is a quantity summary, not a station/location breakdown.
- Encrypted asset caches belong to one session and expire according to ESI's
  `Expires` header. Private HTTP responses use `Cache-Control: private, no-store`.
- Distributed locks serialize character changes and refreshes. Refreshed credentials
  cannot overwrite a newer session after the lock expires.
- Removing a character deletes its stored tokens from this session. Signing out
  invalidates the server session. This does not revoke the application's EVE grant;
  grants can be revoked separately through EVE's authorized applications page.
- Changing `SESSION_SECRET` makes existing encrypted sessions unreadable; keep it
  stable between deployments. Redis records expire automatically.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/status` | Existing backend health check |
| `GET /api/auth/login` | Start EVE login or link another alt |
| `GET /api/auth/callback` | Validate login and save credentials on the server |
| `POST /api/auth/logout` | Invalidate the current session |
| `GET /api/characters` | Return linked character IDs and names only |
| `DELETE /api/characters?id=123` | Unlink a character from the current session |
| `GET /api/assets` | Combined assets for all linked characters |
| `GET /api/assets?character=123` | Assets for one linked character |

## Checks

```sh
npm ci
npm test
npm run check
```

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`.
The tests use simulated Redis, EVE SSO, and ESI responses, with real JWT signing
and verification. They do not require credentials or call the live services.

Authentication follows [EVE's SSO documentation](https://developers.eveonline.com/docs/services/sso/).
Asset loading follows [ESI pagination](https://developers.eveonline.com/docs/services/esi/pagination/x-pages/)
and [cache guidance](https://developers.eveonline.com/docs/services/esi/best-practices/).
Database access uses the [Upstash Redis REST API](https://upstash.com/docs/redis/features/restapi).
