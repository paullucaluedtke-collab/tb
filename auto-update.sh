#!/bin/bash
# Auto-update script for SwingBot
# Checks for new commits and redeploys if found
#
# Setup (run once on your server):
#   chmod +x auto-update.sh
#   crontab -e
#   # Add this line to check every 5 minutes:
#   */5 * * * * cd /path/to/tb && ./auto-update.sh >> /var/log/swingbot-update.log 2>&1

set -e

BRANCH="claude/improve-webapp-trading-fsnTc"
LOCKFILE="/tmp/swingbot-update.lock"

# Prevent concurrent runs
if [ -f "$LOCKFILE" ]; then
    LOCKPID=$(cat "$LOCKFILE")
    if kill -0 "$LOCKPID" 2>/dev/null; then
        exit 0
    fi
    rm -f "$LOCKFILE"
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

# Fetch latest from remote
git fetch origin "$BRANCH" 2>/dev/null

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

echo "[$(date)] New commits detected, updating..."
echo "  Local:  $LOCAL"
echo "  Remote: $REMOTE"

git pull origin "$BRANCH"
docker compose build --no-cache
docker compose up -d

echo "[$(date)] Update complete!"
