import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type Draft, DraftSchema } from "../entities/Draft.js";

function safePath(baseDir: string, filename: string): string {
	const filePath = resolve(baseDir, filename);
	if (!filePath.startsWith(resolve(baseDir))) {
		throw new Error(`Invalid path: ${filename}`);
	}
	return filePath;
}

export class DraftStore {
	constructor(private readonly dir: string) {}

	async save(draft: Draft): Promise<void> {
		await mkdir(this.dir, { recursive: true });
		const filePath = safePath(this.dir, `${draft.id}.json`);
		await writeFile(filePath, JSON.stringify(draft, null, 2));
	}

	async loadAll(): Promise<Draft[]> {
		try {
			const files = await readdir(this.dir);
			const jsonFiles = files.filter((f) => f.endsWith(".json"));
			const drafts = await Promise.all(
				jsonFiles.map(async (f) => {
					const content = await readFile(join(this.dir, f), "utf-8");
					return DraftSchema.parse(JSON.parse(content));
				}),
			);
			return drafts;
		} catch {
			return [];
		}
	}

	async delete(id: string): Promise<void> {
		const filePath = safePath(this.dir, `${id}.json`);
		try {
			await unlink(filePath);
		} catch {
			// Ignore ENOENT - file may already be deleted
		}
	}
}
