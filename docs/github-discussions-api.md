# GitHub Discussions unified API

The DAO DApp must never receive a GitHub access token. It talks only to a same-origin community API, configured with `window.__DAO_GOV_CONFIG__.discussionApiUrl` (default: `/community-api`). The API publishes through a repository-scoped GitHub App owned by FullOn DAO; end users do not need GitHub accounts.

## Endpoints

- `GET /v1/session` reports DAO Bot mode availability.
- `GET /v1/discussions?network=testnet` returns `{ "items": [...] }`.
- `POST /v1/discussions` accepts `{ "network", "title", "body", "actor", "proposal_id" }` and creates a Discussion through the DAO Bot. `actor` is the connected FLON wallet account and is recorded in the Discussion body and audit log.

Creation endpoints enforce same-origin checks, per-account/IP rate limits, repository/category allowlists, length limits, and audit logging. The API never returns GitHub App or installation credentials.

Production should expose this service behind the DApp origin (for example `/community-api`) to avoid third-party-cookie and CORS failures inside HuFu.

## Runtime configuration

The production service is implemented in `community-api/server.mjs` and deployed as the `community-api` service in `deploy/app-host/docker-compose.yml`. It reads credentials from Docker secrets; OAuth credentials must never be placed in the frontend config or image.

Required secret files on app-host:

- `/path/to/private/app-id`
- `/path/to/private/installation-id`
- `/path/to/private/app-key.pem`

Install the GitHub App only on `fullon-labs/flon.daogov` with repository metadata read access and Discussions read/write access. The API signs a short-lived App JWT, exchanges it for a one-hour installation token, caches that token in memory, and refreshes it automatically. Users connect their FLON wallet, not GitHub.
