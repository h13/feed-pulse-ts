import { describe, expect, it } from "vitest";
import { ScoredItemSchema, type ScoredItem } from "./ScoredItem.js";
import type { FeedItem } from "./FeedItem.js";

describe("ScoredItemSchema", () => {
	const feed: FeedItem = {
		title: "AI Breakthrough",
		link: "https://example.com/ai",
		description: "New LLM advances",
		pubDate: "2026-03-08T08:00:00Z",
		source: "TechCrunch",
		category: "tech",
	};

	const validItem: ScoredItem = {
		feed,
		score: 1.8,
		matchedTopics: ["AI & LLM"],
	};

	it("should parse a valid ScoredItem", () => {
		const result = ScoredItemSchema.parse(validItem);
		expect(result).toEqual(validItem);
	});

	it("should reject negative score", () => {
		expect(() => ScoredItemSchema.parse({ ...validItem, score: -1 })).toThrow();
	});

	it("should reject empty matchedTopics", () => {
		expect(() => ScoredItemSchema.parse({ ...validItem, matchedTopics: [] })).toThrow();
	});
});
