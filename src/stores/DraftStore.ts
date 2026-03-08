import { readFile, writeFile, readdir, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DraftSchema, type Draft } from "../entities/Draft.js";

export class DraftStore {
	constructor(private readonly dir: string) {}

	async save(draft: Draft): Promise<void> {
		await mkdir(this.dir, { recursive: true });
		const filePath = join(this.dir, `${draft.id}.json`);
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
		const filePath = join(this.dir, `${id}.json`);
		await unlink(filePath);
	}
}
