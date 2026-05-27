#!/bin/bash
# Smoke Test Suite for Office Optima Suite
# Usage: ./scripts/agent-browser/smoke-test.sh [local|staging|prod]

set -e

ENV=${1:-local}
BASE_URL="http://localhost:8080"

if [ "$ENV" = "staging" ]; then
  BASE_URL="https://staging.office-optima.com"
elif [ "$ENV" = "prod" ]; then
  BASE_URL="https://office-optima.com"
fi

echo "Running smoke tests against $BASE_URL..."

# 1. Open app and check login page
echo "-> Checking auth page..."
agent-browser open "$BASE_URL"
agent-browser wait "button" --timeout 5000
SNAPSHOT=$(agent-browser snapshot -i --json)
echo "$SNAPSHOT" | grep -q "Login\|Sign In\|Email" && echo "  Auth page loaded" || (echo "  FAIL: Auth page not loaded" && exit 1)

# 2. Screenshot the login page
echo "-> Taking login screenshot..."
agent-browser screenshot "./screenshots/01-login.png"

# 3. Test navigation to various public pages if any
# (Skip if auth is required everywhere)

# 4. Check page title
echo "-> Checking page title..."
TITLE=$(agent-browser get title --json | grep -o '"data":"[^"]*"' | cut -d'"' -f4)
echo "  Page title: $TITLE"

# 5. Close browser
echo "-> Closing browser..."
agent-browser close

echo ""
echo "Smoke tests passed!"
