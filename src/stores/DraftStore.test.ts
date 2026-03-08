import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Draft } from "../entities/Draft.js";
import type { FeedItem } from "../entities/FeedItem.js";
import type { ScoredItem } from "../entities/ScoredItem.js";
import { DraftStore } from "./DraftStore.js";

const tmpDir = join(import.meta.dirname, "../../tmp-test-drafts");

const makeDraft = (id: string): Draft => {
	const feed: FeedItem = {
		title: "Test Article",
		link: "https://example.com/test",
		description: "Test description",
		pubDate: "2026-03-08T08:00:00Z",
		source: "HN",
		category: "tech",
	};
	const item: ScoredItem = { feed, score: 1.0, matchedTopics: ["AI"] };
	return {
		id,
		channel: "x",
		content: "Generated content",
		item,
		createdAt: "2026-03-08T09:00:00Z",
	};
};

beforeEach(async () => {
	await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("DraftStore", () => {
	it("should save and load a draft", async () => {
		const store = new DraftStore(tmpDir);
		const draft = makeDraft("x-test-article");
		await store.save(draft);
		const loaded = await store.loadAll();
		expect(loaded).toHaveLength(1);
		expect(loaded[0]?.id).toBe("x-test-article");
	});

	it("should delete a draft", async () => {
		const store = new DraftStore(tmpDir);
		await store.save(makeDraft("x-to-delete"));
		await store.delete("x-to-delete");
		const loaded = await store.loadAll();
		expect(loaded).toHaveLength(0);
	});

	it("should load multiple drafts", async () => {
		const store = new DraftStore(tmpDir);
		await store.save(makeDraft("x-draft-1"));
		await store.save(makeDraft("x-draft-2"));
		const loaded = await store.loadAll();
		expect(loaded).toHaveLength(2);
	});

	it("should return empty array when no drafts exist", async () => {
		const store = new DraftStore(tmpDir);
		const loaded = await store.loadAll();
		expect(loaded).toHaveLength(0);
	});

	it("should reject path traversal in draft id on save", async () => {
		const store = new DraftStore(tmpDir);
		const draft = makeDraft("../../../etc/passwd");
		await expect(store.save(draft)).rejects.toThrow("Invalid path");
	});

	it("should reject path traversal in draft id on delete", async () => {
		const store = new DraftStore(tmpDir);
		await expect(store.delete("../../../etc/passwd")).rejects.toThrow("Invalid path");
	});

	it("should not throw when deleting non-existent draft", async () => {
		const store = new DraftStore(tmpDir);
		await expect(store.delete("non-existent-id")).resolves.toBeUndefined();
	});
});
