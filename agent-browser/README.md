# 🤖 Agent Browser Workflow

Automated **Dev → Test → Audit → Iterate** loop for the Autopilot mobile/web app.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   You give  │────▶│  AI Agent   │────▶│   Writes    │────▶│  Dev Loop   │
│    task     │     │   (Kimi)    │     │   code      │     │  validates  │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                                                                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Iterate   │◀────│   Review    │◀────│   Audit     │◀────│  Screenshot │
│   & fix     │     │   feedback  │     │   Agent     │     │  + snapshot │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Scripts

| Script | Purpose |
|--------|---------|
| `audit-agent.sh` | Validates a page against acceptance criteria (text presence, layout checks, URL patterns) |
| `dev-loop.sh` | Master orchestrator: logs in → audits → loops until pass |
| `auth-helper.sh` | Save/load authenticated browser sessions |
| `smoke-test.sh` | Quick health check |
| `visual-regression.sh` | Screenshot diff testing |
| `generate-dashboard-reports.sh` | Auto-capture dashboard screenshots/PDFs |
| `competitor-research.sh` | Market intel scraper |
| `e2e-test-leads.sh` | E2E lead creation test |

## Quick Start

### 1. One-shot audit (check a page now)

```bash
cd agent-browser

# Check if sidebar is hidden on mobile dashboard
./audit-agent.sh \
  --url "http://localhost:8081/property/PROP-001/dashboard" \
  --criteria "sidebar is hidden; hamburger menu visible" \
  --screenshot ./screenshots/audit-result.png
```

**Exit code 0** = passed. **Exit code 1** = failed with detailed feedback.

### 2. Full dev loop (build → test → audit → iterate)

```bash
./dev-loop.sh \
  --task "Hide sidebar, add hamburger menu, stack cards vertically" \
  --url "http://localhost:8081/property/PROP-001/dashboard" \
  --criteria "sidebar is hidden; hamburger menu visible; cards stacked vertically" \
  --max-iterations 5
```

The loop will:
1. Log in (or reuse saved auth)
2. Open the target page
3. Run audit with your criteria
4. If **PASS** → done, you're cleared
5. If **FAIL** → shows feedback, waits for you to fix code, auto-retries

### 3. Save auth once, reuse forever

```bash
./auth-helper.sh save   # Opens browser, you log in manually, press Enter
./auth-helper.sh load   # Reuses saved session
```

Saved to `./.agent-browser-auth.json` (add to `.gitignore`).

## Audit Criteria Syntax

Semicolon-separated checks. The audit agent understands these patterns:

| Pattern | Example | What it checks |
|---------|---------|----------------|
| `page shows "text"` | `page shows "SS Plaza"` | Text exists in page snapshot |
| `no "text"` | `no "sidebar"` | Text is absent |
| `sidebar is hidden` | `sidebar is hidden` | Sidebar element not visible |
| `cards are stacked` | `cards are stacked` | Cards in `flex-direction: column` |
| `url contains "pattern"` | `url contains "dashboard"` | Current URL matches |
| Any text | `"Welcome Back"` | Generic text presence |

## Example: Complete Workflow

```bash
# You say: "Fix the dashboard cards - make them full width and reduce font size"

# Step 1: AI agent writes the code changes (I do this)

# Step 2: Run the dev loop to validate
./dev-loop.sh \
  --task "Stack Checklist/Health cards, reduce bigNumber font" \
  --url "http://localhost:8081/property/79ba1aa5-bf91-4956-9dbe-ce9986790b53/dashboard" \
  --criteria "page shows 'Checklist'; page shows 'Health'; no text wrapping; cards stacked vertically" \
  --max-iterations 5

# Step 3: If audit passes → done. If fails → I fix, you press Enter, loop repeats.
```

## Output Locations

```
agent-browser/
├── screenshots/           # All captured screenshots
├── audit-reports/         # JSON reports + logs per iteration
│   ├── audit_20250107_143022.json
│   ├── audit_20250107_143022.log
│   └── iteration_1.png
└── .agent-browser-auth.json   # Saved login session (gitignored)
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Audit passed / All clear |
| 1 | Audit failed (criteria not met) |
| 2 | Error (could not run) |
