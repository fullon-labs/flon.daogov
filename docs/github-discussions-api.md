# GitHub Discussions unified API

The DAO DApp must never receive a GitHub access token. It talks only to a same-origin community API, configured with `window.__DAO_GOV_CONFIG__.discussionApiUrl` (default: `/community-api`). The API authenticates users with GitHub OAuth, keeps the access token server-side, and uses GitHub Discussions on their behalf.

## Endpoints

- `GET /v1/session` returns the authenticated GitHub user.
- `GET /v1/discussions?network=testnet` returns `{ "items": [...] }`.
- `GET /v1/auth/github?return_to=<url>` starts OAuth and returns to the DApp.
- `POST /v1/discussions` accepts `{ "network", "title", "body", "proposal_id" }` and creates a Discussion for the authenticated user.

All requests use an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. Creation endpoints must enforce CSRF protection, per-user rate limits, repository/category allowlists, length limits, and audit logging. The API must never return GitHub tokens or installation credentials.

Production should expose this service behind the DApp origin (for example `/community-api`) to avoid third-party-cookie and CORS failures inside HuFu.

## Runtime configuration

The production service is implemented in `community-api/server.mjs` and deployed as the `community-api` service in `deploy/app-host/docker-compose.yml`. It reads credentials from Docker secrets; OAuth credentials must never be placed in the frontend config or image.

Required secret files on app-host:

- `/data/flon-daogov/secrets/github-oauth-client-id`
- `/data/flon-daogov/secrets/github-oauth-client-secret`
- `/data/flon-daogov/secrets/community-session-secret`

The registered OAuth callback is:

`https://daogov.flon.network/community-api/v1/auth/github/callback`

The session cookie is scoped to `.flon.network`, so an authorization completed on the main domain can also be used by `daogov-t.flon.network`. OAuth `return_to` values are restricted to the two configured DAO origins.

The service requests `read:user public_repo`. Tokens remain in server memory and are never returned to the browser. Restarting the API invalidates active sessions and requires users to sign in again.
