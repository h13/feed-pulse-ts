import { join } from "node:path";
import pino from "pino";
import { Container } from "../di/Container.js";
import type { Draft } from "../entities/Draft.js";

const logger = pino({ name: "pipeline" });

async function main(): Promise<void> {
	const projectRoot = join(import.meta.dirname, "../..");
	const container = await Container.create({
		configDir: join(projectRoot, "config"),
		stateDir: join(projectRoot, "state"),
		promptsDir: join(projectRoot, "prompts"),
		env: process.env as Record<string, string | undefined>,
	});

	// Phase 1: Crawl
	logger.info("Phase 1: Crawling feeds...");
	const fetchResults = await Promise.allSettled(container.sources.map((s) => s.fetch()));
	const allItems = fetchResults.flatMap((result) => {
		if (result.status === "fulfilled") {
			return result.value;
		}
		logger.error({ error: result.reason }, "Failed to fetch feed");
		return [];
	});
	logger.info({ count: allItems.length }, "Fetched feed items");

	// Phase 1: Match
	const scored = container.matcher.match(allItems);
	logger.info({ count: scored.length }, "Matched items above threshold");

	// Filter already processed (load once, O(1) lookup per item)
	const state = await container.stateStore.load();
	const processedSet = new Set(state.processedUrls);
	const newItems = scored.filter((item) => !processedSet.has(item.feed.link));
	logger.info({ count: newItems.length }, "New items to process");

	if (newItems.length === 0) {
		logger.info("No new items to process");
		return;
	}

	// Phase 2: Generate Drafts
	logger.info("Phase 2: Generating drafts...");
	const drafts: Draft[] = [];
	const draftedUrls = new Set<string>();

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
			draftedUrls.add(item.feed.link);
			count++;
		}
	}

	// Only mark items as processed that actually had drafts generated
	for (const url of draftedUrls) {
		await container.stateStore.markProcessed(url);
	}

	logger.info({ count: drafts.length }, "Drafts generated");

	// Notify
	await container.notifier.notify(drafts);
	logger.info("Pipeline complete");
}

main().catch((error) => {
	logger.fatal({ error }, "Pipeline failed");
	process.exit(1);
});
