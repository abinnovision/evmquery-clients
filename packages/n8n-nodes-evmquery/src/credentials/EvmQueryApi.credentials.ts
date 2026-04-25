import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from "n8n-workflow";

export class EvmQueryApi implements ICredentialType {
	public name = "evmQueryApi";

	public displayName = "evmquery API";

	public documentationUrl = "https://app.evmquery.com/docs";

	public properties: INodeProperties[] = [
		{
			displayName: "API Key",
			name: "apiKey",
			type: "string",
			typeOptions: { password: true },
			default: "",
			required: true,
			description: "Your evmquery API key. Issued from app.evmquery.com.",
		},
	];

	public authenticate: IAuthenticateGeneric = {
		type: "generic",
		properties: {
			headers: {
				"x-api-key": "={{$credentials.apiKey}}",
			},
		},
	};

	public test: ICredentialTestRequest = {
		request: {
			baseURL: "https://api.evmquery.com/api/v1",
			url: "/usage",
			method: "GET",
		},
	};
}
