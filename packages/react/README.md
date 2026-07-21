# @evmquery/react

React hooks for the evmquery API, authenticated with a public API key.

## Overview

Zero-dependency React hooks built on [`@evmquery/sdk`](../sdk), for querying EVM smart-contract state with CEL expressions. No TanStack Query or other query libraries required, just hooks that handle loading, error, and refetch state.

## Installation

```bash
yarn add @evmquery/react @evmquery/sdk react
```

`@evmquery/sdk` is a dependency; `react` (18+) is a peer dependency.

## Quick Start

Wrap your app in `<EvmQueryProvider>` with a public API key:

```tsx
import { EvmQueryProvider, useChains, useEvmQuery } from "@evmquery/react";

export function App() {
  return (
    <EvmQueryProvider apiKey="pk_...">
      <MyComponent />
    </EvmQueryProvider>
  );
}

function MyComponent() {
  const { data: chains } = useChains();
  const { data: result, refetch } = useEvmQuery(
    {
      chain: "ethereum",
      schema: {
        /* ... */
      },
      expression: "/* CEL expression */",
    },
    { enabled: false },
  );

  return (
    <>
      <button onClick={() => refetch()}>Execute query</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </>
  );
}
```

Your API key should be a **public/publishable key** from https://app.evmquery.com/settings/api-keys, safe for browser use. It is sent as the `X-API-Key` header by the underlying SDK.

## Hooks

### useChains

Fetches the list of supported EVM chains. Auto-fetches on mount.

```tsx
import { useChains } from "@evmquery/react";

function ChainsExample() {
  const { data, error, isLoading, refetch } = useChains();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.chains.map((chain) => (
        <div key={chain.id}>{chain.name}</div>
      ))}
    </div>
  );
}
```

Returns `EvmQueryResource<ChainsResponseDto>`.

### useUsage

Fetches credit and usage statistics for the current API key. Auto-fetches on mount.

```tsx
import { useUsage } from "@evmquery/react";

function UsageExample() {
  const { data, isLoading } = useUsage();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      Credits used: {data?.creditsUsed} / {data?.creditsLimit}
    </div>
  );
}
```

Returns `EvmQueryResource<UsageStatsResponseDto>`.

### useValidateExpression

Validates a CEL expression without executing it. Auto-fetches on mount and whenever `input` changes. This is a free operation that does not consume credits.

```tsx
import { useValidateExpression } from "@evmquery/react";

function ValidateExample() {
  const { data, error } = useValidateExpression({
    expression: "contract.balanceOf(msg.sender)",
  });

  return <div>{error ? "Invalid" : "Valid"}</div>;
}
```

Returns `EvmQueryResource<QueryValidateResponseDto>`.

### useDescribeSchema

Resolves a contract schema into available methods and context. Auto-fetches on mount and whenever `input` changes. This is a free operation that does not consume credits.

```tsx
import { useDescribeSchema } from "@evmquery/react";

function DescribeExample() {
  const { data } = useDescribeSchema({
    chain: "ethereum",
    schema: {
      erc20: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        abi: [], // Standard ERC20 ABI
      },
    },
  });

  return <div>Available methods: {data?.methods.join(", ")}</div>;
}
```

Returns `EvmQueryResource<QueryDescribeResponseDto>`.

### useEvmQuery

Executes a query against smart contracts. This hook is **lazy by default** (`enabled` defaults to `false`) because executing a query consumes credits. Use one of two patterns:

**Pattern 1: On-demand with `refetch()`**

```tsx
import { useEvmQuery } from "@evmquery/react";

function OnDemandExample() {
  const { data, refetch } = useEvmQuery({
    chain: "ethereum",
    schema: {
      usdc: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        abi: [], // Standard ERC20 ABI
      },
    },
    expression: "usdc.balanceOf('0x...')",
  });

  return <button onClick={() => refetch()}>Execute</button>;
}
```

**Pattern 2: Auto-run with `{ enabled: true }`**

```tsx
import { useEvmQuery } from "@evmquery/react";

function AutoExample() {
  const { data, isLoading } = useEvmQuery(
    {
      chain: "ethereum",
      schema: {
        /* ... */
      },
      expression: "/* CEL expression */",
    },
    { enabled: true },
  );

  if (isLoading) return <div>Executing query...</div>;
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

Returns `EvmQueryResource<QueryExecuteResponseDto>`.

### useEvmQueryClient

Escape hatch returning the raw `EvmQueryClient` from `@evmquery/sdk` for imperative calls.

```tsx
import { useEvmQueryClient } from "@evmquery/react";

function ClientExample() {
  const client = useEvmQueryClient();

  const handleClick = async () => {
    const result = await client.query({
      body: {
        /* ... */
      },
    });
  };

  return <button onClick={handleClick}>Query</button>;
}
```

## Options

All hooks accept an optional `EvmQueryHookOptions` object:

```tsx
interface EvmQueryHookOptions {
  /**
   * Whether to run the query automatically.
   * Defaults to `true` for all hooks except `useEvmQuery`, which defaults to `false`.
   */
  enabled?: boolean;
}
```

### Hook Return Type

All hooks return an `EvmQueryResource<T>`:

```tsx
interface EvmQueryResource<T> {
  /**
   * The query result. `undefined` while loading or if an error occurred.
   */
  data: T | undefined;

  /**
   * Error thrown by the API or during fetch. `undefined` if no error.
   */
  error: Error | undefined;

  /**
   * `true` while the query is in flight.
   */
  isLoading: boolean;

  /**
   * Manually trigger the query.
   */
  refetch: () => void;
}
```

## Provider

Wrap your component tree in `<EvmQueryProvider>` to make hooks available.

```tsx
import { EvmQueryProvider } from "@evmquery/react";

export function App() {
  return (
    <EvmQueryProvider apiKey={process.env.REACT_APP_EVMQUERY_KEY}>
      <YourApp />
    </EvmQueryProvider>
  );
}
```

### Props

```tsx
interface EvmQueryProviderProps {
  /**
   * API key sent as the `X-API-Key` header. A public/publishable key from
   * https://app.evmquery.com/settings/api-keys is safe for browser use.
   */
  apiKey?: string;

  /**
   * Override the API base URL. Defaults to `https://api.evmquery.com/api/v1`.
   */
  baseUrl?: string;

  /**
   * Additional headers merged into every request.
   * Should be referentially stable (memoized) to avoid recreating the client.
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation. Useful for proxies, retry middleware, or testing.
   * Should be referentially stable (memoized) to avoid recreating the client.
   */
  fetch?: typeof fetch;

  children: ReactNode;
}
```

### Stability note

For best performance, ensure `headers` and `fetch` are referentially stable between renders:

```tsx
const customHeaders = useMemo(() => ({ "X-Custom-Header": "value" }), []);

const customFetch = useCallback(async (input, init) => {
  console.log("Fetching", input);
  return fetch(input, init);
}, []);

return (
  <EvmQueryProvider apiKey={apiKey} headers={customHeaders} fetch={customFetch}>
    <App />
  </EvmQueryProvider>
);
```

## Limitations

These hooks are **client-side only** and do not include the `"use client"` directive. For server-side or Server Component usage, use [`@evmquery/sdk`](../sdk) directly in server-side code or within `"use server"` functions.

## License

Apache-2.0
