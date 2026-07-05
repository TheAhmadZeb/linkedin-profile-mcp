# LinkedIn Profile MCP Editor

An MCP-compatible tool that reads and edits LinkedIn profiles through browser automation. Designed for AI agents to maintain professional profiles programmatically — update headlines, rewrite summaries, add experience entries, manage projects, and sync portfolios without manual browser interaction.

## Features

- **25+ editable fields** across profile sections: intro, about, experience, education, skills, projects, achievements
- **Persistent session** — one-time login, no repeated authentication
- **Headless Chrome** — runs on GPU-less servers, VPS, or containers
- **MCP integration** — callable as a tool from any MCP client (Claude Desktop, Cursor, Hermes Agent, custom apps)
- **Field-level operations** — read or write individual fields with a single command
- **Safe rollback** — test mode reads, writes, and restores to verify without permanent changes

## Quick Start

### Prerequisites

- Node.js 18+
- Google Chrome or Chromium installed
- A LinkedIn account

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/linkedin-profile-mcp.git
cd linkedin-profile-mcp

# Install dependencies
npm install

# One-time login (opens Chrome — complete the sign-in manually)
npx linkedin-mcp --login
```

### Usage

**Run as MCP server (stdio):**
```bash
linkedin-mcp
```

**Edit specific fields:**
```bash
node edit-profile.js set headline "Your New Headline"
node edit-profile.js set about "Your updated summary text"
node edit-profile.js get headline
```

**Test mode** (modifies and reverts automatically):
```bash
node edit-profile.js test
```

**List all available fields:**
```bash
node edit-profile.js list
```

### Adding Experience or Education

```bash
# New experience entry
node edit-profile.js add-exp \
  --title "Software Engineer" \
  --company "ACME Corp" \
  --start-month "January" \
  --start-year "2024" \
  --description "Led development of..."

# New education entry
node edit-profile.js add-edu \
  --school "University of Example" \
  --degree "BSc Computer Science" \
  --start-year "2018" \
  --end-year "2022"
```

## Integration with MCP Clients

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "linkedin-profile": {
      "command": "npx",
      "args": ["linkedin-mcp"]
    }
  }
}
```

### Hermes Agent

Register as an external tool:

```bash
hermes tools add linkedin-profile \
  --command "npx linkedin-mcp" \
  --stdio
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "linkedin-profile": {
      "command": "npx",
      "args": ["linkedin-mcp"]
    }
  }
}
```

## Architecture

```
┌──────────────┐     stdio/json      ┌─────────────────┐
│   MCP Client  │ ◄─────────────────► │  linkedin-mcp   │
│ (AI Agent)    │                     │  (MCP Server)    │
└──────────────┘                     └────────┬────────┘
                                              │
                                    Playwright API
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │  Headless Chrome │
                                     │ (Persistent Ssn) │
                                     └─────────────────┘
                                              │
                                              ▼
                                     ┌─────────────────┐
                                     │ linkedin.com     │
                                     │ Profile Pages   │
                                     └─────────────────┘
```

The system works in two layers:
1. **`linkedin-mcp`** (npm package) handles authentication, session persistence, and basic profile queries
2. **`edit-profile.js`** (this repo) provides field-level read/write operations, a full field map, and convenience commands

## Field Map

See [docs/field-map.md](docs/field-map.md) for the complete list of 25+ editable fields across all profile sections.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `LINKEDIN_PROFILE_DIR` | `~/.linkedin-mcp/profile` | Browser profile directory for persistent session |
| `LINKEDIN_HEADLESS` | `false` | Run Chrome in headless mode |
| `LINKEDIN_VANITY` | *(required)* | Your LinkedIn vanity URL slug |

### Headless Mode

For server environments without a GPU:

```bash
export LINKEDIN_HEADLESS=true
export DISPLAY=:99   # if using Xvfb
linkedin-mcp
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Chrome crashes on GPU-less server | Set `--disable-gpu --enable-unsafe-swiftshader` in launch args |
| Session not persisting | Verify `LINKEDIN_PROFILE_DIR` points to a writable directory |
| "Submit button disabled" | LinkedIn validates specific fields; ensure required fields are filled |
| Login page shows Cloudflare | Login from a headed browser first, profile will persist for headless sessions |

## Why This Exists

LinkedIn has no official write API for profile data. The Partner Program grants write access but is locked behind approval and usage minimums. This project bridges that gap with browser automation — giving AI agents the ability to maintain professional profiles without manual editing.

It's useful for:
- **Portfolio automation** — sync projects from GitHub to LinkedIn
- **Career management** — batch-update profiles across platforms
- **AI agents** — let your assistant keep your professional presence current

## License

MIT
