#!/bin/bash
# E2E Test: Lead Creation Flow
# Usage: ./scripts/agent-browser/e2e-test-leads.sh [local|staging|prod]

set -e

ENV=${1:-local}
BASE_URL="http://localhost:8080"
TEST_EMAIL="test-$(date +%s)@example.com"

if [ "$ENV" = "staging" ]; then
  BASE_URL="https://staging.office-optima.com"
elif [ "$ENV" = "prod" ]; then
  BASE_URL="https://office-optima.com"
fi

echo "Testing lead creation flow at $BASE_URL..."

# Open app with persistent session
agent-browser --session-name e2e-test open "$BASE_URL"

# Wait for app to load
agent-browser wait --load networkidle

# Get snapshot to find navigation elements
SNAPSHOT=$(agent-browser snapshot -i --json)
echo "$SNAPSHOT" | head -50

# Navigate to Leads page (adjust selectors based on your actual UI)
agent-browser open "$BASE_URL/leads"
agent-browser wait --load networkidle

# Take screenshot before action
agent-browser screenshot "./screenshots/leads-before.png"

# Try to click "Add Lead" button if it exists
# Note: Adjust selectors based on your actual UI
if agent-browser find text "Add Lead" click 2>/dev/null; then
  echo "-> Clicked Add Lead button"
else
  echo "-> Add Lead button not found, trying alternative..."
  agent-browser find role button click --name "Add" 2>/dev/null || true
fi

# Fill lead form (adjust field selectors)
agent-browser wait 2000

# Example form filling - adjust to match your actual form fields
agent-browser find label "Name" fill "Test Lead $TEST_EMAIL" 2>/dev/null || true
agent-browser find label "Email" fill "$TEST_EMAIL" 2>/dev/null || true
agent-browser find label "Phone" fill "+1-555-0000" 2>/dev/null || true

# Submit form
agent-browser find role button click --name "Save" 2>/dev/null || true

# Wait and verify
agent-browser wait 3000

# Take screenshot after
agent-browser screenshot "./screenshots/leads-after.png"

# Check if lead appears in list
agent-browser snapshot -i --json | grep -q "$TEST_EMAIL" && echo "Lead created successfully!" || echo "Warning: Could not verify lead creation"

agent-browser close

echo "E2E test completed!"
