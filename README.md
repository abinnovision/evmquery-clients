# evmquery-clients

Public client libraries and integrations for
the [evmquery](https://evmquery.com) API — query EVM smart-contract state with
CEL expressions.

## Packages

| Package                                               | Description                      |
| ----------------------------------------------------- | -------------------------------- |
| [`n8n-nodes-evmquery`](./packages/n8n-nodes-evmquery) | n8n community node for evmquery. |

## Development

Requires Node.js (see `.tool-versions`) and Yarn 4.

```bash
make install          # yarn install
yarn build            # turbo build across all packages
yarn check            # lint + format check across all packages
yarn test-unit        # run unit tests
```

## License

Apache-2.0 — see [LICENSE.md](./LICENSE.md).
