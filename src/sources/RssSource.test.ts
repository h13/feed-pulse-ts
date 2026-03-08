import { describe, expect, it, vi } from "vitest";
import { RssSource } from "./RssSource.js";

describe("RssSource", () => {
	it("should parse RSS feed items", async () => {
		const mockParser = {
			parseURL: vi.fn().mockResolvedValue({
				items: [
					{
						title: "Test Article",
						link: "https://example.com/article-1",
						contentSnippet: "A great article about AI",
						isoDate: "2026-03-08T08:00:00Z",
					},
					{
						title: "Second Article",
						link: "https://example.com/article-2",
						contentSnippet: "TypeScript is awesome",
						isoDate: "2026-03-08T09:00:00Z",
					},
				],
			}),
		};

		const source = new RssSource(
			{ name: "Test Feed", url: "https://example.com/feed", category: "tech" },
			mockParser as never,
		);

		const items = await source.fetch();
		expect(items).toHaveLength(2);
		expect(items[0]?.title).toBe("Test Article");
		expect(items[0]?.source).toBe("Test Feed");
		expect(items[0]?.category).toBe("tech");
		expect(items[0]?.description).toBe("A great article about AI");
	});

	it("should handle items with missing fields gracefully", async () => {
		const mockParser = {
			parseURL: vi.fn().mockResolvedValue({
				items: [
					{
						title: "No Snippet",
						link: "https://example.com/no-snippet",
					},
				],
			}),
		};

		const source = new RssSource(
			{ name: "Test Feed", url: "https://example.com/feed", category: "tech" },
			mockParser as never,
		);

		const items = await source.fetch();
		expect(items).toHaveLength(1);
		expect(items[0]?.description).toBe("");
		expect(items[0]?.pubDate).toBeDefined();
	});

	it("should skip items without link", async () => {
		const mockParser = {
			parseURL: vi.fn().mockResolvedValue({
				items: [
					{ title: "No Link", contentSnippet: "Missing link field" },
					{
						title: "Has Link",
						link: "https://example.com/has-link",
						contentSnippet: "Has link",
					},
				],
			}),
		};

		const source = new RssSource(
			{ name: "Test Feed", url: "https://example.com/feed", category: "tech" },
			mockParser as never,
		);

		const items = await source.fetch();
		expect(items).toHaveLength(1);
		expect(items[0]?.title).toBe("Has Link");
	});

	it("should handle parser errors", async () => {
		const mockParser = {
			parseURL: vi.fn().mockRejectedValue(new Error("Network error")),
		};

		const source = new RssSource(
			{ name: "Test Feed", url: "https://example.com/feed", category: "tech" },
			mockParser as never,
		);

		await expect(source.fetch()).rejects.toThrow("Failed to fetch feed");
	});
});
