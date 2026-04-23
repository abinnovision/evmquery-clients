# Local development

This repo wires the in-progress `n8n-nodes-evmquery` package into a locally installed n8n via a symlink at `~/.n8n/custom/`. n8n auto-discovers anything under that path on boot, so no Docker, no bind-mounts, no `NODE_PATH` gymnastics.

## Prerequisites

- Node 20+ and Yarn 4 (pinned via `.yarnrc.yml` + `packageManager`)
- n8n on `PATH` — install with `npm i -g n8n` (or via yarn/pnpm). The setup script will warn if n8n is missing but still create the symlink.

## First-time setup

```bash
make setup-n8n
# or, equivalently:
./scripts/setup-n8n-dev.sh
```

The script is idempotent. It:

1. Runs `yarn install` at the repo root.
2. Builds `packages/n8n-nodes-evmquery` (n8n loads the compiled `dist/`, not source).
3. Creates `~/.n8n/custom/n8n-nodes-evmquery` as a symlink to the workspace package. Replaces stale symlinks, fails loudly if a real directory already sits at that path.

Then start n8n:

```bash
n8n start
```

Open http://localhost:5678, create the owner account, then:

1. **Credentials → Add credential → evmquery API**.
2. Paste an API key from https://evmquery.com.
3. Save — the credential test hits `GET /usage` to verify.

Drag the **evmquery** node onto a canvas and pick an operation from the Operation dropdown.

## Edit / reload loop

n8n does not hot-reload registered nodes. Every code change needs a restart.

```bash
# Terminal 1: keep tsc in watch mode.
yarn workspace n8n-nodes-evmquery dev

# Terminal 2: ctrl-C n8n, then `n8n start` again.
```

Icons and other static assets under `gulp build:assets` require a full `yarn workspace n8n-nodes-evmquery build` — the watcher only tracks TypeScript.

## How the symlink resolves deps

Our package has exactly one runtime import from `n8n-workflow` (`NodeApiError` in `transport/errors.ts`). Everything else is `import type`, erased at compile time.

When n8n `require()`s a file inside `~/.n8n/custom/n8n-nodes-evmquery/dist/…`, Node follows the symlink to the workspace's real path, then walks up the filesystem looking for `node_modules`. Yarn workspaces hoist shared deps to the monorepo root `node_modules`, which is where `n8n-workflow` lives — resolution succeeds there.

This fails only under two conditions:

- `--preserve-symlinks` (n8n doesn't pass it).
- Yarn stops hoisting `n8n-workflow` (e.g. a conflicting range pinned deeper in the tree). Check `yarn why n8n-workflow` if this ever happens.

Keep `packages/n8n-nodes-evmquery/package.json`'s `n8n-workflow` range aligned with the version shipped by the globally installed n8n — same class identity prevents `instanceof NodeApiError` mismatches across the boundary.

## Pointing at a non-prod evmquery API

The credential form accepts a `Base URL` override. Set it per credential (e.g. `http://localhost:8787/api`) — no env variable required.

## Tearing down

```bash
rm ~/.n8n/custom/n8n-nodes-evmquery
```

Wipe the entire local n8n state (credentials, workflows, sqlite DB):

```bash
rm -rf ~/.n8n
```

## Troubleshooting

- **Node doesn't appear in the palette** — confirm `packages/n8n-nodes-evmquery/dist/nodes/EvmQuery/EvmQuery.node.js` exists (`yarn workspace n8n-nodes-evmquery build`). Check the symlink: `ls -la ~/.n8n/custom/`.
- **`Cannot find module 'n8n-workflow'`** at n8n startup — `yarn why n8n-workflow` in the repo root. If it isn't hoisted to the root `node_modules`, hoist conflict; if it is, confirm n8n was started without `--preserve-symlinks`.
- **`NodeApiError` behaves strangely (e.g. `instanceof` returns false)** — the `n8n-workflow` version in the workspace drifted from the one n8n runs with. Align the ranges.
- **Credential test fails with 401** — confirm the key is active at https://evmquery.com/usage.

## Why the node appears under "Action in an App" (and not "Custom Nodes")

Loading via `~/.n8n/custom/` with a proper `package.json` (declaring the `n8n` field and `codex` metadata) uses n8n's `CustomDirectoryLoader`. In older n8n versions that loader force-injected the `CUSTOM` category regardless of the declared categories; current versions honor `EvmQuery.node.json`'s `categories` array. If you ever see the node under "Custom Nodes" in this local flow, it's an n8n-version issue — behavior is identical either way, only the palette grouping differs.
