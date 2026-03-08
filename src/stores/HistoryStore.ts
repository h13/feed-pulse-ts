import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod/v4";
import { type PublishResult, PublishResultSchema } from "../entities/PublishResult.js";

const HistoryFileSchema = z.array(PublishResultSchema);

export class HistoryStore {
	constructor(private readonly dir: string) {}

	async save(result: PublishResult): Promise<void> {
		const date = result.publishedAt.slice(0, 10);
		const filePath = join(this.dir, `${date}.json`);
		const existing = await this.loadByDate(date);
		const updated = [...existing, result];
		await mkdir(this.dir, { recursive: true });
		await writeFile(filePath, JSON.stringify(updated, null, 2));
	}

	async loadByDate(date: string): Promise<PublishResult[]> {
		try {
			const filePath = join(this.dir, `${date}.json`);
			const content = await readFile(filePath, "utf-8");
			return HistoryFileSchema.parse(JSON.parse(content));
		} catch {
			return [];
		}
	}
}
