# FLON DAO Governance Keeper

`flon-daogov-keeper` is a standalone TypeScript service that monitors and closes
the six-hour producer reward epochs. It submits only the permissionless
`flon::closeepoch` action and never loads a wallet or private key.

It does **not** submit `flon::standbyproof`. Each Standby BP must run its own
authorized proof bot because that action requires the BP's authorization.

## Safety properties

- required, exact chain-ID allowlist;
- chain-head freshness and LIB checks before every state-changing action;
- dry-run mode by default (`KEEPER_BROADCAST=false`);
- a fresh `rewardepoch` read immediately before broadcasting;
- one epoch per transaction, strictly sequential catch-up;
- waits for LIB and verifies `next_epoch_to_close + 1` before continuing;
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

Start with `KEEPER_BROADCAST=false`. Verify the chain ID, current epoch,
`next_epoch_to_close`, head/LIB progression, boundary prediction and logs. Only
then change the deployment configuration to `KEEPER_BROADCAST=true`.

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
| `KEEPER_BROADCAST` | `false` | Enable `closeepoch` broadcasts |
| `KEEPER_EPOCH_MS` | `21600000` | Six-hour reward epoch; override only for a chain configured differently |
| `KEEPER_MAX_HEAD_AGE_MS` | `90000` | Maximum accepted chain-head age |
| `KEEPER_MAX_CATCHUP_PER_CYCLE` | `16` | Safety cap before yielding to the next loop |
| `KEEPER_CONFIRMATION_TIMEOUT_MS` | `180000` | LIB confirmation timeout |
| `KEEPER_HEALTH_PORT` | `8788` | Health/status HTTP port |
| `KEEPER_LOCK_FILE` | `/tmp/flon-daogov-keeper.lock` | Single-instance lock path |

See [the operations guide](../docs/operations-guide.md) for the protocol-level
maintenance process, missed-epoch behavior and Standby proof responsibilities.
