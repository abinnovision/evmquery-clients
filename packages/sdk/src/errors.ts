export interface EvmqueryErrorInit {
	status: number;
	statusText: string;
	body: unknown;
}

export class EvmqueryError extends Error {
	public override readonly name = "EvmqueryError";
	public readonly status: number;
	public readonly statusText: string;
	public readonly body: unknown;

	public constructor(init: EvmqueryErrorInit) {
		super(`Evmquery API error ${String(init.status)}: ${init.statusText}`);
		this.status = init.status;
		this.statusText = init.statusText;
		this.body = init.body;
	}

	public static async fromResponse(response: Response): Promise<EvmqueryError> {
		let body: unknown;
		try {
			body = await response.clone().json();
		} catch {
			try {
				body = await response.clone().text();
			} catch {
				body = undefined;
			}
		}

		return new EvmqueryError({
			status: response.status,
			statusText: response.statusText,
			body,
		});
	}
}

export const isEvmqueryError = (error: unknown): error is EvmqueryError =>
	error instanceof EvmqueryError;
