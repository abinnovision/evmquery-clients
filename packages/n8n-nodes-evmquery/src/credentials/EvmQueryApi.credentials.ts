import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from "n8n-workflow";

export class EvmQueryApi implements ICredentialType {
	public name = "evmQueryApi";

	public displayName = "evmquery API";

	public documentationUrl = "https://evmquery.com";

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
			baseURL: "={{$credentials.baseUrl}}",
			url: "/usage",
			method: "GET",
		},
	};
}
