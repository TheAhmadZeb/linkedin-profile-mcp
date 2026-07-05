# How It Works

## Overview

LinkedIn does not provide a public write API for profile data. The LinkedIn Partner Program grants write access, but approval is restricted and requires minimum usage volumes. This project works around that limitation using **browser automation** — launching a real Chrome instance, logging in once, and automating form interactions via Playwright.

## Two-Layer Architecture

### Layer 1: Session Management (via `linkedin-mcp`)

The npm package `linkedin-mcp` handles:

- **Browser launch** — starts Chrome with a persistent user profile directory
- **Login flow** — `--login` opens a headed browser window for one-time manual sign-in
- **Session persistence** — cookies, local storage, and Cloudflare clearance survive across restarts because Chrome writes them to a `--user-data-dir`
- **Cloudflare bypass** — the persistent profile retains whatever Cloudflare challenge clears on first login, so headless sessions don't get challenged again
- **MCP protocol** — exposes tools (`get_profile`, `search_people`, `create_post`, etc.) over stdio or HTTP

### Layer 2: Field-Level Editing (this repo's `edit-profile.js`)

The script in this repo provides:

- **Field map** — a curated mapping of form fields on LinkedIn's edit pages, indexed by their position on the page
- **Direct page navigation** — goes straight to each edit form URL (`/in/{vanity}/edit/forms/{type}/new/`)
- **Typed input** — uses `fill()` for text inputs, `selectOption()` for dropdowns, `type()` with delay for contenteditable divs (better React compatibility than `fill()`)
- **Save detection** — looks for the Save button and clicks it, with a post-save wait for LinkedIn's async persistence

## How Session Persistence Works

```
First run (--login):
  Chrome launches (headed)
  ├─ User signs in manually
  ├─ LinkedIn sets cookies (li_at, JSESSIONID, etc.)
  ├─ Cloudflare challenge is solved
  └─ Everything saved to ~/.linkedin-mcp/profile/

Subsequent runs:
  Chrome launches (headless or headed)
  └─ Reuses ~/.linkedin-mcp/profile/
     ├─ Cookies still valid (hours to days)
     ├─ Cloudflare clearance still cached
     └─ No login needed until session expires
```

Chrome's `--user-data-dir` stores:
- Cookies (encrypted at rest, decrypted by the browser process)
- Local storage
- Cache
- Extension data

Playwright's `launchPersistentContext()` reuses this directory, so the session survives browser restarts.

## Headless Mode

On GPU-less servers, headed Chrome crashes because Xvfb can't provide GPU acceleration. The script handles this with:

```javascript
headless: true,
args: [
  '--no-sandbox',
  '--disable-gpu',
  '--disable-blink-features=AutomationControlled',
  '--enable-unsafe-swiftshader',
]
```

- `--disable-gpu`: prevents Chrome from trying to initialise a GPU process that doesn't exist
- `--enable-unsafe-swiftshader`: software GPU emulation for WebGL-dependent pages
- `--disable-blink-features=AutomationControlled`: removes some headless detection fingerprints

## The Field Map Approach

Each LinkedIn edit page has a predictable URL pattern and form layout. The field map stores the position index of each field on its page:

```javascript
const FIELD_MAP = {
  intro: [
    { idx: 0, name: 'first_name', tag: 'INPUT', label: 'First name*' },
    { idx: 3, name: 'pronouns',   tag: 'SELECT', label: 'Pronouns' },
    { idx: 4, name: 'headline',   tag: 'DIV',    label: 'Headline', contenteditable: true },
    // ...
  ],
};
```

The script uses `page.locator('input, textarea, select, [contenteditable]').nth(idx)` to target the right field. This is fragile — if LinkedIn changes its form layout, indexes shift — but it's the most reliable approach without page-specific selectors for every field.

## Writing Fields

1. Navigate to the edit page URL
2. Wait for the DOM to settle (2.5s)
3. Find the field by its index in the visible input list
4. Clear and fill the field (or select option, or toggle checkbox)
5. Click the Save button
6. Wait for persistence (3s)

## Known Limitations

- **Form validation** — LinkedIn's React forms sometimes keep the Submit button disabled until specific field combinations are filled. Adding a project entry, for example, seems to require project name + association + at least one skill before submission works
- **Index brittleness** — field indices are positional. A LinkedIn UI update can shift everything
- **Rate limiting** — LinkedIn may temporarily restrict rapid edits. Space operations by 3-5 seconds
- **Session expiry** — sessions last hours to days depending on LinkedIn's cookie policy. When they expire, run `linkedin-mcp --login` again
- **No rich formatting** — contenteditable fields accept text input, but bold/italic/bullet formatting isn't preserved through the script
