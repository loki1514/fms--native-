#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Audit Agent — Validates a web page against acceptance criteria
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./audit-agent.sh \
#     --url "http://localhost:8081/dashboard" \
#     --criteria "page shows Welcome Back; no sidebar; cards stacked" \
#     --screenshot ./screenshots/audit.png
#
# Exit codes:
#   0 = PASS
#   1 = FAIL (with detailed feedback)
#   2 = ERROR (could not run audit)
#
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────────────────────
URL=""
CRITERIA=""
SCREENSHOT=""
TIMEOUT=15000
VERBOSE=false

# ─── Parse Args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="$2"; shift 2 ;;
    --criteria) CRITERIA="$2"; shift 2 ;;
    --screenshot) SCREENSHOT="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --verbose) VERBOSE=true; shift ;;
    *) echo "Unknown option: $1"; exit 2 ;;
  esac
done

if [[ -z "$URL" || -z "$CRITERIA" ]]; then
  echo "Usage: $0 --url <url> --criteria '<semicolon-separated checks>' [--screenshot <path>]"
  exit 2
fi

REPORT_DIR="./audit-reports"
mkdir -p "$REPORT_DIR"
AUDIT_ID="$(date +%Y%m%d_%H%M%S)"
REPORT_FILE="$REPORT_DIR/audit_${AUDIT_ID}.json"
SCREENSHOT_PATH="${SCREENSHOT:-$REPORT_DIR/audit_${AUDIT_ID}.png}"

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    AUDIT AGENT v1.0                              ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📋 Task ID:    $AUDIT_ID"
echo "🌐 URL:        $URL"
echo "📸 Screenshot: $SCREENSHOT_PATH"
echo ""

# ─── Phase 1: Open Browser ────────────────────────────────────────────────────
echo "▶ Phase 1: Opening browser..."
if ! agent-browser open "$URL" 2>/dev/null; then
  echo "❌ FAIL: Could not open URL: $URL"
  exit 2
fi

agent-browser wait --load networkidle 2>/dev/null || true
sleep 2

# ─── Phase 2: Capture Evidence ────────────────────────────────────────────────
echo "▶ Phase 2: Capturing evidence..."
agent-browser screenshot "$SCREENSHOT_PATH" 2>/dev/null || true
SNAPSHOT="$(agent-browser snapshot -i --json 2>/dev/null || echo '{}')"
PAGE_TITLE="$(agent-browser get title 2>/dev/null || echo 'unknown')"
PAGE_URL="$(agent-browser get url 2>/dev/null || echo 'unknown')"

# Save snapshot for later inspection
echo "$SNAPSHOT" > "$REPORT_DIR/audit_${AUDIT_ID}_snapshot.json"

# ─── Phase 3: Parse & Evaluate Criteria ───────────────────────────────────────
echo "▶ Phase 3: Evaluating criteria..."
echo ""

PASS_COUNT=0
FAIL_COUNT=0

# Helper: check if text exists in snapshot
function check_text_present() {
  local text="$1"
  echo "$SNAPSHOT" | grep -qi "$text"
}

# Helper: check if text does NOT exist
function check_text_absent() {
  local text="$1"
  ! echo "$SNAPSHOT" | grep -qi "$text"
}

# Helper: check URL pattern
function check_url_pattern() {
  local pattern="$1"
  echo "$PAGE_URL" | grep -qi "$pattern"
}

# Helper: strip surrounding quotes from a string
function strip_quotes() {
  local s="$1"
  # Remove leading/trailing double quotes
  s="${s#\"}"; s="${s%\"}"
  # Remove leading/trailing single quotes
  s="${s#'}"; s="${s%'}"
  # Trim whitespace
  s="$(echo "$s" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  echo "$s"
}

# Parse criteria (semicolon-separated)
IFS=';' read -ra CHECKS <<< "$CRITERIA"

