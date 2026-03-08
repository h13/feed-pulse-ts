import type { LlmInterface } from "../contracts/LlmInterface.js";

const DEFAULT_URL = "https://api.z.ai/api/coding/paas/v4/chat/completions";

type FetchFn = typeof globalThis.fetch;

interface GlmChoice {
	message: { content: string };
}

interface GlmResponse {
	choices: GlmChoice[];
}

export class GlmLlm implements LlmInterface {
	private readonly apiKey: string;
	private readonly apiUrl: string;
	private readonly fetchFn: FetchFn;

	constructor(apiKey: string, apiUrl?: string, fetchFn?: FetchFn) {
		this.apiKey = apiKey;
		this.apiUrl = apiUrl ?? DEFAULT_URL;
		this.fetchFn = fetchFn ?? globalThis.fetch;
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
				model: "glm-4.7",
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
