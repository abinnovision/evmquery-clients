# @evmquery-clients/sdk

Type-safe TypeScript SDK for [evmquery.com](https://evmquery.com), generated from the OpenAPI spec at `https://api.evmquery.com/api/docs-json`.

## Installation

```bash
yarn add @evmquery-clients/sdk
```

## Usage

```ts
import { createEvmQueryClient } from "@evmquery-clients/sdk";

const evmquery = createEvmQueryClient({
  apiKey: process.env.EVMQUERY_API_KEY,
});

const result = await evmquery.query({
  body: {
    chain: "ethereum",
    schema: {
      /* contract definitions */
    },
    expression: "/* CEL expression */",
  },
});
```

The client exposes a curated set of typed methods:

| Method         | HTTP                   | Description                                         |
| -------------- | ---------------------- | --------------------------------------------------- |
| `listChains()` | `GET /chains`          | List supported EVM chains.                          |
| `query()`      | `POST /query`          | Execute a query against contracts on a chain.       |
| `validate()`   | `POST /query/validate` | Validate an expression without executing it.        |
| `describe()`   | `POST /query/describe` | Resolve a schema into contract methods and context. |
| `usage()`      | `GET /usage`           | Credit usage and billing-period snapshot.           |

Errors are thrown as `EvmQueryError` with `status`, `statusText`, and parsed `body`.

### Options

| Option    | Type                     | Default                           | Description                                                 |
| --------- | ------------------------ | --------------------------------- | ----------------------------------------------------------- |
| `apiKey`  | `string`                 | —                                 | Bearer token sent as the `Authorization` header.            |
| `baseUrl` | `string`                 | `https://api.evmquery.com/api/v1` | Override the API base URL.                                  |
| `fetch`   | `typeof fetch`           | platform default                  | Custom fetch implementation (proxies, retry middleware, …). |
| `headers` | `Record<string, string>` | —                                 | Additional headers merged into every request.               |

### Errors

```ts
import { isEvmQueryError } from "@evmquery-clients/sdk";

try {
  await evmquery.query({ body });
} catch (error) {
  if (isEvmQueryError(error)) {
    console.error(error.status, error.body);
  }
  throw error;
}
```

## Development

Regenerate the SDK from the latest OpenAPI spec:

```bash
yarn workspace @evmquery-clients/sdk generate
```

Build (dual ESM + CJS via [tsdown](https://tsdown.dev)):

```bash
yarn workspace @evmquery-clients/sdk build
```

## License

Apache-2.0
