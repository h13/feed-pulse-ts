import Anthropic from "@anthropic-ai/sdk";
import type { LlmInterface } from "../contracts/LlmInterface.js";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export class ClaudeLlm implements LlmInterface {
	private readonly client: Anthropic;
	private readonly model: string;

	constructor(client?: Anthropic, model?: string) {
		this.client = client ?? new Anthropic();
		this.model = model ?? DEFAULT_MODEL;
	}

	async generate(systemPrompt: string, userPrompt: string): Promise<string> {
		const response = await this.client.messages.create({
			model: this.model,
			max_tokens: 1024,
			system: systemPrompt,
			messages: [{ role: "user", content: userPrompt }],
		});

		const textBlock = response.content.find((block) => block.type === "text");
		if (!textBlock || textBlock.type !== "text") {
			throw new Error("Empty response from Claude API");
		}

		return textBlock.text;
	}
}
