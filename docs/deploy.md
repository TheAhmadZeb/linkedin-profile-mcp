# Deployment Guide

Deploying the LinkedIn Profile Editor to a fresh server (VPS, dedicated server, container, Raspberry Pi — anywhere you don't have a graphical desktop). This guide walks through every step from bare-metal to a running, authenticated MCP server.

---

## Table of Contents

1. [Prerequisites: Server Prep](#1-prerequisites-server-prep)
2. [Clone & Install](#2-clone--install)
3. [Authentication: The Tricky Part](#3-authentication-the-tricky-part)
   - [Option A: Xvfb + VNC (all on one machine)](#option-a-xvfb--vnc-all-on-one-machine)
   - [Option B: Copy Profile from Another Machine](#option-b-copy-profile-from-another-machine)
   - [Option C: SSH X11 Forwarding](#option-c-ssh-x11-forwarding)
4. [Running the MCP Server](#4-running-the-mcp-server)
   - [Quick Test (Foreground)](#quick-test-foreground)
   - [Systemd Service (Persistent)](#systemd-service-persistent)
   - [Docker (Containerised)](#docker-containerised)
5. [Field Editing on a Server](#5-field-editing-on-a-server)
6. [Session Management](#6-session-management)
7. [Troubleshooting Common Deployment Issues](#7-troubleshooting-common-deployment-issues)

---

## 1. Prerequisites: Server Prep

### Node.js

The `linkedin-mcp` package and the editor script require Node.js 18 or later. Node.js 22 LTS is the safest bet.

**Ubuntu / Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs git
node --version   # Should show v22.x
```

**Other distros:**
```bash
# Fedora / RHEL
sudo dnf install -y nodejs git

# Arch
sudo pacman -S nodejs git

# Alpine (Docker)
apk add nodejs git
```

### Chrome / Chromium

The automation needs a real Chrome or Chromium browser. The fastest way on a headless server is through Patchright (the maintained fork of Playwright's browser installer):

```bash
npx patchright install chrome
```

This downloads Chrome for Testing (`~/.cache/ms-playwright/`) — no apt install needed, no root required. Takes ~30-60 seconds on a decent connection.

**Alternative: system Chrome.** If you already have Chrome installed:
```bash
which google-chrome || which google-chrome-stable || which chromium
```

The `linkedin-mcp` package auto-detects it. If it can't find Chrome, it falls back to Patchright's install — so you only need to worry about this if you're on a very constrained system (low disk, no internet for the 200MB download).

### Xvfb (if using headed login on the server)

Only needed if you plan to run the login step *on the server itself* with a virtual display:

```bash
sudo apt install -y xvfb
```

No GPU drivers required. Chrome will render via SwiftShader (software GPU).

---

## 2. Clone & Install

```bash
git clone https://github.com/TheAhmadZeb/linkedin-profile-mcp.git
cd linkedin-profile-mcp
npm install
```

That's it. `npm install` pulls in `patchright` and any other dependencies. Takes about 10 seconds.

### Verify Installation

```bash
node edit-profile.js --help
npx linkedin-mcp --help
```

Both should print usage info. If `npx linkedin-mcp` fails with "command not found", run `npm install` again — sometimes npx cache is stale:

```bash
npx clear-cache 2>/dev/null
npm install
```

---

## 3. Authentication: The Tricky Part

Here's the fundamental challenge: `linkedin-mcp --login` opens a **real, headed Chrome window** so you can sign in to LinkedIn manually. On a headless server, there's no screen. You have three ways around this.

### Option A: Xvfb + VNC (all on one machine)

Sets up a virtual display on the server, then lets you connect with a VNC client from your local machine to see Chrome and log in.

**Step 1: Install Xvfb + VNC server**
```bash
sudo apt install -y xvfb x11vnc
```

**Step 2: Start Xvfb**
```bash
Xvfb :99 -screen 0 1280x720x24 &
```

This creates a virtual display at `:99` with 1280x720 resolution — no GPU needed, SwiftShader handles rendering.

**Step 3: Start VNC**
```bash
x11vnc -display :99 -rfbport 5900 -localhost
```

This starts a VNC server on port 5900, bound to localhost only (not exposed to the internet — you'll tunnel to it).

**Step 4: SSH tunnel + connect**
```bash
# From your LOCAL machine
ssh -L 5900:localhost:5900 user@your-server
```

Then connect a VNC client (TigerVNC, RealVNC, Remmina) to `localhost:5900`. You'll see a blank grey X desktop.

**Step 5: Run the login**
```bash
# On the server
DISPLAY=:99 npx linkedin-mcp --login
```

Chrome opens in the virtual display. Switch to your VNC window, complete the sign-in (email, password, 2FA if enabled), and close Chrome. The session saves to `~/.linkedin-mcp/profile/`.

**Step 6: Verify**
```bash
npx linkedin-mcp --status
# Should show: ✅ logged in
```

**Pros:** Everything on one machine, no file transfers.
**Cons:** Need a VNC client + SSH tunnel, extra packages to install, Xvfb can be flaky without `--enable-unsafe-swiftshader`.

**Making Xvfb stable:**
```bash
Xvfb :99 -screen 0 1280x720x24 -ac &
```
The `-ac` flag disables access control, which helps Chrome connect to the display without permission errors.

---

### Option B: Copy Profile from Another Machine (Recommended)

This is the most reliable approach. Log in on a machine that *has* a screen (your laptop, your desktop), then transfer the session to the server.

**Step 1: Log in on your local machine**
```bash
# On your laptop/desktop (has a display)
npx linkedin-mcp --login
# Chrome opens — sign in normally
```

**Step 2: Package the profile**
```bash
# Still on your local machine
cd ~/.linkedin-mcp
tar czf linkedin-profile.tar.gz profile/
```

**Step 3: Transfer to server**
```bash
# From your local machine — pick one:
scp ~/.linkedin-mcp/linkedin-profile.tar.gz user@your-server:~/
# OR
rsync -avP ~/.linkedin-mcp/linkedin-profile.tar.gz user@your-server:~/
# OR (if you already have the session on the OptiPlex where Hermes runs)
scp ~/.linkedin-mcp/linkedin-profile.tar.gz other-server-host:~/
```

**Step 4: Extract on the server**
```bash
# On the server
mkdir -p ~/.linkedin-mcp
cd ~/.linkedin-mcp
tar xzf ~/linkedin-profile.tar.gz
```

**Step 5: Verify**
```bash
npx linkedin-mcp --status
# Should show: ✅ logged in
```

**Pros:** Most reliable — Chrome works normally during login, no extra packages on the server, the profile survives for days/weeks.
**Cons:** Extra step of copying the profile directory; if the session expires (cookies die), you repeat the process.

**What's in the profile directory:**
```
~/.linkedin-mcp/profile/
├── Cookies          # SQLite DB — encrypted, only Chrome can read it
├── Local Storage/   # Session tokens, Cloudflare clearance
├── Login Data       # Saved credentials (if you chose to save)
└── ... (many more Chrome internal files)
```

You don't need to understand any of it — just copy the whole `profile/` directory and Chrome does the rest.

---

### Option C: SSH X11 Forwarding

Forward the display from the server to your local machine over SSH, so the Chrome window opens *on your screen* even though the process runs on the server.

**Step 1: Connect with X forwarding**
```bash
# From your LOCAL machine
ssh -X user@your-server
```

The `-X` flag enables trusted X11 forwarding. Some servers restrict this — try `-Y` (untrusted) as a fallback.

**Step 2: Run the login**
```bash
# On the server (the window will appear on YOUR screen)
npx linkedin-mcp --login
```

**Step 3: Sign in** — the Chrome window appears on your local machine's screen. Complete the sign-in normally.

**Prerequisites:**
- **Server side:** `xauth` package must be installed (`sudo apt install xauth`)
- **Server side:** `X11Forwarding yes` in `/etc/ssh/sshd_config` (you may need sudo)
- **Local side:** An X server running (Linux native, macOS with XQuartz, Windows with VcXsrv or WSLg)

**Pros:** No extra packages beyond `xauth`, no file copying, no VNC.
**Cons:** Slower over high-latency connections, the Chrome window can feel laggy; X forwarding is often blocked or limited by server SSH config.

---

## 4. Running the MCP Server

Once authenticated, you have several options for keeping the server running.

### Quick Test (Foreground)

```bash
cd ~/linkedin-profile-mcp
export LINKEDIN_VANITY="your-vanity-slug"
export LINKEDIN_HEADLESS=true
export DISPLAY=:99

npx linkedin-mcp --transport stdio
```

The server runs in the foreground. Press Ctrl+C to stop. Good for testing, not for production.

### Systemd Service (Persistent)

Runs the MCP server as a system service — auto-starts on boot, restarts on crash, logs to journald.

**Step 1: Create the service file**

```ini
# /etc/systemd/system/linkedin-mcp.service
[Unit]
Description=LinkedIn MCP Profile Editor
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/home/your-username/linkedin-profile-mcp
Environment=LINKEDIN_VANITY=your-vanity-slug
Environment=LINKEDIN_HEADLESS=true
Environment=DISPLAY=:99
ExecStart=/usr/bin/npx linkedin-mcp --transport stdio
Restart=on-failure
RestartSec=10
# Limit journal log size to avoid filling /var
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Replace:
- `your-username` with the actual username
- `your-vanity-slug` with your LinkedIn vanity URL
- The `ExecStart` path to `npx` — verify with `which npx`

**Step 2: Enable and start**
```bash
sudo systemctl daemon-reload
sudo systemctl enable linkedin-mcp
sudo systemctl start linkedin-mcp
```

**Step 3: Check status**
```bash
sudo systemctl status linkedin-mcp
# Should say "active (running)"

# Tail logs
sudo journalctl -u linkedin-mcp -f
```

**Step 4: Connect your MCP client**

Point your client (Claude Desktop, Hermes, Cursor) at the stdio socket or configure it to talk to the service. For systemd you typically wrap it in a socket-based activation or use HTTP transport instead:

```bash
npx linkedin-mcp --transport http --port 3000
```

Then your client connects to `http://localhost:3000`. For the systemd service, change the `ExecStart` line to use HTTP transport.

### Docker (Containerised)

A minimal Dockerfile for container deployment:

```dockerfile
# Dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first for better caching
COPY package.json ./
RUN npm install

# Copy the rest of the project
COPY . .

# Create a volume for the persistent profile
VOLUME /home/user/.linkedin-mcp

ENV LINKEDIN_HEADLESS=true
ENV DISPLAY=:99

# The profile mount is expected to have the linkedin session
# Mount your authenticated profile:
#   docker run -v ~/.linkedin-mcp:/home/user/.linkedin-mcp ...

CMD ["npx", "linkedin-mcp"]
```

**Build & run:**
```bash
docker build -t linkedin-mcp .
docker run -d \
  --name linkedin-mcp \
  -e LINKEDIN_VANITY=your-vanity-slug \
  -v ~/.linkedin-mcp:/home/user/.linkedin-mcp \
  linkedin-mcp
```

**Important for Docker:** The profile directory must be writable and readable by the container's user. Chrome encrypts cookies using the system's keyring, which doesn't exist in a container — so cookie persistence may be shorter-lived than on bare metal. For a real service, mount a host directory that persists across container restarts.

---

## 5. Field Editing on a Server

Once the MCP server is running, you can call the field editor script:

```bash
cd ~/linkedin-profile-mcp
export LINKEDIN_VANITY="your-vanity-slug"

# Read a field
node edit-profile.js get headline

# Write a field
node edit-profile.js set headline "Your New Headline"

# Add experience
node edit-profile.js add-exp --title "Software Engineer" --company "ACME Corp" --start-year "2024" --description "Built stuff"
```

The script launches its own headless Chrome session (separate from the MCP server's session, but sharing the same profile directory). This means you can run field edits even while the MCP server is idle.

**Multiple concurrent sessions:** Chrome uses a file lock on the profile directory. If the MCP server is actively using the browser, the edit script will fail to open the profile. Either:
- Stop the MCP server first, edit, then restart
- Or configure a separate profile dir for the edit script (`LINKEDIN_PROFILE_DIR=/path/to/copy-of-profile`)

---

## 6. Session Management

### Session Lifecycle

```
Login ──► Session valid (days to weeks)
               │
               ├── MCP server responds to queries
               ├── Field edits work
               │
               └── LinkedIn expires cookies ──► Need to re-authenticate
```

Sessions typically last 1-3 weeks with regular use. Longer if you access LinkedIn through the profile regularly (keeping the cookies fresh).

### Checking Session Health

```bash
npx linkedin-mcp --status
# ✅ logged in  — all good
# ❌ not logged in — re-authenticate
```

You can automate this check with a cron job:

```bash
# Run daily, alert if session expired
0 9 * * * cd ~/linkedin-profile-mcp && \
  npx linkedin-mcp --status 2>&1 | grep -q "logged in" || \
  echo "LinkedIn session expired!" | mail -s "LinkedIn Session Alert" you@email.com
```

Or with Hermes Agent as a watchdog cron:

```bash
hermes cron create \
  --name "linkedin-session-check" \
  --schedule "0 9 * * *" \
  --prompt "Check LinkedIn MCP session status. If expired, notify the user with instructions to re-authenticate." \
  --no-agent \
  --script /path/to/check-session.sh
```

### Re-authenticating When Session Expires

Same process as step 3 — pick your method (Xvfb+VNC, copy profile, X11 forwarding). The profile directory can be reused; just overwrite it with a fresh login:

```bash
# If using profile copy method:
scp local-machine:~/linkedin-profile.tar.gz ~/
tar xzf ~/linkedin-profile.tar.gz -C ~/.linkedin-mcp/
```

Or for Xvfb:
```bash
DISPLAY=:99 npx linkedin-mcp --login
```

---

## 7. Troubleshooting Common Deployment Issues

### Chrome crashes immediately on server start

**Symptoms:** MCP server starts, Chrome launches, then exits with a GPU-related error.

**Solutions:**
```bash
# Force software rendering
export LINKEDIN_HEADLESS=true  # Already set in headless mode

# If still crashing, edit-profile.js already includes these args:
# --disable-gpu
# --enable-unsafe-swiftshader
# --no-sandbox
```

Verify Chrome can launch at all:
```bash
npx patchright install chrome
# Then try a headless smoke test
node -e "
const { chromium } = require('patchright');
(async () => {
  const b = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.goto('https://example.com');
  console.log('Chrome works!
  await b.close();
})();
"
```

### "Cannot open display" errors

**Cause:** The login command tried to open a headed Chrome window but `$DISPLAY` isn't set or the display doesn't exist.

**Solutions:**
- For Xvfb: ensure Xvfb is running (`ps aux | grep Xvfb`), then `export DISPLAY=:99`
- For headless: set `LINKEDIN_HEADLESS=true`
- Run the profile copy method instead (Option B above)

### npx linkedin-mcp not found

```bash
# Ensure you're in the project directory
cd ~/linkedin-profile-mcp
npm install

# If still failing, check node_modules
ls node_modules/.bin/linkedin-mcp* || ls node_modules/linkedin-mcp*
```

If the package didn't install, run:
```bash
npm install linkedin-mcp
```

### "Failed to connect to Chrome" in Playwright

**Cause:** Patchright/Playwright can't find the Chrome binary.

```bash
# Install Chrome explicitly
npx patchright install chrome

# Or specify the path manually in the code:
# In edit-profile.js, change channel: 'chrome' to executablePath: '/usr/bin/chromium'
```

To find your Chrome:
```bash
which chrome google-chrome google-chrome-stable chromium chromium-browser 2>/dev/null
```

### Permission denied on SSH key (git clone)

If the deploy server can't clone the repo:

```bash
# HTTPS clone doesn't need SSH keys
git clone https://github.com/TheAhmadZeb/linkedin-profile-mcp.git

# If you prefer SSH:
ssh-keygen -t ed25519 -f ~/.ssh/github-deploy -N ""
cat ~/.ssh/github-deploy.pub  # Add this to GitHub deploy keys
```

### Profile won't persist across container restarts

**Cause:** Docker containers don't persist `/home/user/.linkedin-mcp/` by default.

**Fix:** Mount a host directory:
```bash
docker run -v /persistent/linkedin-profile:/home/user/.linkedin-mcp ...
```

Environment variables in the container also won't persist — set them via `-e` flags or an env file.

### 2FA Required

If you have two-factor authentication enabled, the login flow will prompt for a verification code. This works with all three authentication methods — just enter the code when prompted in Chrome. The session *after* 2FA is typically longer-lived than sessions without 2FA.

### Cloudflare challenges

Sometimes LinkedIn's Cloudflare protection throws a challenge page at login. This is another reason to use Option B (profile copy) — the challenge is solved during the initial headed login and the clearance cookie persists in the profile. Subsequent headless sessions reuse that clearance.

If you keep hitting Cloudflare:
1. Log in from a residential IP (not a datacenter/VPS IP)
2. Keep the profile fresh (use it every few days)
3. Or add a browser extension that helps with session maintenance
