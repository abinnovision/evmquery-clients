import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEvmQueryClient } from "./use-evm-query-client";

describe("useEvmQueryClient", () => {
	it("throws when rendered without an EvmQueryProvider", () => {
		expect(() => renderHook(() => useEvmQueryClient())).toThrow(
			/useEvmQueryClient must be used within an <EvmQueryProvider>/,
		);
	});
});
