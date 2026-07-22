export interface EvmqueryResource<T> {
	data: T | undefined;
	error: Error | undefined;
	isLoading: boolean;
	refetch: () => void;
}

export interface EvmqueryHookOptions {
	enabled?: boolean;
}

export interface EvmquerySuspenseResource<T> {
	data: T;
	refetch: () => void;
}
