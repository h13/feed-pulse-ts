import type { LlmInterface } from "../contracts/LlmInterface.js";

const DEFAULT_URL = "https://api.z.ai/api/coding/paas/v4/chat/completions";
const DEFAULT_MODEL = "glm-4.7";

type FetchFn = typeof globalThis.fetch;

interface GlmChoice {
	message: { content: string };
}

interface GlmResponse {
	choices: GlmChoice[];
}

interface GlmLlmOptions {
	readonly apiKey: string;
	readonly apiUrl?: string;
	readonly model?: string;
	readonly fetchFn?: FetchFn;
}

export class GlmLlm implements LlmInterface {
	private readonly apiKey: string;
	private readonly apiUrl: string;
	private readonly model: string;
	private readonly fetchFn: FetchFn;

	constructor(options: GlmLlmOptions);
	constructor(apiKey: string, apiUrl?: string, fetchFn?: FetchFn);
	constructor(optionsOrKey: GlmLlmOptions | string, apiUrl?: string, fetchFn?: FetchFn) {
		if (typeof optionsOrKey === "string") {
			this.apiKey = optionsOrKey;
			this.apiUrl = apiUrl ?? DEFAULT_URL;
			this.model = DEFAULT_MODEL;
			this.fetchFn = fetchFn ?? globalThis.fetch;
		} else {
			this.apiKey = optionsOrKey.apiKey;
			this.apiUrl = optionsOrKey.apiUrl ?? DEFAULT_URL;
			this.model = optionsOrKey.model ?? DEFAULT_MODEL;
			this.fetchFn = optionsOrKey.fetchFn ?? globalThis.fetch;
		}
	}

	async generate(systemPrompt: string, userPrompt: string): Promise<string> {
		const response = await this.fetchFn(this.apiUrl, {
			method: "POST",
			signal: AbortSignal.timeout(30_000),
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: this.model,
				max_tokens: 8192,
				messages: [
					{ role: "system", content: systemPrompt },
					{ role: "user", content: userPrompt },
				],
			}),
		});

		if (!response.ok) {
			throw new Error(`GLM API error: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as GlmResponse;
		const content = data.choices[0]?.message.content;
		if (!content) {
			throw new Error("Empty response from GLM API");
		}

		return content;
	}
}
