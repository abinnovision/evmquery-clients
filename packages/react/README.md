# @evmquery/react

React hooks for the evmquery API, authenticated with a public API key.

## Overview

A read integration for frontends: you already have a written CEL expression,
this reads its value with a hook. Zero-dependency, built on [
`@evmquery/sdk`](../sdk). Authoring, validating, and introspecting expressions
is out of scope for this package. For that, or for any other imperative access
to the API, use the escape-hatch `useEvmqueryClient()` (or `@evmquery/sdk`
directly).

## Installation

```bash
yarn add @evmquery/react @evmquery/sdk react
```

`@evmquery/sdk` is a dependency; `react` (19+) is a peer dependency.

## Quick Start

Wrap your app in `<EvmqueryProvider>` with a public API key:

```tsx
import { EvmqueryProvider, useEvmquery } from "@evmquery/react";

export function App() {
  return (
    <EvmqueryProvider apiKey="evmq...">
      <MyComponent />
    </EvmqueryProvider>
  );
}

function MyComponent() {
  const { data, error, isLoading } = useEvmquery({
    chain: "ethereum",
    schema: {
      contracts: {
        usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      },
    },
    expression: "usdc.totalSupply()",
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

Your API key should be a **public key** with configured domains
from https://app.evmquery.com/settings/api-keys.

## Hooks

### useEvmquery

Executes a query against smart contracts and reads its result. Auto-fetches on
mount and whenever the input expression changes.

```tsx
import { useEvmquery } from "@evmquery/react";

function QueryExample() {
  const { data, error, isLoading, refetch } = useEvmquery({
    chain: "ethereum",
    schema: {
      contracts: {
        usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
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

Executing a query consumes credits. Since this hook auto-fetches, gate it with
`{ enabled: false }` where auto-running isn't desired (for example, until the
user provides input), then trigger it manually via `refetch()`:

```tsx
const { data, refetch } = useEvmquery(input, { enabled: false });

<button onClick={() => refetch()}>Run query</button>;
```

Returns `EvmqueryResource<QueryExecuteResponseDto>`.

### Suspense

`useEvmquerySuspense` executes a query and suspends the nearest `<Suspense>`
boundary until it resolves. It requires **React 19** (it uses the native `use()`
API).

```tsx
import { Component, Suspense } from "react";
import { useEvmquerySuspense } from "@evmquery/react";

function QueryExample() {
  const { data, refetch } = useEvmquerySuspense({
    chain: "ethereum",
    schema: {
      contracts: {
        usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
      },
    },
    expression: "usdc.balanceOf('0x...')",
  });

  return (
    <>
      <button onClick={() => refetch()}>Refresh</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}

export function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <QueryExample />
    </Suspense>
  );
}
```

Unlike `useEvmquery`, `data` is always present (never `undefined`) since the
component only renders once the query has resolved; a failed query (an
`EvmQueryError` or a network failure) is thrown instead, to be caught by the
nearest error boundary.

The returned `refetch` runs only on the success path (after the component has
rendered). To recover from a failed query, reset the error boundary so the
component remounts and issues a fresh request; the returned `refetch` is not
reachable while the boundary is showing its fallback.

## Provider

Wrap your component tree in `<EvmqueryProvider>` to make hooks available.

```tsx
import { EvmqueryProvider } from "@evmquery/react";

export function App() {
  return (
    <EvmqueryProvider apiKey={process.env.REACT_APP_EVMQUERY_KEY}>
      <YourApp />
    </EvmqueryProvider>
  );
}
```

### Stability note

For best performance, ensure `headers` and `fetch` are referentially stable
between renders:

```tsx
const customHeaders = useMemo(() => ({ "X-Custom-Header": "value" }), []);

const customFetch = useCallback(async (input, init) => {
  console.log("Fetching", input);
  return fetch(input, init);
}, []);

return (
  <EvmqueryProvider apiKey={apiKey} headers={customHeaders} fetch={customFetch}>
    <App />
  </EvmqueryProvider>
);
```

## Limitations

These hooks are **client-side only** and do not include the `"use client"`
directive. For server-side or Server Component usage, use [
`@evmquery/sdk`](../sdk) directly in server-side code or within `"use server"`
functions.

## License

Apache-2.0
