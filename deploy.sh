#!/bin/bash
set -e

echo "=== SwingBot Deploy ==="

# Pull latest code
git pull origin claude/improve-webapp-trading-fsnTc

# Build and restart
docker compose build --no-cache
docker compose up -d

echo ""
echo "✓ Deployed! App running at http://$(hostname -I | awk '{print $1}'):80"
echo "  Logs: docker compose logs -f app"
