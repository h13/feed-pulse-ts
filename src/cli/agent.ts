import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import pino from "pino";
import { Container } from "../di/Container.js";

const logger = pino({ name: "agent" });

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

	const messages: Anthropic.Messages.MessageParam[] = [
		{ role: "user", content: userMessage },
	];

	let continueLoop = true;
	while (continueLoop) {
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
				result = await executeTool(toolUse.name, container);
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
}

async function executeTool(name: string, container: Container): Promise<string> {
	switch (name) {
		case "fetch_feeds": {
			const allItems = [];
			for (const source of container.sources) {
				const items = await source.fetch();
				allItems.push(...items);
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
		case "list_drafts": {
			const drafts = await container.draftStore.loadAll();
			return JSON.stringify(
				drafts.map((d) => ({ id: d.id, channel: d.channel, title: d.item.feed.title })),
			);
		}
		case "publish_drafts": {
			const drafts = await container.draftStore.loadAll();
			const results = await container.publisherPool.publishAll(drafts);
			for (const result of results) {
				await container.historyStore.save(result);
			}
			for (const draft of drafts) {
				await container.draftStore.delete(draft.id);
			}
			return JSON.stringify(results);
		}
		default:
			return `Unknown tool: ${name}`;
	}
}

main().catch((error) => {
	logger.fatal({ error }, "Agent failed");
	process.exit(1);
});
