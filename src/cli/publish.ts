import { join } from "node:path";
import pino from "pino";
import { Container } from "../di/Container.js";

const logger = pino({ name: "publish" });

async function main(): Promise<void> {
	const draftId = process.argv[2];
	const projectRoot = join(import.meta.dirname, "../..");
	const container = await Container.create({
		configDir: join(projectRoot, "config"),
		stateDir: join(projectRoot, "state"),
		promptsDir: join(projectRoot, "prompts"),
		env: process.env as Record<string, string | undefined>,
	});

	// Phase 3: Publish
	logger.info("Phase 3: Publishing drafts...");
	const allDrafts = await container.draftStore.loadAll();

	const draftsToPublish = draftId ? allDrafts.filter((d) => d.id === draftId) : allDrafts;

	if (draftsToPublish.length === 0) {
		logger.info("No drafts to publish");
		return;
	}

	logger.info({ count: draftsToPublish.length }, "Publishing drafts");

	const results = await container.publisherPool.publishAll(draftsToPublish);

	for (const result of results) {
		if (result.error) {
			logger.error({ channel: result.channel, error: result.error }, "Publish failed");
		} else {
			logger.info({ channel: result.channel, url: result.url }, "Published");
		}

		await container.historyStore.save(result);
	}

	// Cleanup only successfully published drafts
	for (let i = 0; i < results.length; i++) {
		if (!results[i]?.error) {
			const draft = draftsToPublish[i];
			if (draft) {
				await container.draftStore.delete(draft.id);
			}
		}
	}

	logger.info("Publish complete");
}

main().catch((error) => {
	logger.fatal({ error }, "Publish failed");
	process.exit(1);
});