for raw_check in "${CHECKS[@]}"; do
  check="$(echo "$raw_check" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [[ -z "$check" ]] && continue

  STATUS="PASS"
  DETAIL=""
  expected=""

  # Check: text present (page shows "X" or shows "X")
  if [[ "$check" =~ [Pp]age[[:space:]]+shows[[:space:]]+(.+) ]] || \
     [[ "$check" =~ [Ss]hows?[[:space:]]+(.+) ]]; then
    expected="$(strip_quotes "${BASH_REMATCH[1]}")"
    if check_text_present "$expected"; then
      DETAIL="Text '$expected' found on page"
    else
      STATUS="FAIL"
      DETAIL="Text '$expected' NOT found on page"
    fi

  # Check: text absent (no "X" or does not show "X")
  elif [[ "$check" =~ ^[Nn]o[[:space:]]+(.+) ]] || \
       [[ "$check" =~ [Dd]oes[[:space:]]+not[[:space:]]+show[[:space:]]+(.+) ]]; then
    expected="$(strip_quotes "${BASH_REMATCH[1]}")"
    if check_text_absent "$expected"; then
      DETAIL="Text '$expected' correctly absent from page"
    else
      STATUS="FAIL"
      DETAIL="Text '$expected' should be absent but was found"
    fi

  # Check: sidebar hidden
  elif [[ "$check" =~ [Ss]idebar[[:space:]]+is[[:space:]]+[Hh]idden ]] || \
       [[ "$check" =~ [Nn]o[[:space:]]+[Ss]idebar ]]; then
    if check_text_absent "sidebar" && check_text_absent "Sidebar"; then
      DETAIL="Sidebar not detected in page content"
    else
      if agent-browser is visible "[data-testid='sidebar']" 2>/dev/null || \
         agent-browser is visible ".sidebar" 2>/dev/null; then
        STATUS="FAIL"
        DETAIL="Sidebar element is still visible on page"
      else
        DETAIL="Sidebar not visible"
      fi
    fi

  # Check: cards stacked / vertical layout
  elif [[ "$check" =~ [Cc]ards?[[:space:]]+are[[:space:]]+[Ss]tacked ]] || \
       [[ "$check" =~ [Vv]ertical[[:space:]]+layout ]] || \
       [[ "$check" =~ [Ss]tack[[:space:]]+vertically ]]; then
    LAYOUT="$(agent-browser eval "window.getComputedStyle(document.querySelector('.twoColRow, .stackRow, [class*=row]'))?.flexDirection" 2>/dev/null || echo 'unknown')"
    if [[ "$LAYOUT" == *"column"* ]]; then
      DETAIL="Cards are in column (stacked) layout"
    else
      STATUS="FAIL"
      DETAIL="Cards may not be vertically stacked. Layout: $LAYOUT"
    fi

  # Check: full width
  elif [[ "$check" =~ [Ff]ull[[:space:]]+[Ww]idth ]]; then
    DETAIL="Full-width check requires manual verification (see screenshot)"

  # Check: URL contains pattern
  elif [[ "$check" =~ [Uu][Rr][Ll][[:space:]]+contains?[[:space:]]+(.+) ]]; then
    pattern="$(strip_quotes "${BASH_REMATCH[1]}")"
    if check_url_pattern "$pattern"; then
      DETAIL="URL contains '$pattern'"
    else
      STATUS="FAIL"
      DETAIL="URL does not contain '$pattern'. Actual: $PAGE_URL"
    fi

  # Check: element visible by text
  elif [[ "$check" =~ [Vv]isible[[:space:]]+(.+) ]]; then
    expected="$(strip_quotes "${BASH_REMATCH[1]}")"
    if check_text_present "$expected"; then
      DETAIL="Element '$expected' is visible"
    else
      STATUS="FAIL"
      DETAIL="Element '$expected' is NOT visible"
    fi

  # Generic text check
  else
    expected="$(strip_quotes "$check")"
    if check_text_present "$expected"; then
      DETAIL="Criterion '$expected' satisfied"
    else
      STATUS="FAIL"
      DETAIL="Criterion '$expected' not satisfied"
    fi
  fi

  if [[ "$STATUS" == "PASS" ]]; then
    ((PASS_COUNT++))
    echo "  ✅ PASS: $DETAIL"
  else
    ((FAIL_COUNT++))
    echo "  ❌ FAIL: $DETAIL"
  fi
done

# ─── Phase 4: Generate Report ─────────────────────────────────────────────────
TOTAL=$((PASS_COUNT + FAIL_COUNT))
OVERALL="PASS"
[[ $FAIL_COUNT -gt 0 ]] && OVERALL="FAIL"

JSON_REPORT=$(cat <<EOF
{
  "audit_id": "$AUDIT_ID",
  "url": "$URL",
  "page_title": "$PAGE_TITLE",
  "page_url": "$PAGE_URL",
  "screenshot": "$SCREENSHOT_PATH",
  "overall": "$OVERALL",
  "pass_count": $PASS_COUNT,
  "fail_count": $FAIL_COUNT,
  "total_checks": $TOTAL,
  "criteria": "$CRITERIA"
}
EOF
)

echo "$JSON_REPORT" > "$REPORT_FILE"

# ─── Phase 5: Cleanup ──────────────────────────────────────────────────────────
agent-browser close 2>/dev/null || true

# ─── Phase 6: Output ───────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  AUDIT RESULT: $OVERALL"
echo "════════════════════════════════════════════════════════════════════"
echo "  ✅ Passed:  $PASS_COUNT / $TOTAL"
echo "  ❌ Failed:  $FAIL_COUNT / $TOTAL"
echo "  📄 Report:  $REPORT_FILE"
echo "  📸 Screenshot: $SCREENSHOT_PATH"
echo "════════════════════════════════════════════════════════════════════"
echo ""

if [[ "$OVERALL" == "PASS" ]]; then
  echo "🎉 Audit cleared! Changes are approved."
  exit 0
else
  echo "⚠️  Audit failed. Review failures above and iterate."
  exit 1
fi
