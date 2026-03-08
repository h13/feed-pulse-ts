import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StateStore } from "./StateStore.js";

const tmpDir = join(import.meta.dirname, "../../tmp-test-state");

beforeEach(async () => {
	await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("StateStore", () => {
	it("should report url as not processed initially", async () => {
		const store = new StateStore(join(tmpDir, "processed.json"));
		const result = await store.isProcessed("https://example.com/article-1");
		expect(result).toBe(false);
	});

	it("should mark url as processed", async () => {
		const store = new StateStore(join(tmpDir, "processed.json"));
		await store.markProcessed("https://example.com/article-1");
		const result = await store.isProcessed("https://example.com/article-1");
		expect(result).toBe(true);
	});

	it("should persist state across instances", async () => {
		const filePath = join(tmpDir, "processed.json");
		const store1 = new StateStore(filePath);
		await store1.markProcessed("https://example.com/article-1");

		const store2 = new StateStore(filePath);
		const result = await store2.isProcessed("https://example.com/article-1");
		expect(result).toBe(true);
	});

	it("should update lastRun timestamp", async () => {
		const store = new StateStore(join(tmpDir, "processed.json"));
		await store.markProcessed("https://example.com/article-1");
		const state = await store.load();
		expect(state.lastRun).toBeDefined();
		expect(new Date(state.lastRun).getTime()).toBeGreaterThan(0);
	});

	it("should not duplicate already processed urls", async () => {
		const store = new StateStore(join(tmpDir, "processed.json"));
		await store.markProcessed("https://example.com/article-1");
		await store.markProcessed("https://example.com/article-1");
		const state = await store.load();
		expect(state.processedUrls.filter((u) => u === "https://example.com/article-1")).toHaveLength(
			1,
		);
	});

	it("should return default state for corrupted file", async () => {
		const filePath = join(tmpDir, "processed.json");
		const { writeFile } = await import("node:fs/promises");
		await writeFile(filePath, "not valid json");
		const store = new StateStore(filePath);
		const state = await store.load();
		expect(state.processedUrls).toEqual([]);
		expect(state.lastRun).toBe("");
	});

	it("should trim oldest urls when exceeding max size", async () => {
		const filePath = join(tmpDir, "processed.json");
		const { writeFile } = await import("node:fs/promises");
		const urls = Array.from({ length: 10_000 }, (_, i) => `https://example.com/article-${i}`);
		await writeFile(filePath, JSON.stringify({ processedUrls: urls, lastRun: "" }));

		const store = new StateStore(filePath);
		await store.markProcessed("https://example.com/new-article");
		const state = await store.load();
		expect(state.processedUrls).toHaveLength(10_000);
		expect(state.processedUrls[state.processedUrls.length - 1]).toBe(
			"https://example.com/new-article",
		);
		expect(state.processedUrls).not.toContain("https://example.com/article-0");
	});
});
