import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PublishResult } from "../entities/PublishResult.js";
import { HistoryStore } from "./HistoryStore.js";

const tmpDir = join(import.meta.dirname, "../../tmp-test-history");

beforeEach(async () => {
	await mkdir(tmpDir, { recursive: true });
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("HistoryStore", () => {
	const result: PublishResult = {
		channel: "x",
		title: "Test Article",
		url: "https://x.com/i/status/123",
		error: null,
		publishedAt: "2026-03-08T10:00:00Z",
	};

	it("should save a publish result", async () => {
		const store = new HistoryStore(tmpDir);
		await store.save(result);
		const history = await store.loadByDate("2026-03-08");
		expect(history).toHaveLength(1);
		expect(history[0]?.channel).toBe("x");
	});

	it("should append multiple results for the same date", async () => {
		const store = new HistoryStore(tmpDir);
		await store.save(result);
		await store.save({ ...result, title: "Second Article" });
		const history = await store.loadByDate("2026-03-08");
		expect(history).toHaveLength(2);
	});

	it("should return empty array for date with no history", async () => {
		const store = new HistoryStore(tmpDir);
		const history = await store.loadByDate("2099-01-01");
		expect(history).toHaveLength(0);
	});
});
