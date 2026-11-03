#!/usr/bin/env bash
set -Eeuo pipefail

readonly TESTNET_CHAIN_ID="18b4d5837d83a8f7203ea57cb7ab37b9cef59547ea307e70b1bf1103cb06043f"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RPC_URL="${RPC_URL:-https://t4.flon.network}"
EXPECTED_CHAIN_ID="${EXPECTED_CHAIN_ID:-$TESTNET_CHAIN_ID}"
COMMAND="${1:-help}"; [[ $# -eq 0 ]] || shift
LABEL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) [[ $# -ge 2 ]] || { echo "--env requires a file" >&2; exit 2; }; source "$2"; shift ;;
    --label) [[ $# -ge 2 ]] || { echo "--label requires a value" >&2; exit 2; }; LABEL="$2"; shift ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

rpc() {
  curl --fail --silent --show-error --connect-timeout 5 --max-time 20 \
    --retry 3 --retry-all-errors --retry-delay 1 "$RPC_URL$1" \
    -H 'content-type: application/json' --data "$2"
}
rows() {
  rpc /v1/chain/get_table_rows "$(jq -cn --arg c "$1" --arg s "$2" --arg t "$3" \
    '{json:true,code:$c,scope:$s,table:$t,limit:1000,reverse:true}')"
}
guard() {
  [[ "$EXPECTED_CHAIN_ID" == "$TESTNET_CHAIN_ID" ]] || { echo "EXPECTED_CHAIN_ID changed" >&2; exit 1; }
  local info chain
  info="$(rpc /v1/chain/get_info '{}')"
  chain="$(jq -r .chain_id <<<"$info")"
  [[ "$chain" == "$TESTNET_CHAIN_ID" ]] || { echo "Refusing non-testnet chain $chain" >&2; exit 1; }
  printf '%s\n' "$info"
}
active_bps() {
  rows flon flon producers | jq -r '[.rows[] | select(.is_active==1) | .owner] | join(",")'
}
latest_gas_epoch() {
  rows flon flon gasepochcfg | jq -er '[.rows[].epoch_id] | max'
}
current_reward_epoch() {
  rows flon flon rewardepoch | jq -er '.rows[0].next_epoch_to_close'
}
capture_scope() {
  local out="$1" table="$2" scope="$3"
  rows flon "$scope" "$table" > "$out/$table.json"
}
balance() {
  rpc /v1/chain/get_currency_balance "$(jq -cn --arg a "$1" '{code:"flon.token",account:$a,symbol:"FLON"}')"
}

capture() {
  local info root bp epoch gas_epoch
  info="$(guard)"
  epoch="${EPOCH_ID:-$(current_reward_epoch)}"
  gas_epoch="${GAS_EPOCH_ID:-$(latest_gas_epoch)}"
  BP_ACCOUNTS="${BP_ACCOUNTS:-$(active_bps)}"
  LABEL="${LABEL:-snapshot}"
  root="${SNAPSHOT_DIR:-$REPO_DIR/artifacts/testnet-e2e/bp-rewards-$(date -u +%Y%m%dT%H%M%SZ)-$LABEL}"
  mkdir -p "$root/prodclaims" "$root/gasclaims" "$root/balances"
  jq . <<<"$info" > "$root/get_info.json"
  jq -n --arg captured "$(date -u +%FT%TZ)" --arg rpc "$RPC_URL" \
    --argjson epoch "$epoch" --argjson gas_epoch "$gas_epoch" --arg bps "$BP_ACCOUNTS" \
    '{captured_at:$captured,rpc:$rpc,reward_epoch:$epoch,gas_epoch:$gas_epoch,bp_accounts:($bps|split(",")|map(select(length>0)))}' \
    > "$root/metadata.json"

  for table in global rewardepoch rewardplans rewardseal epochstats bpstatus producers gasrewcfg gasepochcfg gassettles; do
    rows flon flon "$table" > "$root/$table.json"
  done
  capture_scope "$root" bpstats "$epoch"
  capture_scope "$root" epochreward "$epoch"
  capture_scope "$root" gasnodestats "$gas_epoch"
  for table in global producers voters epochstate sealstate; do
    rows voter.reward voter.reward "$table" > "$root/voter-reward-$table.json"
  done
  rows voter.reward "$epoch" epochindex > "$root/voter-reward-epochindex.json"

  IFS=',' read -r -a bp_array <<<"$BP_ACCOUNTS"
  for bp in "${bp_array[@]}"; do
    [[ -n "$bp" ]] || continue
    rows flon "$bp" prodclaims > "$root/prodclaims/$bp.json"
    rows flon "$bp" gasclaims > "$root/gasclaims/$bp.json"
    balance "$bp" > "$root/balances/$bp.json"
  done
  balance flon > "$root/balances/flon.json"
  balance voter.reward > "$root/balances/voter.reward.json"
  balance flon.gas > "$root/balances/flon.gas.json"

  summarize "$root" > "$root/summary.md"
  printf '%s\n' "$root"
}

summarize() {
  local root="$1" epoch gas_epoch head lib
  epoch="$(jq -r .reward_epoch "$root/metadata.json")"
  gas_epoch="$(jq -r .gas_epoch "$root/metadata.json")"
  head="$(jq -r .head_block_num "$root/get_info.json")"
  lib="$(jq -r .last_irreversible_block_num "$root/get_info.json")"
  cat <<EOF
# BP Performance & Rewards snapshot

- Captured: $(jq -r .captured_at "$root/metadata.json")
- Reward epoch: $epoch
- GAS epoch: $gas_epoch
- Head / LIB: $head / $lib

## Reward epoch status

| Epoch | Complete sample | Closed | Active BP | Failed BP | Network incident |
|---:|---|---|---:|---:|---|
EOF
  jq -r --argjson e "$epoch" '.rows[] | select(.epoch_id==$e) | "| \(.epoch_id) | \(.complete_sample) | \(.closed) | \(.active_bp_count) | \(.failed_bp_count) | \(.network_incident) |"' "$root/epochstats.json"
  cat <<'EOF'

## BP production

`idle_skipped` 不进入出块率分母；出块率为 `produced / expected`。

| BP | Expected | Produced | Missed | Idle skipped | Production rate | Longest missed | Status | Warnings |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
EOF
  jq -r '
    def status_text: ["unassessed","qualified","degraded","warning","suspended","insufficient_sample","network_incident","probation"][.] // "unknown";
    .rows[] | . as $r |
    (($r.produced_blocks * 10000 / (if $r.expected_blocks==0 then 1 else $r.expected_blocks end)) | floor / 100) as $rate |
    "| \($r.producer) | \($r.expected_blocks) | \($r.produced_blocks) | \($r.missed_blocks) | \($r.idle_skipped_blocks // 0) | \($rate)% | \($r.longest_missed_streak) | \($r.status) (\($r.status|status_text)) | \($r.warning_count) |"' "$root/bpstats.json"
  cat <<'EOF'

## Producer balances

| BP | Active | Unclaimed block rewards | Reward share | Last claim |
|---|---|---:|---:|---|
EOF
  jq -r '.rows[] | "| \(.owner) | \(.is_active) | \(.unclaimed_rewards) | \(.reward_shared_ratio / 100)% | \(.last_claim_time) |"' "$root/producers.json"
  cat <<'EOF'

## GAS performance and allocation

| BP | Role | Expected | Produced | Missed | Idle skipped | Eligible | Score | Allocated |
|---|---:|---:|---:|---:|---:|---|---:|---:|
EOF
  jq -r '.rows[] | "| \(.owner) | \(.role) | \(.expected) | \(.produced) | \(.missed) | \(.idle_skipped // 0) | \(.eligible) | \(.score) | \(.allocated) |"' "$root/gasnodestats.json"
  cat <<'EOF'

## Assertions

EOF
  jq -r '
    if ([.rows[] | select(.expected_blocks != (.produced_blocks + .missed_blocks))] | length)==0
    then "- PASS: every BP has expected = produced + missed"
    else "- FAIL: at least one BP violates expected = produced + missed" end,
    if ([.rows[] | select(.produced_blocks > .expected_blocks)] | length)==0
    then "- PASS: no BP produced more than expected"
    else "- FAIL: produced exceeds expected" end
  ' "$root/bpstats.json"
  jq -r --argjson e "$gas_epoch" '
    [.rows[] | select(.epoch_id==$e)][0] as $s |
    if $s==null then "- INFO: GAS settlement is not available yet"
    elif ($s.finalized==1 and $s.funded==1) then "- PASS: GAS settlement finalized and funded"
    else "- INFO: GAS settlement not finalized/funded" end
  ' "$root/gassettles.json"
  jq -nr --slurpfile nf "$root/gasnodestats.json" --slurpfile sf "$root/gassettles.json" --argjson e "$gas_epoch" '
    def units: split(" ")[0] | tonumber | . * 100000000 | round;
    ($nf[0]) as $n | ($sf[0]) as $s |
    [$s.rows[] | select(.epoch_id==$e)][0] as $settle |
    ([$n.rows[].allocated | units] | add // 0) as $nodes |
    if $settle==null then "- INFO: cannot check GAS allocation conservation before settlement"
    elif $nodes == (($settle.active_allocated|units)+($settle.standby_allocated|units))
    then "- PASS: GAS node allocations equal active + standby allocated"
    else "- FAIL: GAS node allocation sum does not match settlement" end,
    if $settle==null then empty
    elif ($settle.pool|units) == (($settle.active_pool|units)+($settle.standby_pool|units))
    then "- PASS: active + standby pool equals GAS pool"
    else "- FAIL: GAS pool split is not conserved" end
  '
  jq -nr --slurpfile gf "$root/voter-reward-global.json" --slurpfile pf "$root/voter-reward-producers.json" --slurpfile vf "$root/voter-reward-voters.json" '
    def units: split(" ")[0] | tonumber | . * 100000000 | round;
    ($gf[0]) as $g | ($pf[0]) as $p | ($vf[0]) as $v |
    ([$p.rows[].total_rewards|units] | add // 0) as $ptotal |
    ([$p.rows[].allocated_rewards|units] | add // 0) as $pallocated |
    ([$v.rows[] | ((.claimed_rewards|units)+(.unclaimed_rewards|units))] | add // 0) as $vaccounted |
    if ([ $p.rows[] | select((.total_rewards|units) != ((.allocating_rewards|units)+(.allocated_rewards|units))) ] | length)==0
    then "- PASS: each voter-reward producer has total = allocating + allocated"
    else "- FAIL: voter-reward producer accounting is inconsistent" end,
    if ($g.rows[0].total_rewards|units)==$ptotal
    then "- PASS: voter-reward global total equals producer totals"
    else "- FAIL: voter-reward global/producer totals differ" end,
    if $pallocated==$vaccounted
    then "- PASS: voter claimed + unclaimed equals producer allocated rewards"
    else "- FAIL: voter reward allocation is not conserved" end
  '
}

compare() {
  [[ -n "${BEFORE_DIR:-}" && -d "$BEFORE_DIR" ]] || { echo "BEFORE_DIR is required" >&2; exit 2; }
  [[ -n "${AFTER_DIR:-}" && -d "$AFTER_DIR" ]] || { echo "AFTER_DIR is required" >&2; exit 2; }
  local out="${COMPARE_OUT:-$AFTER_DIR/comparison.md}"
  {
    echo '# BP Performance & Rewards comparison'
    echo
    echo "- Before: \`$BEFORE_DIR\`"
    echo "- After: \`$AFTER_DIR\`"
    echo
    echo '## Producer unclaimed reward delta'
    echo
    echo '| BP | Before | After | Delta (smallest units) |'
    echo '|---|---:|---:|---:|'
    jq -n --slurpfile b "$BEFORE_DIR/producers.json" --slurpfile a "$AFTER_DIR/producers.json" '
      def amount: split(" ")[0] | tonumber;
      ($b[0].rows | map({key:.owner,value:.}) | from_entries) as $bm |
      ($a[0].rows | map({key:.owner,value:.}) | from_entries) as $am |
      (($bm|keys) + ($am|keys) | unique)[] as $k |
      ($bm[$k].unclaimed_rewards // "0.00000000 FLON") as $bv |
      ($am[$k].unclaimed_rewards // "0.00000000 FLON") as $av |
      "| \($k) | \($bv) | \($av) | \((((($av|amount)-($bv|amount))*100000000)|round)) |"' -r
    echo
    echo 'A negative delta can mean claim activity occurred between snapshots; confirm against prodclaims and transaction IDs.'
    echo
    echo '## Global reward delta'
    echo
    jq -n --slurpfile b "$BEFORE_DIR/global.json" --slurpfile a "$AFTER_DIR/global.json" '
      def row: .[0].rows[0];
      "- total_produced_rewards: \($b|row|.total_produced_rewards) -> \($a|row|.total_produced_rewards)\n- total_unclaimed_rewards: \($b|row|.total_unclaimed_rewards) -> \($a|row|.total_unclaimed_rewards)"' -r
    echo
    echo '## Sealed reward epoch reconciliation'
    echo
    echo '| BP | Gross | Factor bp | Eligible | Producer expected/actual | Voter share expected/actual | Forfeited | Result |'
    echo '|---|---:|---:|---:|---:|---:|---:|---|'
    local epoch closed bp gross ratio expected produced missed status incident factor eligible shared producer actual_claim before_voter after_voter voter_delta result
    epoch="$(jq -r .reward_epoch "$BEFORE_DIR/metadata.json")"
    closed="$(jq -r --argjson e "$epoch" '[.rows[] | select(.epoch_id==$e)][0].closed // 0' "$AFTER_DIR/epochstats.json")"
    incident="$(jq -r --argjson e "$epoch" '[.rows[] | select(.epoch_id==$e)][0].network_incident // 0' "$AFTER_DIR/epochstats.json")"
    if [[ "$closed" != 1 ]]; then
      echo '| — | — | — | — | — | — | — | INFO: after snapshot epoch is not sealed |'
    elif [[ "$(jq '.rows|length' "$BEFORE_DIR/epochreward.json")" -eq 0 ]]; then
      echo '| — | — | — | — | — | — | — | INFO: before snapshot has no unsealed epochreward rows |'
    else while IFS=$'\t' read -r bp gross ratio; do
      [[ -n "$bp" ]] || continue
      read -r expected produced missed status < <(jq -r --arg p "$bp" '.rows[] | select(.producer==$p) | [.expected_blocks,.produced_blocks,.missed_blocks,.status] | @tsv' "$AFTER_DIR/bpstats.json")
      if [[ "$incident" == 1 || "$expected" -lt 12 || "$status" == 5 || "$status" == 6 ]]; then factor=10000
      elif (( produced * 100 < expected * 95 )); then factor=0
      elif (( produced * 100 >= expected * 99 )); then factor=10000
      else factor=$((produced * 10000 / expected)); fi
      eligible=$((gross * factor / 10000))
      shared=$((eligible * ratio / 10000))
      producer=$((eligible - shared))
      actual_claim="$(jq -r --argjson e "$epoch" '[.rows[] | select(.epoch_id==$e)][0].quantity // "0.00000000 FLON" | split(" ")[0] | tonumber*100000000 | round' "$AFTER_DIR/prodclaims/$bp.json")"
      before_voter="$(jq -r --arg p "$bp" '[.rows[] | select(.owner==$p)][0].total_rewards // "0.00000000 FLON" | split(" ")[0] | tonumber*100000000 | round' "$BEFORE_DIR/voter-reward-producers.json")"
      after_voter="$(jq -r --arg p "$bp" '[.rows[] | select(.owner==$p)][0].total_rewards // "0.00000000 FLON" | split(" ")[0] | tonumber*100000000 | round' "$AFTER_DIR/voter-reward-producers.json")"
      voter_delta=$((after_voter - before_voter))
      result=PASS; [[ "$actual_claim" -eq "$producer" && "$voter_delta" -eq "$shared" ]] || result=FAIL
      printf '| %s | %s | %s | %s | %s / %s | %s / %s | %s | %s |\n' \
        "$bp" "$gross" "$factor" "$eligible" "$producer" "$actual_claim" "$shared" "$voter_delta" "$((gross-eligible))" "$result"
    done < <(jq -r '.rows[] | [.producer, (.rewards|split(" ")[0]|tonumber*100000000|round), .reward_shared_ratio] | @tsv' "$BEFORE_DIR/epochreward.json")
    fi
    echo
    echo 'Amounts in the reconciliation table are FLON smallest units (10^-8). The voter delta assertion requires the snapshots to span exactly this one sealed reward epoch.'
    echo
    echo '## Account balance and claim-row deltas'
    echo
    echo '| Account | FLON before | FLON after | prodclaims before/after | gasclaims before/after |'
    echo '|---|---:|---:|---:|---:|'
    while IFS= read -r bp; do
      [[ -n "$bp" ]] || continue
      printf '| %s | %s | %s | %s / %s | %s / %s |\n' "$bp" \
        "$(jq -r '.[0] // "0.00000000 FLON"' "$BEFORE_DIR/balances/$bp.json")" \
        "$(jq -r '.[0] // "0.00000000 FLON"' "$AFTER_DIR/balances/$bp.json")" \
        "$(jq '.rows|length' "$BEFORE_DIR/prodclaims/$bp.json")" "$(jq '.rows|length' "$AFTER_DIR/prodclaims/$bp.json")" \
        "$(jq '.rows|length' "$BEFORE_DIR/gasclaims/$bp.json")" "$(jq '.rows|length' "$AFTER_DIR/gasclaims/$bp.json")"
    done < <(jq -r '.bp_accounts[]' "$BEFORE_DIR/metadata.json")
    echo
    echo '## After snapshot assertions'
    summarize "$AFTER_DIR" | sed -n '/## Assertions/,$p'
    if [[ -n "${CLAIM_SUMMARY:-}" ]]; then
      echo
      echo '## Claim-aware strict reconciliation'
      echo
      local claim_out
      claim_out="${CLAIM_RECONCILIATION_OUT:-$AFTER_DIR/claim-reconciliation.json}"
      "${NODE_BIN:-node}" "$SCRIPT_DIR/reconcile-bp-claims.mjs" \
        --before "$BEFORE_DIR" --after "$AFTER_DIR" --claims "$CLAIM_SUMMARY" \
        --epoch "$epoch" --out "$claim_out"
      jq -r '"- Result: \(if .pass then "PASS" else "FAIL" end)\n- Reconstructed base reward: \(.total_accrued_base_reward)\n- Irreversible claim traces: \(.traced_claim_count)\n- Evidence: `\($out)`"' --arg out "$claim_out" "$claim_out"
    fi
  } > "$out"
  printf '%s\n' "$out"
}

case "$COMMAND" in
  capture) capture ;;
  summarize) [[ -n "${SNAPSHOT_DIR:-}" ]] || { echo "SNAPSHOT_DIR is required" >&2; exit 2; }; summarize "$SNAPSHOT_DIR" ;;
  compare) compare ;;
  help|*) cat <<'EOF'
Usage:
  testnet-bp-rewards.sh capture [--env FILE] [--label before|after]
  SNAPSHOT_DIR=... testnet-bp-rewards.sh summarize
  BEFORE_DIR=... AFTER_DIR=... testnet-bp-rewards.sh compare

Optional environment:
  EPOCH_ID       Reward epoch to inspect; defaults to rewardepoch.next_epoch_to_close
  GAS_EPOCH_ID   GAS epoch to inspect; defaults to latest gasepochcfg epoch
  BP_ACCOUNTS    Comma-separated accounts; defaults to active producers
  SNAPSHOT_DIR   Explicit output directory
  CLAIM_SUMMARY  Decoded irreversible claim trace summary used by compare
  CLAIM_RECONCILIATION_OUT  Optional claim-aware JSON output path
  NODE_BIN       Node.js executable used for claim-aware reconciliation

This script is read-only and hard-locked to the FLON testnet chain ID.
EOF
  ;;
esac
