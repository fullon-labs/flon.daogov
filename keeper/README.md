# FLON DAO Governance Keeper

`flon-daogov-keeper` is a standalone TypeScript service that helps registered
BPs pull rewards they have not claimed. It scans claimable base/GAS ledgers and
submits `flon::claimrewards(caller, producer, max_steps)` once per eligible BP.
The caller is a dedicated Keeper account; funds always go directly to the BP.

It does **not** submit `flon::standbyproof`. Each Standby BP must run its own
authorized proof bot because that action requires the BP's authorization.

## Safety properties

- required, exact chain-ID allowlist;
- chain-head freshness and LIB checks before every state-changing action;
- dry-run mode by default (`KEEPER_BROADCAST=false`);
- reads claimable rows again on every cycle and never trusts a local balance;
- one bounded claim transaction per BP, followed by LIB confirmation;
- no blind immediate retry after an ambiguous broadcast result;
- adaptive 15/5/1-minute polling and exponential error backoff;
- process lock preventing duplicate local instances;
- JSON logs and `/healthz` plus `/status` endpoints.

## Run locally

```bash
cp keeper/.env.example keeper/.env
set -a
. keeper/.env
set +a
npm run keeper:build
npm run keeper:start
```

Start with `KEEPER_BROADCAST=false`. Verify the chain ID, claimable BP list,
head/LIB progression and logs. Only then enable broadcast mode.

## Container

```bash
docker build -f keeper/Dockerfile -t flon-daogov-keeper:local .
docker run --rm --env-file keeper/.env -p 8788:8788 \
  flon-daogov-keeper:local
```

Use separate containers, chain IDs and alert channels for testnet and mainnet.
For high availability, run one broadcaster and at least two independent dry-run
watchers. Do not run several broadcasters on the same schedule unless duplicate
transaction rejection and alert deduplication are explicitly handled.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `KEEPER_RPC_URL` | required | Trusted RPC base URL |
| `KEEPER_CHAIN_ID` | required | Exact 64-hex target chain ID |
| `KEEPER_BROADCAST` | `false` | Enable BP reward claim broadcasts |
| `KEEPER_SIGNER_ACTOR` | empty | Dedicated third-party caller account |
| `KEEPER_SIGNER_PERMISSION` | `active` | Permission linked only to `flon::claimrewards` |
| `KEEPER_PRIVATE_KEY_FILE` | empty | Mounted secret file containing the permission's private key |
| `KEEPER_MAX_STEPS` | `24` | Maximum hourly reward rows consumed per BP; contract maximum is 48 |
| `KEEPER_POLL_MS` | `3600000` | Full scan interval; one hour by default |
| `KEEPER_MAX_HEAD_AGE_MS` | `90000` | Maximum accepted chain-head age |
| `KEEPER_CONFIRMATION_TIMEOUT_MS` | `180000` | LIB confirmation timeout |
| `KEEPER_HEALTH_PORT` | `8788` | Health/status HTTP port |
| `KEEPER_LOCK_FILE` | `/tmp/flon-daogov-keeper.lock` | Single-instance lock path |

See [the operations guide](../docs/operations-guide.md) for the protocol-level
maintenance process, missed-epoch behavior and Standby proof responsibilities.
