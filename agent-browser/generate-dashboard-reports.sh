#!/bin/bash
# Generate Dashboard Screenshots & PDFs for Reports
# Usage: ./scripts/agent-browser/generate-dashboard-reports.sh [local|staging|prod]

set -e

ENV=${1:-local}
BASE_URL="http://localhost:8080"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
REPORT_DIR="./reports/$DATE"
mkdir -p "$REPORT_DIR"

if [ "$ENV" = "staging" ]; then
  BASE_URL="https://staging.office-optima.com"
elif [ "$ENV" = "prod" ]; then
  BASE_URL="https://office-optima.com"
fi

echo "Generating reports from $BASE_URL..."

# Launch with session persistence for logged-in state
agent-browser --session-name reports open "$BASE_URL"

# 1. Dashboard
echo "-> Screenshot Dashboard..."
agent-browser open "$BASE_URL/dashboard"
agent-browser wait --load networkidle
agent-browser screenshot --full "$REPORT_DIR/dashboard.png"

# 2. Leads Page
echo "-> Screenshot Leads..."
agent-browser open "$BASE_URL/leads"
agent-browser wait --load networkidle
agent-browser screenshot --full "$REPORT_DIR/leads.png"

# 3. Properties Page
echo "-> Screenshot Properties..."
agent-browser open "$BASE_URL/properties"
agent-browser wait --load networkidle
agent-browser screenshot --full "$REPORT_DIR/properties.png"

# 4. Pipeline
echo "-> Screenshot Pipeline..."
agent-browser open "$BASE_URL/pipeline"
agent-browser wait --load networkidle
agent-browser screenshot --full "$REPORT_DIR/pipeline.png"

# 5. Generate PDF of current page (Pipeline)
echo "-> Saving Pipeline as PDF..."
agent-browser pdf "$REPORT_DIR/pipeline.pdf"

# Cleanup
agent-browser close

echo ""
echo "Reports saved to $REPORT_DIR"
ls -la "$REPORT_DIR"
