#!/usr/bin/env bash
# Analytics capacity check against the production gateway. GET requests only.
# Simulates users opening the Overview page (7 parallel analytics calls each).
#
# Usage (on the server):
#   read -rs CRM_TOKEN && export CRM_TOKEN   # paste a bearer token, nothing echoes
#   bash analytics-loadtest.sh [base_url]     # default http://127.0.0.1:8080
set -euo pipefail

BASE="${1:-http://127.0.0.1:8080}"
: "${CRM_TOKEN:?export CRM_TOKEN first}"
export API="$BASE/api/v1/analytics" CRM_TOKEN
ENDPOINTS=(metrics customers deals accounts properties "leaderboard?range=month" "revenue?range=month")

hit() {
    curl -s -o /dev/null --max-time 130 -w '%{http_code} %{time_total}\n' \
        -H "Authorization: Bearer $CRM_TOKEN" -H 'Accept: application/json' "$API/$1"
}
export -f hit

summary() {
    sort -k2 -n | awk '
        { codes[$1]++; t[NR] = $2 }
        END {
            p95 = int(NR * 0.95); if (p95 < 1) p95 = 1
            printf "n=%d p50=%.0fms p95=%.0fms max=%.0fms codes:", NR, t[int(NR / 2) + 1] * 1000, t[p95] * 1000, t[NR] * 1000
            for (c in codes) printf " %s=%d", c, codes[c]
            print ""
        }'
}

echo "== 1. Single requests (cache expired, then cached)"
echo "   waiting 31s for the 30s analytics cache to expire..."
sleep 31
for e in "${ENDPOINTS[@]}" overview; do
    cold=$(hit "$e"); warm=$(hit "$e")
    printf '   %-24s cold %s   warm %s\n' "$e" "$cold" "$warm"
done

echo "== 2. Concurrent page loads (each wave starts with an expired cache)"
for users in 1 3 7; do
    conc=$((users * 7))
    sleep 31
    printf '   %d users (concurrency %d, 4 rounds): ' "$users" "$conc"
    for _ in 1 2 3 4; do
        for _ in $(seq "$users"); do printf '%s\n' "${ENDPOINTS[@]}"; done
    done | xargs -P "$conc" -I{} bash -c 'hit "$1"' _ {} | summary
done
