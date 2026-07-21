# @evmquery/react

React hooks for the evmquery API, authenticated with a public API key.

## Overview

A read integration for frontends: you already have a written CEL expression, this reads its value with a hook. Zero-dependency, built on [`@evmquery/sdk`](../sdk). No TanStack Query or other query libraries required, just a hook that handles loading, error, and refetch state.

Authoring, validating, and introspecting expressions is out of scope here. For that, or for any other imperative access to the API, use the escape-hatch `useEvmQueryClient()` (or `@evmquery/sdk` directly).

## Installation

```bash
yarn add @evmquery/react @evmquery/sdk react
```

`@evmquery/sdk` is a dependency; `react` (18+) is a peer dependency.

## Quick Start

Wrap your app in `<EvmQueryProvider>` with a public API key:

```tsx
import { EvmQueryProvider, useEvmQuery } from "@evmquery/react";

export function App() {
  return (
    <EvmQueryProvider apiKey="pk_...">
      <MyComponent />
    </EvmQueryProvider>
  );
}

function MyComponent() {
  const { data, error, isLoading } = useEvmQuery({
    chain: "ethereum",
    schema: {
      /* ... */
    },
    expression: "usdc.totalSupply()",
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

Your API key should be a **public/publishable key** from https://app.evmquery.com/settings/api-keys, safe for browser use. It is sent as the `X-API-Key` header by the underlying SDK.

## Hooks

### useEvmQuery

Executes a query against smart contracts and reads its result. Auto-fetches on mount and whenever the input expression changes.

```tsx
import { useEvmQuery } from "@evmquery/react";

function QueryExample() {
  const { data, error, isLoading, refetch } = useEvmQuery({
    chain: "ethereum",
    schema: {
      usdc: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        abi: [], // Standard ERC20 ABI
      },
    },
    expression: "usdc.balanceOf('0x...')",
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <>
      <button onClick={() => refetch()}>Refresh</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}
```

Executing a query consumes credits. Since this hook auto-fetches, gate it with `{ enabled: false }` where auto-running isn't desired (for example, until the user provides input), then trigger it manually via `refetch()`:

```tsx
const { data, refetch } = useEvmQuery(input, { enabled: false });

<button onClick={() => refetch()}>Run query</button>;
```

Returns `EvmQueryResource<QueryExecuteResponseDto>`.

### useEvmQueryClient

Escape hatch returning the raw `EvmQueryClient` from `@evmquery/sdk` for imperative access to endpoints this package doesn't wrap in hooks, such as listing chains, checking usage, validating an expression, or describing a schema.

```tsx
import { useEvmQueryClient } from "@evmquery/react";

function ClientExample() {
  const client = useEvmQueryClient();

  const handleClick = async () => {
    const { data } = await client.validate({
      body: {
        /* ... */
      },
    });
  };

  return <button onClick={handleClick}>Validate</button>;
}
```

## Options

`useEvmQuery` accepts an optional `EvmQueryHookOptions` object:

```tsx
interface EvmQueryHookOptions {
  /**
   * Whether to run the query automatically. Defaults to `true`.
   */
  enabled?: boolean;
}
```

### Hook Return Type

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
