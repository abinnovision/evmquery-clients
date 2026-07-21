export interface EvmQueryResource<T> {
	data: T | undefined;
	error: Error | undefined;
	isLoading: boolean;
	refetch: () => void;
}

export interface EvmQueryHookOptions {
	enabled?: boolean;
}
