# n8n-nodes-evmquery

n8n community node for [evmquery](https://evmquery.com) — query EVM smart contracts (Ethereum, Base, BNB) using CEL expressions, both in regular n8n workflows and as an AI Agent tool.

## What is evmquery?

evmquery is a managed HTTP API that turns CEL (Common Expression Language) queries into typed reads against EVM chains. One expression can call multiple contracts, combine their results, and return a structured value — no RPC plumbing, no ABI juggling, no fan-out across view calls.

## Install (self-hosted n8n)

Settings → Community Nodes → install `n8n-nodes-evmquery`.

## Credentials

1. Create an API key at [evmquery.com](https://evmquery.com).
2. In n8n, create an **evmquery API** credential and paste the key. The credential test hits `GET /usage` to verify the key.
3. Optional: override `Base URL` if you're pointing at a private deployment.

## Operations (v1)

| Resource | Operation       | Purpose                                                                  |
| -------- | --------------- | ------------------------------------------------------------------------ |
| Query    | Execute         | Evaluate a CEL expression and return a typed result plus `$meta` sidecar |
| Query    | Validate        | Type-check + credit estimate, no on-chain calls                          |
| Query    | Describe Schema | Return the callable methods on contracts and CEL helpers                 |
| Chain    | List            | List supported EVM networks (also powers the Chain dropdown)             |
| Usage    | Get             | Credit balance, tier, billing period                                     |

### Output formats (Execute)

- **Simple** (default): object results are spread at the top level for direct field access; scalar results are wrapped under `value`. A `$meta` key is always attached with `{ blockNumber, credits, rounds, onChainCalls, latencyMs, type }`.
- **Raw**: the full API envelope — useful when you need `result.type` alongside the value or want to inspect `performance` / `meta` fields yourself.

## Cookbook

v1 ships without UI presets — the recipes below show common queries you can paste into the Expression field. v2 will add an in-node preset dropdown powered by the same library.

### ERC-20 balance

```
# Contracts
Token = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48   # USDC

# Context Variables
holder : sol_address = 0x…

# Expression
Token.balanceOf(holder)
```

### Native (gas) balance

```
# Context Variables
account : sol_address = 0x…

# Expression
chain.balance(account)
```

### NFT owner

```
# Contracts
Collection = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB   # CryptoPunks

# Context Variables
tokenId : sol_int = 1234

# Expression
Collection.ownerOf(tokenId)
```

## AI Agent usage

The node is marked `usableAsTool: true` — attach it to a Tools Agent or AI Agent node and the LLM can call any of the five operations. Typical pattern:

1. Call **Describe Schema** with the contracts the agent wants to use.
2. Call **Validate** with a drafted CEL expression to confirm it type-checks.
3. Call **Execute** to get the typed result.

The node accepts both the normal UI-filled `Contracts` / `Context Variables` collections and `$fromAI`-produced JSON objects with the same shape — one code path, zero bespoke tool-mode plumbing for authors.

## Credits & pricing

evmquery meters reads in credits. Every Execute response includes `$meta.credits` (Simple mode) or `credits.consumed` (Raw mode). Validate returns `estimatedCredits` without touching the chain — use it to pre-flight expensive expressions.

## Links

- Website — https://evmquery.com
- API docs — https://api.evmquery.com/api/docs
- Releases & changelog — https://github.com/abinnovision/evmquery-clients/releases

## License

Apache-2.0 — see [LICENSE.md](./LICENSE.md).
