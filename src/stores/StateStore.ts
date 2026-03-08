import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod/v4";

const StateSchema = z.object({
	processedUrls: z.array(z.string()),
	lastRun: z.string(),
});

type State = z.infer<typeof StateSchema>;

const MAX_PROCESSED_URLS = 10_000;

export class StateStore {
	constructor(private readonly filePath: string) {}

	async load(): Promise<State> {
		try {
			const content = await readFile(this.filePath, "utf-8");
			return StateSchema.parse(JSON.parse(content));
		} catch {
			return { processedUrls: [], lastRun: "" };
		}
	}

	async isProcessed(url: string): Promise<boolean> {
		const state = await this.load();
		return state.processedUrls.includes(url);
	}

	async markProcessed(url: string): Promise<void> {
		const state = await this.load();
		if (state.processedUrls.includes(url)) {
			return;
		}
		const urls = [...state.processedUrls, url];
		const trimmed = urls.length > MAX_PROCESSED_URLS ? urls.slice(-MAX_PROCESSED_URLS) : urls;
		const updated: State = {
			processedUrls: trimmed,
			lastRun: new Date().toISOString(),
		};
		await mkdir(dirname(this.filePath), { recursive: true });
		await writeFile(this.filePath, JSON.stringify(updated, null, 2));
	}
}
