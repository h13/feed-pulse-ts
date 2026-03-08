export interface LlmInterface {
	generate(systemPrompt: string, userPrompt: string): Promise<string>;
}
