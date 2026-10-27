# GitHub Discussions unified API

The DAO DApp must never receive a GitHub access token. It talks only to a same-origin community API, configured with `window.__DAO_GOV_CONFIG__.discussionApiUrl` (default: `/community-api`). The API authenticates users with GitHub OAuth, keeps the access token server-side, and uses GitHub Discussions on their behalf.

## Endpoints

- `GET /v1/session` returns the authenticated GitHub user.
- `GET /v1/discussions?network=testnet` returns `{ "items": [...] }`.
- `GET /v1/auth/github?return_to=<url>` starts OAuth and returns to the DApp.
- `POST /v1/discussions` accepts `{ "network", "title", "body", "proposal_id" }` and creates a Discussion for the authenticated user.

All requests use an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie. Creation endpoints must enforce CSRF protection, per-user rate limits, repository/category allowlists, length limits, and audit logging. The API must never return GitHub tokens or installation credentials.

Production should expose this service behind the DApp origin (for example `/community-api`) to avoid third-party-cookie and CORS failures inside HuFu.
