#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Dev Loop Orchestrator — Build → Test → Audit → Iterate
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./dev-loop.sh \
#     --task "Fix sidebar on mobile: hide it, add hamburger menu" \
#     --url "http://localhost:8081/property/PROP-001/dashboard" \
#     --criteria "sidebar is hidden; hamburger menu visible; cards stacked vertically" \
#     --max-iterations 5
#
# Workflow:
#   1. Logs in with saved auth (or prompts)
#   2. Opens target URL
#   3. Runs audit-agent with criteria
#   4. If PASS → done
#   5. If FAIL → prints feedback, waits for you to make changes, repeats
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Config ───────────────────────────────────────────────────────────────────
TASK=""
URL=""
CRITERIA=""
MAX_ITERATIONS=10
AUTH_FILE="./.agent-browser-auth.json"
BASE_URL="http://localhost:8081"
VERBOSE=false

# ─── Parse Args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --task) TASK="$2"; shift 2 ;;
    --url) URL="$2"; shift 2 ;;
    --criteria) CRITERIA="$2"; shift 2 ;;
    --max-iterations) MAX_ITERATIONS="$2"; shift 2 ;;
    --auth-file) AUTH_FILE="$2"; shift 2 ;;
    --base-url) BASE_URL="$2"; shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$TASK" || -z "$URL" || -z "$CRITERIA" ]]; then
  cat <<'EOF'
Usage: ./dev-loop.sh [options]

Required:
  --task        "Description of what to build/fix"
  --url         "http://localhost:8081/path/to/page"
  --criteria    "semicolon-separated acceptance criteria"

Optional:
  --max-iterations  Max audit loops (default: 10)
  --auth-file       Path to saved auth state (default: ./.agent-browser-auth.json)
  --base-url        Base URL for auth (default: http://localhost:8081)
  --verbose         Show detailed output

Examples:
  ./dev-loop.sh \
    --task "Hide sidebar on mobile, add hamburger menu" \
    --url "http://localhost:8081/property/PROP-001/dashboard" \
    --criteria "sidebar is hidden; hamburger menu visible; content full width"

  ./dev-loop.sh \
    --task "Stack Checklist and Health cards vertically" \
    --url "http://localhost:8081/property/PROP-001/dashboard" \
    --criteria "Checklist card is full width; Health card is full width; no text wrapping"
EOF
  exit 1
fi

REPORTS_DIR="./audit-reports"
mkdir -p "$REPORTS_DIR"
ITERATION=0

# ─── Header ───────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                   🔄  DEV LOOP ORCHESTRATOR v1.0                             ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Task:        $TASK"
echo "🌐 Target URL:  $URL"
echo "📋 Criteria:    $CRITERIA"
echo "🔁 Max Loops:   $MAX_ITERATIONS"
echo ""

# ─── Pre-flight: Auth Check ───────────────────────────────────────────────────
echo "▶ Pre-flight: Checking authentication..."

function ensure_auth() {
  if [[ -f "$AUTH_FILE" ]]; then
    echo "  ✓ Auth state found at $AUTH_FILE"
    agent-browser --state "$AUTH_FILE" open "$BASE_URL" 2>/dev/null || {
      echo "  ⚠️  Saved auth expired. Re-authenticating..."
      do_auth
    }
  else
    echo "  ⚠️  No auth state found."
    do_auth
  fi
}

function do_auth() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════════════"
  echo "  🔐 AUTHENTICATION REQUIRED"
  echo "═══════════════════════════════════════════════════════════════════════"
  echo ""
  echo "  Please log in manually in the browser window that opens."
  echo "  After logging in, press ENTER to save the auth state."
  echo ""
  echo "  Login URL: $BASE_URL"
  echo ""

  agent-browser --headed --session-name dev-loop-auth open "$BASE_URL"

  read -r -p "  Press ENTER after logging in..."

  agent-browser state save "$AUTH_FILE"
  agent-browser close

  echo ""
  echo "  ✅ Auth state saved to $AUTH_FILE"
  echo ""
}

ensure_auth

# ─── Main Loop ────────────────────────────────────────────────────────────────
while [[ $ITERATION -lt $MAX_ITERATIONS ]]; do
  ITERATION=$((ITERATION + 1))
  echo ""
  echo "══════════════════════════════════════════════════════════════════════════════"
  echo "  🔁 ITERATION $ITERATION / $MAX_ITERATIONS"
  echo "══════════════════════════════════════════════════════════════════════════════"
  echo ""

  # Open page with auth
  echo "▶ Opening $URL with saved auth..."
  agent-browser --state "$AUTH_FILE" open "$URL" 2>/dev/null
  agent-browser wait --load networkidle 2>/dev/null || true
  sleep 2

  # Take iteration screenshot
  SCREENSHOT="$REPORTS_DIR/iteration_${ITERATION}.png"
  agent-browser screenshot "$SCREENSHOT" 2>/dev/null || true

  echo "  📸 Screenshot: $SCREENSHOT"
  echo ""

  # Run audit
  echo "▶ Running audit..."
  AUDIT_REPORT="$REPORTS_DIR/audit_${ITERATION}.json"

  if ./audit-agent.sh \
    --url "$URL" \
    --criteria "$CRITERIA" \
    --screenshot "$SCREENSHOT" \
    2>&1 | tee "$REPORTS_DIR/audit_${ITERATION}.log"; then

    # Audit passed
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                  🎉  ALL CLEAR — AUDIT PASSED                                ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Task:     $TASK"
    echo "  Loops:    $ITERATION"
    echo "  Report:   $AUDIT_REPORT"
    echo ""
    echo "  Your changes have been validated and approved."
    echo ""
    exit 0
  else
    # Audit failed
    echo ""
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                  ⚠️  AUDIT FAILED — CHANGES NEEDED                           ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Review the failures above."
    echo "  Make your code changes, then this loop will automatically retry."
    echo ""

    if [[ $ITERATION -lt $MAX_ITERATIONS ]]; then
      read -r -p "  Press ENTER when ready to re-audit (or Ctrl+C to abort)..."
    else
      echo "  ❌ Max iterations reached. Audit did not pass."
      echo ""
      echo "  Final report: $AUDIT_REPORT"
      echo "  Log file:     $REPORTS_DIR/audit_${ITERATION}.log"
      echo ""
      exit 1
    fi
  fi
done
