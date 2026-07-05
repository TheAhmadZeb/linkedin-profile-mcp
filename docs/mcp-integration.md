# MCP Integration Guide

This document explains how to integrate the LinkedIn Profile Editor with any MCP-compatible client.

## What is MCP?

The Model Context Protocol (MCP) is an open standard that lets AI assistants call external tools through a structured interface. A tool exposes its capabilities as named functions with typed parameters, and the AI calls them as needed.

## Integration Methods

### Method 1: Direct MCP Server (Recommended)

The `linkedin-mcp` package itself is an MCP server. Run it and any MCP client can call its tools.

```json
{
  "mcpServers": {
    "linkedin-profile": {
      "command": "npx",
      "args": ["linkedin-mcp"],
      "env": {
        "LINKEDIN_HEADLESS": "true"
      }
    }
  }
}
```

Available tools:
- `get_my_profile` — fetch your full profile data
- `search_people` — search LinkedIn users
- `search_jobs` — search job listings
- `send_message` — send a LinkedIn message
- `create_post` — create a text/image post

Limitation: does not include profile write tools.

### Method 2: Playwright MCP + This Script

For full profile editing capabilities, combine a Playwright MCP server with the `edit-profile.js` script:

**Playwright MCP config:**
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic-ai/mcp-playwright"],
      "env": {
        "PLAYWRIGHT_USER_DATA_DIR": "/path/to/linkedin-profile"
      }
    }
  }
}
```

Then the AI can use Playwright's browser tools to navigate LinkedIn's edit pages and fill forms directly.

### Method 3: External Tool (Hermes Agent)

Register the script as an external tool:

```bash
hermes tools add linkedin-profile \
  --command "node /path/to/edit-profile.js" \
  --stdio
```

This exposes the script's `get`, `set`, `list`, `test` commands as Hermes tools that the agent can call with natural language.

## Configuration Reference

| Setting | Value | Notes |
|---------|-------|-------|
| Transport | stdio | Simpler than HTTP; no port conflicts |
| Session directory | `~/.linkedin-mcp/profile` | Created by first `--login` |
| Auth method | Manual login (one-time) | No tokens to paste |
| Chrome requirement | Google Chrome installed | Chromium works if aliased to `chrome` |

## Testing Your Integration

```bash
# Verify the MCP server starts
npx linkedin-mcp --status

# Test field editing
LINKEDIN_VANITY=your-vanity node edit-profile.js list
LINKEDIN_VANITY=your-vanity node edit-profile.js get headline

# Safe test (modifies + reverts)
LINKEDIN_VANITY=your-vanity node edit-profile.js test
```
