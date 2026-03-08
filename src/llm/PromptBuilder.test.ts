import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { PromptBuilder } from "./PromptBuilder.js";
import type { ScoredItem } from "../entities/ScoredItem.js";

const tmpDir = join(import.meta.dirname, "../../tmp-test-prompts");

const scoredItem: ScoredItem = {
	feed: {
		title: "Claude 4 Released",
		link: "https://example.com/claude-4",
		description: "Anthropic releases Claude 4 with breakthrough capabilities",
		pubDate: "2026-03-08T08:00:00Z",
		source: "TechCrunch",
		category: "tech",
	},
	score: 1.8,
	matchedTopics: ["AI & LLM", "Software Engineering"],
};

beforeEach(async () => {
	await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("PromptBuilder", () => {
	it("should build system prompt from voice template", async () => {
		await writeFile(join(tmpDir, "voice.md"), "You are a tech commentator. Tone: {{tone}}");
		const builder = new PromptBuilder(tmpDir);
		const prompt = await builder.buildSystemPrompt("voice.md", {
			tone: "casual",
		});
		expect(prompt).toBe("You are a tech commentator. Tone: casual");
	});

	it("should build user prompt with item variables", async () => {
		await writeFile(
			join(tmpDir, "sns-post.md"),
			"Write about: {{title}}\n\nSource: {{link}}\nTopics: {{topics}}\n\n{{description}}",
		);
		const builder = new PromptBuilder(tmpDir);
		const prompt = await builder.buildUserPrompt("sns-post.md", scoredItem);
		expect(prompt).toContain("Claude 4 Released");
		expect(prompt).toContain("https://example.com/claude-4");
		expect(prompt).toContain("AI & LLM, Software Engineering");
		expect(prompt).toContain("Anthropic releases Claude 4");
	});

	it("should throw for missing template file", async () => {
		const builder = new PromptBuilder(tmpDir);
		await expect(builder.buildSystemPrompt("nonexistent.md", {})).rejects.toThrow();
	});
});
