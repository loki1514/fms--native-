#!/bin/bash
# Visual Regression Testing
# Compares current UI against baseline screenshots
# Usage: ./scripts/agent-browser/visual-regression.sh [capture|compare]

set -e

MODE=${1:-capture}
BASE_URL="http://localhost:8080"
BASELINE_DIR="./screenshots/baseline"
CURRENT_DIR="./screenshots/current"
DIFF_DIR="./screenshots/diffs"

mkdir -p "$BASELINE_DIR" "$CURRENT_DIR" "$DIFF_DIR"

# Define pages to test
PAGES=(
  "/"
  "/dashboard"
  "/leads"
  "/properties"
  "/pipeline"
  "/campaigns"
  "/payroll"
  "/settings"
)

if [ "$MODE" = "capture" ]; then
  echo "Capturing baseline screenshots..."
  TARGET_DIR="$BASELINE_DIR"
elif [ "$MODE" = "compare" ]; then
  echo "Capturing current screenshots for comparison..."
  TARGET_DIR="$CURRENT_DIR"
else
  echo "Usage: $0 [capture|compare]"
  exit 1
fi

agent-browser --session-name vrt open "$BASE_URL"

for page in "${PAGES[@]}"; do
  PAGE_NAME=$(echo "$page" | sed 's|^/|home|' | sed 's|/|_|g')
  [ -z "$PAGE_NAME" ] && PAGE_NAME="home"
  
  echo "-> $page"
  agent-browser open "${BASE_URL}${page}"
  agent-browser wait --load networkidle
  agent-browser screenshot --full "$TARGET_DIR/${PAGE_NAME}.png"
done

agent-browser close

echo "Screenshots saved to $TARGET_DIR"

# If comparing, run diff
if [ "$MODE" = "compare" ]; then
  echo ""
  echo "Running visual diffs..."
  HAS_DIFF=0
  
  for page in "${PAGES[@]}"; do
    PAGE_NAME=$(echo "$page" | sed 's|^/|home|' | sed 's|/|_|g')
    [ -z "$PAGE_NAME" ] && PAGE_NAME="home"
    
    BASELINE="$BASELINE_DIR/${PAGE_NAME}.png"
    CURRENT="$CURRENT_DIR/${PAGE_NAME}.png"
    DIFF="$DIFF_DIR/${PAGE_NAME}-diff.png"
    
    if [ -f "$BASELINE" ] && [ -f "$CURRENT" ]; then
      if agent-browser diff screenshot --baseline "$BASELINE" -o "$DIFF" 2>/dev/null; then
        echo "  $page: No visual changes"
      else
        echo "  $page: Visual differences detected! -> $DIFF"
        HAS_DIFF=1
      fi
    else
      echo "  $page: Missing baseline or current screenshot"
    fi
  done
  
  if [ $HAS_DIFF -eq 1 ]; then
    echo ""
    echo "Visual differences found! Check $DIFF_DIR"
    exit 1
  else
    echo "No visual differences detected."
  fi
fi
