import { EVMQUERY_BASE_URL } from "../config";

import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from "n8n-workflow";

export class EvmQueryApi implements ICredentialType {
	public name = "evmQueryApi";

	public displayName = "evmquery API";

	public icon: Icon = "file:../icons/evmquery.svg";

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
			baseURL: EVMQUERY_BASE_URL,
			url: "/usage",
			method: "GET",
		},
	};
}
