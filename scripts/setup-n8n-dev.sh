#!/usr/bin/env bash
# setup-n8n-dev.sh
#
# One-shot setup for the local n8n dev loop. Installs workspace deps, builds
# the n8n-nodes-evmquery package, and symlinks the workspace into the n8n
# custom extensions dir so a locally installed `n8n` picks the node up.
#
# Idempotent: safe to re-run after pulling changes, switching branches, or
# deleting ~/.n8n.
set -euo pipefail

# Resolve repo root from this script's location so the script works regardless
# of the caller's CWD.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PKG_NAME="n8n-nodes-evmquery"
PKG_PATH="${REPO_ROOT}/packages/${PKG_NAME}"
N8N_HOME="${N8N_USER_FOLDER:-${HOME}/.n8n}"
CUSTOM_DIR="${N8N_HOME}/custom"
LINK_PATH="${CUSTOM_DIR}/${PKG_NAME}"

step() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
info() { printf '    %s\n' "$*"; }
fail() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

step "Verifying prerequisites"

command -v yarn >/dev/null 2>&1 || fail "yarn is required — install via corepack (\`corepack enable\`) or https://yarnpkg.com."
info "yarn: $(yarn --version)"

if command -v n8n >/dev/null 2>&1; then
  info "n8n: $(n8n --version 2>/dev/null || echo 'unknown version')"
else
  cat <<'EOF'

    n8n is not installed globally. Install it with one of:
      npm i -g n8n
      yarn global add n8n      (Yarn Classic)
      pnpm add -g n8n

    Then re-run this script. You can continue without n8n installed — the
    symlink will still be created — but you'll need n8n on PATH to run it.
EOF
fi

step "Verifying workspace package exists at ${PKG_PATH}"
[[ -d "${PKG_PATH}" ]] || fail "${PKG_PATH} not found. Did the monorepo layout change?"
[[ -f "${PKG_PATH}/package.json" ]] || fail "${PKG_PATH}/package.json missing — package is malformed."

step "Installing workspace dependencies (yarn install)"
(cd "${REPO_ROOT}" && yarn install)

step "Building ${PKG_NAME}"
yarn --cwd "${REPO_ROOT}" workspace "${PKG_NAME}" build

step "Linking ${PKG_NAME} into ${CUSTOM_DIR}"
mkdir -p "${CUSTOM_DIR}"

if [[ -L "${LINK_PATH}" ]]; then
  existing_target="$(readlink "${LINK_PATH}")"
  if [[ "${existing_target}" == "${PKG_PATH}" ]]; then
    info "Symlink already points at ${PKG_PATH} — nothing to do."
  else
    info "Replacing stale symlink (was → ${existing_target})."
    rm "${LINK_PATH}"
    ln -s "${PKG_PATH}" "${LINK_PATH}"
  fi
elif [[ -e "${LINK_PATH}" ]]; then
  fail "${LINK_PATH} exists and is not a symlink. Remove it manually if you want this script to manage it."
else
  ln -s "${PKG_PATH}" "${LINK_PATH}"
  info "Created symlink ${LINK_PATH} → ${PKG_PATH}"
fi

printf '\n\033[1;32mSetup complete.\033[0m\n'
cat <<EOF

Start n8n with:
    n8n start

Then open http://localhost:5678 and drag the \`evmquery\` node onto a canvas.

Dev loop — keep the watcher running in one terminal and restart n8n in another
whenever you want it to pick up compiled changes:

    yarn workspace ${PKG_NAME} dev         # terminal 1: tsc --watch
    n8n start                              # terminal 2 (restart on changes)

EOF
