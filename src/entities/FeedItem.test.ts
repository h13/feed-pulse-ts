import { describe, expect, it } from "vitest";
import { type FeedItem, FeedItemSchema } from "./FeedItem.js";

describe("FeedItemSchema", () => {
	const validItem: FeedItem = {
		title: "Test Article",
		link: "https://example.com/article-1",
		description: "A test description",
		pubDate: "2026-03-08T08:00:00Z",
		source: "Hacker News",
		category: "tech",
	};

	it("should parse a valid FeedItem", () => {
		const result = FeedItemSchema.parse(validItem);
		expect(result).toEqual(validItem);
	});

	it("should reject missing required fields", () => {
		const { title: _, ...partial } = validItem;
		expect(() => FeedItemSchema.parse(partial)).toThrow();
	});

	it("should reject invalid link URL", () => {
		expect(() => FeedItemSchema.parse({ ...validItem, link: "not-a-url" })).toThrow();
	});

	it("should reject empty title", () => {
		expect(() => FeedItemSchema.parse({ ...validItem, title: "" })).toThrow();
	});
});
