import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useEvmqueryClient } from "./use-evmquery-client";

describe("useEvmqueryClient", () => {
	it("throws when rendered without an EvmqueryProvider", () => {
		expect(() => renderHook(() => useEvmqueryClient())).toThrow(
			/useEvmqueryClient must be used within an <EvmqueryProvider>/,
		);
	});
});
