import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ScoredItem } from "../entities/ScoredItem.js";

export class PromptBuilder {
	constructor(private readonly promptsDir: string) {}

	async buildSystemPrompt(
		templateFile: string,
		variables: Record<string, string>,
	): Promise<string> {
		const template = await this.loadTemplate(templateFile);
		return this.replaceVariables(template, variables);
	}

	async buildUserPrompt(templateFile: string, item: ScoredItem): Promise<string> {
		const template = await this.loadTemplate(templateFile);
		return this.replaceVariables(template, {
			title: item.feed.title,
			description: item.feed.description,
			link: item.feed.link,
			topics: item.matchedTopics.join(", "),
		});
	}

	private async loadTemplate(templateFile: string): Promise<string> {
		const filePath = join(this.promptsDir, templateFile);
		return readFile(filePath, "utf-8");
	}

	private replaceVariables(template: string, variables: Record<string, string>): string {
		const pattern = /\{\{(\w+)\}\}/g;
		return template.replace(pattern, (match, key: string) => variables[key] ?? match);
	}
}
