# @evmquery/react

React hooks for the evmquery API, authenticated with a public API key.

## Overview

A read integration for frontends: you already have a written CEL expression, this reads its value with a hook. Zero-dependency, built on [`@evmquery/sdk`](../sdk). No TanStack Query or other query libraries required, just a hook that handles loading, error, and refetch state.

Authoring, validating, and introspecting expressions is out of scope here. For that, or for any other imperative access to the API, use the escape-hatch `useEvmqueryClient()` (or `@evmquery/sdk` directly).

## Installation

```bash
yarn add @evmquery/react @evmquery/sdk react
```

`@evmquery/sdk` is a dependency; `react` (19+) is a peer dependency. React 19 is required because the Suspense hook uses the native `use()` API.

## Quick Start

Wrap your app in `<EvmqueryProvider>` with a public API key:

```tsx
import { EvmqueryProvider, useEvmquery } from "@evmquery/react";

export function App() {
  return (
    <EvmqueryProvider apiKey="pk_...">
      <MyComponent />
    </EvmqueryProvider>
  );
}

function MyComponent() {
  const { data, error, isLoading } = useEvmquery({
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

### useEvmquery

Executes a query against smart contracts and reads its result. Auto-fetches on mount and whenever the input expression changes.

```tsx
import { useEvmquery } from "@evmquery/react";

function QueryExample() {
  const { data, error, isLoading, refetch } = useEvmquery({
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
const { data, refetch } = useEvmquery(input, { enabled: false });

<button onClick={() => refetch()}>Run query</button>;
```

Returns `EvmqueryResource<QueryExecuteResponseDto>`.

### Suspense

`useEvmquerySuspense` executes a query and suspends the nearest `<Suspense>` boundary until it resolves. It requires **React 19** (it uses the native `use()` API, which has no React 18 polyfill).

```tsx
import { Component, Suspense } from "react";
import { useEvmquerySuspense } from "@evmquery/react";

function QueryExample() {
  const { data, refetch } = useEvmquerySuspense({
    chain: "ethereum",
    schema: {
      usdc: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        abi: [], // Standard ERC20 ABI
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

class ErrorBoundary extends Component {
  state = { error: undefined };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) return <div>Error: {this.state.error.message}</div>;
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Loading...</div>}>
        <QueryExample />
      </Suspense>
    </ErrorBoundary>
  );
}
```

Unlike `useEvmquery`, `data` is always present (never `undefined`) since the component only renders once the query has resolved; a failed query (an `EvmQueryError` or a network failure) is thrown instead, to be caught by the nearest error boundary.

The returned `refetch` runs only on the success path (after the component has rendered). To recover from a failed query, reset the error boundary so the component remounts and issues a fresh request; the returned `refetch` is not reachable while the boundary is showing its fallback.

There is no shared cache: each hook instance memoizes its own promise, so re-rendering with the same input reuses it instead of issuing a new request, but nothing is deduplicated across components. Note that under React StrictMode in development, a mount may issue more than one request (and so consume credits more than once) before it settles; production builds issue a single request per mount.

Cancellation is best-effort: aborting the in-flight request happens in a post-commit effect, so it only covers a superseded or unmounted request _after_ the component has committed at least once. The window between a component first suspending and that initial commit can't be cancelled from here, since `use()` gives it nothing to hook a cleanup into for a render that never commits.

### useEvmqueryClient

Escape hatch returning the raw `EvmQueryClient` from `@evmquery/sdk` for imperative access to endpoints this package doesn't wrap in hooks, such as listing chains, checking usage, validating an expression, or describing a schema.

```tsx
import { useEvmqueryClient } from "@evmquery/react";

function ClientExample() {
  const client = useEvmqueryClient();

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

`useEvmquery` accepts an optional `EvmqueryHookOptions` object:

```tsx
interface EvmqueryHookOptions {
  /**
   * Whether to run the query automatically. Defaults to `true`.
   */
  enabled?: boolean;
}
```

### Hook Return Type

```tsx
interface EvmqueryResource<T> {
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

### Props

```tsx
interface EvmqueryProviderProps {
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
  <EvmqueryProvider apiKey={apiKey} headers={customHeaders} fetch={customFetch}>
    <App />
  </EvmqueryProvider>
);
```

## Limitations

These hooks are **client-side only** and do not include the `"use client"` directive. For server-side or Server Component usage, use [`@evmquery/sdk`](../sdk) directly in server-side code or within `"use server"` functions.

## License

Apache-2.0
