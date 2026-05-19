#!/bin/bash
# Auth Helper: Save and reuse authenticated sessions
# Usage:
#   ./scripts/agent-browser/auth-helper.sh save    # Save current auth state
#   ./scripts/agent-browser/auth-helper.sh load    # Load saved auth state

set -e

ACTION=${1:-save}
BASE_URL="http://localhost:8080"
STATE_FILE="./.agent-browser-auth.json"

if [ "$ACTION" = "save" ]; then
  echo "Launching browser for manual login..."
  echo "Please log in manually, then press Enter to save auth state."
  
  agent-browser --headed --session-name auth open "$BASE_URL"
  
  read -p "Press Enter after logging in..."
  
  agent-browser state save "$STATE_FILE"
  agent-browser close
  
  echo "Auth state saved to $STATE_FILE"
  echo "Add $STATE_FILE to .gitignore!"
  
elif [ "$ACTION" = "load" ]; then
  if [ ! -f "$STATE_FILE" ]; then
    echo "No saved auth state found at $STATE_FILE"
    echo "Run: $0 save"
    exit 1
  fi
  
  echo "Loading auth state from $STATE_FILE..."
  agent-browser --state "$STATE_FILE" open "$BASE_URL"
  echo "Logged in using saved auth state!"
  
else
  echo "Usage: $0 [save|load]"
  exit 1
fi
