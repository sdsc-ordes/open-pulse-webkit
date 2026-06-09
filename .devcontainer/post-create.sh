#!/usr/bin/env bash
# Post-create: web app deps + Claude config volume ownership.
# Auth persistence: https://code.claude.com/docs/en/devcontainer#persist-authentication-and-settings-across-rebuilds
set -euo pipefail

NODE_HOME="/home/node"
CLAUDE_DIR="${NODE_HOME}/.claude"

echo "Preparing Claude Code config volume at ${CLAUDE_DIR}..."
mkdir -p "${CLAUDE_DIR}"
chown -R node:node "${CLAUDE_DIR}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# The web app lives in src/your-web (scaffold it with your framework of choice).
# Only install if it has been scaffolded with a package.json.
APP_DIR="${REPO_ROOT}/src/your-web"
if [ -f "${APP_DIR}/package.json" ]; then
  echo "Installing web app dependencies..."
  cd "${APP_DIR}"
  sudo -u node npm install --no-audit --no-fund
else
  echo "No src/your-web/package.json yet — skipping deps. Scaffold your app there first."
fi

cp -n "${REPO_ROOT}/.env.example" "${REPO_ROOT}/.env" 2>/dev/null || true

echo "Post-create complete."
