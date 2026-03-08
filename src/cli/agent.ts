import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import pino from "pino";
import { Container } from "../di/Container.js";
import type { Draft } from "../entities/Draft.js";
import type { FeedItem } from "../entities/FeedItem.js";
import type { ScoredItem } from "../entities/ScoredItem.js";

const logger = pino({ name: "agent" });
const MAX_ITERATIONS = 20;

async function main(): Promise<void> {
	const userMessage = process.argv.slice(2).join(" ");
	if (!userMessage) {
		logger.error("Usage: agent <message>");
		process.exit(1);
	}

	const projectRoot = join(import.meta.dirname, "../..");
	const container = await Container.create({
		configDir: join(projectRoot, "config"),
		stateDir: join(projectRoot, "state"),
		promptsDir: join(projectRoot, "prompts"),
		env: process.env as Record<string, string | undefined>,
	});

	const apiKey = process.env.ANTHROPIC_API_KEY;
	if (!apiKey) {
		throw new Error("ANTHROPIC_API_KEY is required for agent mode");
	}

	const client = new Anthropic({ apiKey });

	const tools: Anthropic.Messages.Tool[] = [
		{
			name: "fetch_feeds",
			description: "Fetch all configured RSS feeds and return matched items",
			input_schema: { type: "object" as const, properties: {} },
		},
		{
			name: "generate_drafts",
			description: "Generate drafts for matched items",
			input_schema: {
				type: "object" as const,
				properties: {
					max_items: {
						type: "number",
						description: "Maximum number of items to generate drafts for",
					},
				},
			},
		},
		{
			name: "list_drafts",
			description: "List all pending drafts",
			input_schema: { type: "object" as const, properties: {} },
		},
		{
			name: "publish_drafts",
			description: "Publish all pending drafts",
			input_schema: { type: "object" as const, properties: {} },
		},
	];

	const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: userMessage }];

	let iterations = 0;
	let continueLoop = true;
	while (continueLoop && iterations < MAX_ITERATIONS) {
		iterations++;
		const response = await client.messages.create({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1024,
			system:
				"You are a feed management assistant. Use the available tools to help the user manage their RSS feeds, generate content drafts, and publish them.",
			tools,
			messages,
		});

		messages.push({ role: "assistant", content: response.content });

		if (response.stop_reason === "end_turn") {
			const textBlocks = response.content.filter((b) => b.type === "text");
			for (const block of textBlocks) {
				if (block.type === "text") {
					process.stdout.write(`${block.text}\n`);
				}
			}
			continueLoop = false;
			continue;
		}

		const toolUses = response.content.filter((b) => b.type === "tool_use");
		const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

		for (const toolUse of toolUses) {
			if (toolUse.type !== "tool_use") continue;
			logger.info({ tool: toolUse.name }, "Executing tool");

			let result: string;
			try {
				result = await executeTool(
					toolUse.name,
					toolUse.input as Record<string, unknown>,
					container,
				);
			} catch (error) {
				result = `Error: ${error instanceof Error ? error.message : "Unknown error"}`;
			}

			toolResults.push({
				type: "tool_result",
				tool_use_id: toolUse.id,
				content: result,
			});
		}

		messages.push({ role: "user", content: toolResults });
	}

	if (iterations >= MAX_ITERATIONS) {
		logger.warn("Agent reached maximum iteration limit");
	}
}

async function executeTool(
	name: string,
	input: Record<string, unknown>,
	container: Container,
): Promise<string> {
	switch (name) {
		case "fetch_feeds": {
			const allItems: FeedItem[] = [];
			const results = await Promise.allSettled(container.sources.map((s) => s.fetch()));
			for (const result of results) {
				if (result.status === "fulfilled") {
					allItems.push(...result.value);
				} else {
					logger.error({ error: result.reason }, "Failed to fetch feed");
				}
			}
			const scored = container.matcher.match(allItems);
			return JSON.stringify({
				total: allItems.length,
				matched: scored.length,
				items: scored.slice(0, 10).map((s) => ({
					title: s.feed.title,
					score: s.score,
					topics: s.matchedTopics,
				})),
			});
		}
		case "generate_drafts": {
			return generateDrafts(container, input);
		}
		case "list_drafts": {
			const drafts = await container.draftStore.loadAll();
			return JSON.stringify(
				drafts.map((d) => ({ id: d.id, channel: d.channel, title: d.item.feed.title })),
			);
		}
		case "publish_drafts": {
			const drafts = await container.draftStore.loadAll();
			const publishResults = await container.publisherPool.publishAll(drafts);
			for (const result of publishResults) {
				await container.historyStore.save(result);
			}
			for (let i = 0; i < publishResults.length; i++) {
				if (!publishResults[i]?.error) {
					const draft = drafts[i];
					if (draft) {
						await container.draftStore.delete(draft.id);
					}
				}
			}
			return JSON.stringify(publishResults);
		}
		default:
			return `Unknown tool: ${name}`;
	}
}

async function generateDrafts(
	container: Container,
	input: Record<string, unknown>,
): Promise<string> {
	const maxItems = typeof input.max_items === "number" ? input.max_items : 5;

	const allItems: FeedItem[] = [];
	const fetchResults = await Promise.allSettled(container.sources.map((s) => s.fetch()));
	for (const result of fetchResults) {
		if (result.status === "fulfilled") {
			allItems.push(...result.value);
		}
	}

	const scored = container.matcher.match(allItems);
	const newItems: ScoredItem[] = [];
	for (const item of scored) {
		if (newItems.length >= maxItems) break;
		const processed = await container.stateStore.isProcessed(item.feed.link);
		if (!processed) {
			newItems.push(item);
		}
	}

	const drafts: Draft[] = [];
	for (const channel of container.channels) {
		const { persona, publish, name: channelName } = channel.channel;
		let count = 0;

		for (const item of newItems) {
			if (count >= publish.max_per_day) break;

			const templateFile = channel.channel.type === "x" ? "sns-post.md" : "blog-article.md";
			const systemPrompt = await container.promptBuilder.buildSystemPrompt("voice.md", {
				tone: persona.tone,
				style: persona.style,
				language: persona.language,
				max_length: String(persona.max_length),
			});
			const userPrompt = await container.promptBuilder.buildUserPrompt(templateFile, item);
			const content = await container.llm.generate(systemPrompt, userPrompt);

			const slug = item.feed.title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.slice(0, 60);
			const draft: Draft = {
				id: `${channelName}-${slug}`,
				channel: channelName,
				content,
				item,
				createdAt: new Date().toISOString(),
			};

			await container.draftStore.save(draft);
			drafts.push(draft);
			count++;
		}
	}

	for (const item of newItems) {
		await container.stateStore.markProcessed(item.feed.link);
	}

	return JSON.stringify({
		generated: drafts.length,
		drafts: drafts.map((d) => ({ id: d.id, channel: d.channel, title: d.item.feed.title })),
	});
}

main().catch((error) => {
	logger.fatal({ error }, "Agent failed");
	process.exit(1);
});
