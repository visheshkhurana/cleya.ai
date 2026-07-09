#!/usr/bin/env bash
# Daily morning health check for cleya.ai production.
# Exits non-zero (and prints FAIL lines to stderr) on any P0/P1 failure.
# Design: see docs/DAILY_HEALTH_CHECK_PLAN.md

set -u
BASE="${CLEYA_BASE_URL:-https://cleya.ai}"
FAILURES=()
WARNINGS=()
JAR=$(mktemp)
JAR2=$(mktemp)
trap 'rm -f "$JAR" "$JAR2" /tmp/cleya-check-*.json' EXIT

pass() { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s  ::  %s\n' "$1" "$2" >&2; FAILURES+=("$1: $2"); }
warn() { printf '  WARN  %s  ::  %s\n' "$1" "$2"; WARNINGS+=("$1: $2"); }

http() {
  # http <method> <path> <cookie-jar> [csrf] [json-body]
  local method="$1" path="$2" jar="$3" csrf="${4:-}" body="${5:-}"
  local args=(-sS --max-time 20 -o /tmp/cleya-check-body.json -w '%{http_code}' -b "$jar" -c "$jar" -X "$method" "$BASE$path" -H 'Content-Type: application/json')
  [[ -n "$csrf" ]] && args+=(-H "x-csrf-token: $csrf")
  [[ -n "$body" ]] && args+=(-d "$body")
  curl "${args[@]}"
}

csrf_of() { grep cleo_csrf "$1" 2>/dev/null | awk '{print $7}'; }

echo "=== Cleya.ai daily health check @ $(date -u +%FT%TZ) ==="
echo "Target: $BASE"

# --- P0: frontend homepage ---
code=$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' "$BASE/")
[[ "$code" == "200" ]] && pass "homepage GET / -> $code" || fail "homepage GET /" "http=$code"

# --- P0: DB health ---
db_body=$(curl -sS --max-time 20 -w '\nHTTP:%{http_code}' "$BASE/api/health/db")
db_code=$(echo "$db_body" | tail -1 | sed 's/HTTP://')
db_status=$(echo "$db_body" | head -1 | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
if [[ "$db_code" == "200" && "$db_status" == "healthy" ]]; then
  pass "DB health -> $db_status"
else
  fail "DB health" "http=$db_code status=$db_status"
fi

# --- CSRF for POSTs ---
csrf_body=$(curl -sS --max-time 15 -c "$JAR" "$BASE/api/csrf-token")
CSRF=$(csrf_of "$JAR")
[[ -n "$CSRF" ]] && pass "CSRF token issued" || fail "CSRF token" "no csrfToken cookie"

# --- P0: fresh signup ---
NONCE=$(od -An -N4 -tu4 </dev/urandom | tr -d ' ')
EMAIL="canary-${NONCE}@cleya-canary.test"
PW="CanaryTest123!"
signup_code=$(http POST /api/auth/signup "$JAR" "$CSRF" "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"Daily Canary\"}")
if [[ "$signup_code" == "201" ]]; then
  pass "signup -> 201 ($EMAIL)"
else
  fail "signup" "http=$signup_code body=$(head -c 200 /tmp/cleya-check-body.json)"
fi

# --- P0: login same user (fresh CSRF jar to prove cookie flow works from scratch) ---
curl -sS --max-time 15 -c "$JAR2" "$BASE/api/csrf-token" > /dev/null
CSRF2=$(csrf_of "$JAR2")
login_code=$(http POST /api/auth/login "$JAR2" "$CSRF2" "{\"email\":\"$EMAIL\",\"password\":\"$PW\"}")
if [[ "$login_code" == "200" ]]; then
  pass "login -> 200"
else
  fail "login" "http=$login_code body=$(head -c 200 /tmp/cleya-check-body.json)"
fi

# --- P0: /me with cookie ---
me_code=$(curl -sS --max-time 15 -b "$JAR2" -o /tmp/cleya-check-body.json -w '%{http_code}' "$BASE/api/auth/me")
if [[ "$me_code" == "200" ]]; then
  pass "/api/auth/me -> 200"
else
  fail "/api/auth/me" "http=$me_code"
fi

# --- P1: bad password rejected ---
JAR3=$(mktemp); trap 'rm -f "$JAR" "$JAR2" "$JAR3" /tmp/cleya-check-*.json' EXIT
curl -sS --max-time 15 -c "$JAR3" "$BASE/api/csrf-token" > /dev/null
CSRF3=$(csrf_of "$JAR3")
bad_code=$(http POST /api/auth/login "$JAR3" "$CSRF3" "{\"email\":\"$EMAIL\",\"password\":\"WrongPassword123!\"}")
if [[ "$bad_code" == "401" ]]; then
  pass "bad password -> 401"
else
  fail "bad password rejection" "expected 401 got $bad_code"
fi

# --- P1: duplicate signup rejected ---
JAR4=$(mktemp); trap 'rm -f "$JAR" "$JAR2" "$JAR3" "$JAR4" /tmp/cleya-check-*.json' EXIT
curl -sS --max-time 15 -c "$JAR4" "$BASE/api/csrf-token" > /dev/null
CSRF4=$(csrf_of "$JAR4")
dup_code=$(http POST /api/auth/signup "$JAR4" "$CSRF4" "{\"email\":\"$EMAIL\",\"password\":\"$PW\",\"name\":\"Dup\"}")
if [[ "$dup_code" == "409" ]]; then
  pass "duplicate signup -> 409"
else
  fail "duplicate signup rejection" "expected 409 got $dup_code"
fi

# --- P1: register/login pages ---
reg_code=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' "$BASE/register")
[[ "$reg_code" == "307" || "$reg_code" == "308" || "$reg_code" == "200" ]] && pass "/register -> $reg_code" || fail "/register" "http=$reg_code"

log_code=$(curl -sS --max-time 15 -o /dev/null -w '%{http_code}' "$BASE/login")
[[ "$log_code" == "200" ]] && pass "/login -> 200" || fail "/login" "http=$log_code"

# --- P2: overall health (record, don't fail on degraded) ---
h_body=$(curl -sS --max-time 15 "$BASE/api/health")
h_status=$(echo "$h_body" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p' | head -1)
case "$h_status" in
  healthy)  pass "overall health -> healthy" ;;
  degraded) warn "overall health -> degraded" "$h_body" ;;
  *)        fail "overall health" "status=$h_status body=$(echo "$h_body" | head -c 200)" ;;
esac

# --- Summary ---
echo ""
echo "=== Summary ==="
echo "Failures: ${#FAILURES[@]}"
echo "Warnings: ${#WARNINGS[@]}"
if (( ${#FAILURES[@]} > 0 )); then
  printf '  - %s\n' "${FAILURES[@]}"
  exit 1
fi
exit 0
