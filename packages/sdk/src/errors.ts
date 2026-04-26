export interface EvmQueryErrorInit {
	status: number;
	statusText: string;
	body: unknown;
}

export class EvmQueryError extends Error {
	public override readonly name = "EvmQueryError";
	public readonly status: number;
	public readonly statusText: string;
	public readonly body: unknown;

	public constructor(init: EvmQueryErrorInit) {
		super(`EvmQuery API error ${String(init.status)}: ${init.statusText}`);
		this.status = init.status;
		this.statusText = init.statusText;
		this.body = init.body;
	}

	public static async fromResponse(response: Response): Promise<EvmQueryError> {
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

		return new EvmQueryError({
			status: response.status,
			statusText: response.statusText,
			body,
		});
	}
}

export const isEvmQueryError = (error: unknown): error is EvmQueryError =>
	error instanceof EvmQueryError;
