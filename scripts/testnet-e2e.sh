#!/usr/bin/env bash
set -Eeuo pipefail

readonly TESTNET_CHAIN_ID="18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RPC_URL="${RPC_URL:-https://t4.flon.network}"
PUSH_RPC_URL="${PUSH_RPC_URL:-$RPC_URL}"
EXPECTED_CHAIN_ID="${EXPECTED_CHAIN_ID:-$TESTNET_CHAIN_ID}"
FUWAL_CONTAINER="${FUWAL_CONTAINER:-fuwal}"
WALLET_URL="${WALLET_URL:-unix:///tmp/fuwal.sock}"
WALLET_NAME="${WALLET_NAME:-flontest}"
COMMAND="${1:-help}"; [[ $# -eq 0 ]] || shift
BROADCAST=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --broadcast) BROADCAST=true ;;
    --env) [[ $# -ge 2 ]] || { echo "--env requires a file" >&2; exit 2; }; source "$2"; shift ;;
    -h|--help) COMMAND=help ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

RUN_ID="${RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
EVIDENCE_DIR="${EVIDENCE_DIR:-$REPO_DIR/artifacts/testnet-e2e/$RUN_ID}"
mkdir -p "$EVIDENCE_DIR"
log() { printf '[%s] %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$EVIDENCE_DIR/run.log"; }
die() { log "ERROR: $*"; exit 1; }
need() { local n="$1"; [[ -n "${!n:-}" ]] || die "$n is required"; }
rpc() {
  curl --fail --silent --show-error --connect-timeout 5 --max-time 20 \
    --retry 2 --retry-delay 1 "$RPC_URL$1" \
    -H 'content-type: application/json' --data "$2"
}
cli() { docker exec "$FUWAL_CONTAINER" fucli --wallet-url "$WALLET_URL" --no-auto-wallet -u "$PUSH_RPC_URL" "$@"; }
rows() {
  rpc /v1/chain/get_table_rows "$(jq -cn --arg c "$1" --arg s "$2" --arg t "$3" \
    '{json:true,code:$c,scope:$s,table:$t,limit:1000}')"
}

guard_testnet() {
  [[ "$EXPECTED_CHAIN_ID" == "$TESTNET_CHAIN_ID" ]] || die "EXPECTED_CHAIN_ID was changed"
  local info chain
  info="$(rpc /v1/chain/get_info '{}')" || die "RPC unavailable: $RPC_URL"
  chain="$(jq -r .chain_id <<<"$info")"
  [[ "$chain" == "$TESTNET_CHAIN_ID" ]] || die "refusing non-testnet chain $chain"
  jq . <<<"$info" > "$EVIDENCE_DIR/get_info.json"
  log "Testnet guard passed at block $(jq -r .head_block_num <<<"$info")"
}

guard_wallet() {
  local wallets
  wallets="$(cli wallet list)" || die "local fuwal unavailable"
  grep -Fq "\"$WALLET_NAME *\"" <<<"$wallets" || die "wallet $WALLET_NAME is not unlocked"
  printf '%s\n' "$wallets" > "$EVIDENCE_DIR/wallet-list.txt"
}

write_guard() {
  [[ "$BROADCAST" == true ]] || die "write command requires --broadcast"
  [[ "${TESTNET_MUTATION_ACK:-}" == "I_UNDERSTAND_TESTNET_STATE_WILL_CHANGE" ]] || \
    die "set TESTNET_MUTATION_ACK=I_UNDERSTAND_TESTNET_STATE_WILL_CHANGE"
  guard_wallet
}

push() {
  local contract="$1" action="$2" data="$3" auth="$4" result file
  write_guard; file="$(tr . _ <<<"$contract")-$action"
  log "Push $contract::$action as $auth"
  result="$(cli push action "$contract" "$action" "$data" -p "$auth" -j 2>&1)" || {
    printf '%s\n' "$result" | tee "$EVIDENCE_DIR/$file-error.txt" >&2; return 1;
  }
  if ! jq -e '(.processed.except == null) and (.processed.error_code == null)' <<<"$result" >/dev/null 2>&1; then
    printf '%s\n' "$result" | tee "$EVIDENCE_DIR/$file-error.json" >&2
    log "Chain rejected $contract::$action"
    return 1
  fi
  printf '%s\n' "$result" | tee "$EVIDENCE_DIR/$file.json"
  jq -r '.transaction_id // empty' <<<"$result" | tee -a "$EVIDENCE_DIR/transactions.txt"
}

snapshot() {
  local spec code scope table
  for spec in \
    'flon flon bpstakecfg' 'flon flon electconfig' 'flon flon producers' \
    'flon flon voters' 'flon flon pendingvote' 'flon flon voteallocs' \
    'dao.gov dao.gov global' 'dao.gov dao.gov config' 'dao.gov dao.gov allowlist' \
    'dao.gov dao.gov riskconfigs' 'dao.gov dao.gov actpolicies' 'dao.gov dao.gov proposals' \
    'dao.treasury dao.treasury assets' 'dao.treasury dao.treasury grants'; do
    read -r code scope table <<<"$spec"
    rows "$code" "$scope" "$table" > "$EVIDENCE_DIR/${code//./_}-$table.json"
  done
  log "Snapshot saved in $EVIDENCE_DIR"
}

preflight() {
  guard_testnet; guard_wallet
  for account in flon flon.token dao.gov dao.treasury; do
    rpc /v1/chain/get_abi "$(jq -cn --arg a "$account" '{account_name:$a}')" > "$EVIDENCE_DIR/abi-$account.json"
  done
  snapshot; log "Read-only preflight complete"
}

proposal_id_next() { rows dao.gov dao.gov global | jq -er '.rows[0].last_proposal_id + 1'; }
pack_args() {
  rpc /v1/chain/abi_json_to_bin "$(jq -cn --arg c "$1" --arg a "$2" --argjson x "$3" \
    '{code:$c,action:$a,args:$x}')" | jq -er .binargs
}
proposal_json() {
  local kind="$1" actions="$2"
  jq -cn --arg p "$PROPOSER_ACCOUNT" --arg k "$kind" \
    --arg t "${PROPOSAL_TITLE:-Testnet E2E proposal}" --arg s "${PROPOSAL_SUMMARY:-Testnet E2E}" \
    --arg h "${PROPOSAL_CONTENT_HASH:-0000000000000000000000000000000000000000000000000000000000000000}" \
    --arg m "${PROPOSAL_METADATA_URI:-}" --arg d "${PROPOSAL_DISCUSSION_URI:-}" --argjson a "$actions" \
    '{proposer:$p,proposal_type:$k,title:$t,summary:$s,content_hash:$h,metadata_uri:$m,discussion_uri:$d,actions:$a}'
}

help() { cat <<'EOF'
Usage: scripts/testnet-e2e.sh COMMAND [--env FILE] [--broadcast]

Read-only: preflight, snapshot
BP: bp-stake, bp-register, bp-unregister, bp-resume, bp-unstake,
    bp-cancel-refund, bp-claim-refund, bp-claim-rewards
Voter: vote-add, vote-allocate, vote-sub, vote-refund
DAO: dao-propose-signal, dao-propose-action, dao-set-forum, dao-endorse,
     dao-activate, dao-vote, dao-finalize, dao-queue, dao-execute,
     dao-expire, dao-cancel
Treasury: treasury-deposit

Writes require --broadcast and:
TESTNET_MUTATION_ACK=I_UNDERSTAND_TESTNET_STATE_WILL_CHANGE
EOF
}

case "$COMMAND" in
  help) help ;;
  preflight) preflight ;;
  snapshot) guard_testnet; snapshot ;;
  bp-stake|bp-unstake)
    guard_testnet; need BP_ACCOUNT
    action=stakebp; amount_var=BP_STAKE_AMOUNT
    [[ "$COMMAND" == bp-unstake ]] && { action=unstakebp; amount_var=BP_UNSTAKE_AMOUNT; }
    need "$amount_var"
    push flon "$action" "$(jq -cn --arg o "$BP_ACCOUNT" --arg q "${!amount_var}" '{owner:$o,quantity:$q}')" "$BP_ACCOUNT@${BP_PERMISSION:-active}"
    ;;
  bp-register)
    guard_testnet; need BP_ACCOUNT; need BP_SIGNING_KEY; need BP_URL
    push flon regproducer "$(jq -cn --arg p "$BP_ACCOUNT" --arg k "$BP_SIGNING_KEY" --arg u "$BP_URL" \
      --argjson l "${BP_LOCATION:-0}" --argjson r "${BP_REWARD_SHARE_BPS:-0}" \
      '{producer:$p,producer_key:$k,url:$u,location:$l,reward_shared_ratio:$r}')" "$BP_ACCOUNT@${BP_PERMISSION:-active}"
    ;;
  bp-unregister|bp-resume)
    guard_testnet; need BP_ACCOUNT; action=unregprod; [[ "$COMMAND" == bp-resume ]] && action=resumeprod
    push flon "$action" "$(jq -cn --arg p "$BP_ACCOUNT" '{producer:$p}')" "$BP_ACCOUNT@${BP_PERMISSION:-active}"
    ;;
  bp-cancel-refund|bp-claim-refund)
    guard_testnet; need BP_ACCOUNT; action=cancelbpref; [[ "$COMMAND" == bp-claim-refund ]] && action=claimbpstake
    push flon "$action" "$(jq -cn --arg o "$BP_ACCOUNT" '{owner:$o}')" "$BP_ACCOUNT@${BP_PERMISSION:-active}"
    ;;
  bp-claim-rewards)
    guard_testnet; need BP_ACCOUNT; need EXECUTOR_ACCOUNT
    push flon claimrewards "$(jq -cn --arg c "$EXECUTOR_ACCOUNT" --arg p "$BP_ACCOUNT" '{caller:$c,producer:$p,max_steps:24}')" "$EXECUTOR_ACCOUNT@${EXECUTOR_PERMISSION:-active}"
    ;;
  vote-add|vote-sub)
    guard_testnet; need VOTER_ACCOUNT; action=addvote; amount_var=VOTE_STAKE_AMOUNT
    [[ "$COMMAND" == vote-sub ]] && { action=subvote; amount_var=VOTE_SUB_AMOUNT; }; need "$amount_var"
    push flon "$action" "$(jq -cn --arg v "$VOTER_ACCOUNT" --arg q "${!amount_var}" '{voter:$v,vote_staked:$q}')" "$VOTER_ACCOUNT@${VOTER_PERMISSION:-active}"
    ;;
  vote-allocate)
    guard_testnet; need VOTER_ACCOUNT; need VOTE_ALLOCATIONS_JSON
    jq -e 'type=="array" and length>0 and length<=30' <<<"$VOTE_ALLOCATIONS_JSON" >/dev/null || die "invalid allocations"
    push flon votealloc "$(jq -cn --arg v "$VOTER_ACCOUNT" --argjson a "$VOTE_ALLOCATIONS_JSON" '{voter:$v,allocations:$a}')" "$VOTER_ACCOUNT@${VOTER_PERMISSION:-active}"
    ;;
  vote-refund)
    guard_testnet; need VOTER_ACCOUNT
    push flon voterefund "$(jq -cn --arg o "$VOTER_ACCOUNT" '{owner:$o}')" "$VOTER_ACCOUNT@${VOTER_PERMISSION:-active}"
    ;;
  dao-propose-signal)
    guard_testnet; need PROPOSER_ACCOUNT; log "Expected proposal ID: $(proposal_id_next)"
    push dao.gov propose "$(proposal_json signal '[]')" "$PROPOSER_ACCOUNT@${PROPOSER_PERMISSION:-active}"
    ;;
  dao-propose-action)
    guard_testnet; need PROPOSER_ACCOUNT; need EXEC_ACTION_CONTRACT; need EXEC_ACTION_NAME; need EXEC_ACTION_JSON
    bin="$(pack_args "$EXEC_ACTION_CONTRACT" "$EXEC_ACTION_NAME" "$EXEC_ACTION_JSON")"
    actions="$(jq -cn --arg c "$EXEC_ACTION_CONTRACT" --arg n "$EXEC_ACTION_NAME" --arg d "$bin" '[{contract:$c,action_name:$n,data:$d}]')"
    log "Expected proposal ID: $(proposal_id_next); frozen bytes: $(( ${#bin} / 2 ))"
    push dao.gov propose "$(proposal_json executable "$actions")" "$PROPOSER_ACCOUNT@${PROPOSER_PERMISSION:-active}"
    ;;
  dao-set-forum)
    guard_testnet; need PROPOSER_ACCOUNT; need PROPOSAL_ID; need PROPOSAL_DISCUSSION_URI
    push dao.gov setforum "$(jq -cn --arg p "$PROPOSER_ACCOUNT" --argjson i "$PROPOSAL_ID" --arg u "$PROPOSAL_DISCUSSION_URI" '{proposer:$p,proposal_id:$i,discussion_uri:$u}')" "$PROPOSER_ACCOUNT@${PROPOSER_PERMISSION:-active}"
    ;;
  dao-endorse)
    guard_testnet; need ENDORSER_ACCOUNT; need PROPOSAL_ID
    push dao.gov endorse "$(jq -cn --arg e "$ENDORSER_ACCOUNT" --argjson i "$PROPOSAL_ID" '{endorser:$e,proposal_id:$i}')" "$ENDORSER_ACCOUNT@${ENDORSER_PERMISSION:-active}"
    ;;
  dao-vote)
    guard_testnet; need DAO_VOTER_ACCOUNT; need PROPOSAL_ID
    push dao.gov castvote "$(jq -cn --arg v "$DAO_VOTER_ACCOUNT" --argjson i "$PROPOSAL_ID" --argjson c "${VOTE_CHOICE:-1}" '{voter:$v,proposal_id:$i,choice:$c}')" "$DAO_VOTER_ACCOUNT@${DAO_VOTER_PERMISSION:-active}"
    ;;
  dao-activate|dao-finalize|dao-queue|dao-execute|dao-expire)
    guard_testnet; need EXECUTOR_ACCOUNT; need PROPOSAL_ID; action="${COMMAND#dao-}"
    push dao.gov "$action" "$(jq -cn --argjson i "$PROPOSAL_ID" '{proposal_id:$i}')" "$EXECUTOR_ACCOUNT@${EXECUTOR_PERMISSION:-active}"
    ;;
  dao-cancel)
    guard_testnet; need PROPOSER_ACCOUNT; need PROPOSAL_ID
    push dao.gov cancel "$(jq -cn --arg p "$PROPOSER_ACCOUNT" --argjson i "$PROPOSAL_ID" '{proposer:$p,proposal_id:$i}')" "$PROPOSER_ACCOUNT@${PROPOSER_PERMISSION:-active}"
    ;;
  treasury-deposit)
    guard_testnet; need PROPOSER_ACCOUNT; need TREASURY_DEPOSIT_AMOUNT; write_guard
    result="$(cli transfer "$PROPOSER_ACCOUNT" dao.treasury "$TREASURY_DEPOSIT_AMOUNT" "testnet E2E treasury deposit" -p "$PROPOSER_ACCOUNT@${PROPOSER_PERMISSION:-active}" -j 2>&1)" || {
      printf '%s\n' "$result" | tee "$EVIDENCE_DIR/treasury-deposit-error.txt" >&2; exit 1;
    }
    if ! jq -e '(.processed.except == null) and (.processed.error_code == null)' <<<"$result" >/dev/null 2>&1; then
      printf '%s\n' "$result" | tee "$EVIDENCE_DIR/treasury-deposit-error.json" >&2
      die "chain rejected treasury deposit"
    fi
    printf '%s\n' "$result" | tee "$EVIDENCE_DIR/treasury-deposit.json"
    jq -r '.transaction_id // empty' <<<"$result" | tee -a "$EVIDENCE_DIR/transactions.txt"
    ;;
  *) die "unknown command: $COMMAND" ;;
esac
