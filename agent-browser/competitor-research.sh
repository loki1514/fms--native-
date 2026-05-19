#!/bin/bash
# Competitor Research / Market Intelligence Scraper
# Scrapes competitor property/coworking sites for pricing intel
# Usage: ./scripts/agent-browser/competitor-research.sh

set -e

RESEARCH_DIR="./research/$(date +%Y-%m-%d)"
mkdir -p "$RESEARCH_DIR"

echo "Starting competitor research..."

# Example: Research WeWork pricing (adjust URLs to actual competitors)
COMPETITORS=(
  "https://www.wework.com"
  "https://www.regus.com"
)

for url in "${COMPETITORS[@]}"; do
  DOMAIN=$(echo "$url" | sed 's|https://||' | sed 's|www.||' | cut -d'/' -f1)
  echo "-> Researching $DOMAIN..."
  
  agent-browser --session-name research open "$url"
  agent-browser wait --load networkidle
  
  # Accept cookies if prompt appears
  agent-browser find text "Accept" click 2>/dev/null || true
  agent-browser find text "Allow" click 2>/dev/null || true
  agent-browser find text "Got it" click 2>/dev/null || true
  
  # Take screenshots
  agent-browser screenshot --full "$RESEARCH_DIR/${DOMAIN}-homepage.png"
  
  # Try to find pricing page
  if agent-browser find text "Pricing" click 2>/dev/null; then
    agent-browser wait --load networkidle
    agent-browser screenshot --full "$RESEARCH_DIR/${DOMAIN}-pricing.png"
    
    # Extract pricing text
    PRICING_TEXT=$(agent-browser get text body --json 2>/dev/null | grep -o '"data":"[^"]*"' | head -1 || true)
    echo "$PRICING_TEXT" > "$RESEARCH_DIR/${DOMAIN}-pricing.txt"
  fi
  
  # Save page as PDF
  agent-browser pdf "$RESEARCH_DIR/${DOMAIN}.pdf"
  
  agent-browser close
  echo "  Saved to $RESEARCH_DIR/${DOMAIN}.*"
done

echo ""
echo "Research complete! Files saved to $RESEARCH_DIR"
