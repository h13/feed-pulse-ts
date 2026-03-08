import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod/v4";
import { type PublishResult, PublishResultSchema } from "../entities/PublishResult.js";

const HistoryFileSchema = z.array(PublishResultSchema);
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(date: string): string {
	if (!DATE_REGEX.test(date)) {
		throw new Error(`Invalid date format: ${date}`);
	}
	return date;
}

function safePath(baseDir: string, filename: string): string {
	const filePath = resolve(baseDir, filename);
	if (!filePath.startsWith(resolve(baseDir))) {
		throw new Error(`Invalid path: ${filename}`);
	}
	return filePath;
}

export class HistoryStore {
	constructor(private readonly dir: string) {}

	async save(result: PublishResult): Promise<void> {
		const date = validateDate(result.publishedAt.slice(0, 10));
		const filePath = safePath(this.dir, `${date}.json`);
		const existing = await this.loadByDate(date);
		const updated = [...existing, result];
		await mkdir(this.dir, { recursive: true });
		await writeFile(filePath, JSON.stringify(updated, null, 2));
	}

	async loadByDate(date: string): Promise<PublishResult[]> {
		try {
			const validDate = validateDate(date);
			const filePath = safePath(this.dir, `${validDate}.json`);
			const content = await readFile(filePath, "utf-8");
			return HistoryFileSchema.parse(JSON.parse(content));
		} catch {
			return [];
		}
	}
}
