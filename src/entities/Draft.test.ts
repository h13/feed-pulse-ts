import { describe, expect, it } from "vitest";
import { DraftSchema, type Draft } from "./Draft.js";
import type { FeedItem } from "./FeedItem.js";
import type { ScoredItem } from "./ScoredItem.js";

describe("DraftSchema", () => {
	const feed: FeedItem = {
		title: "Test Article",
		link: "https://example.com/test",
		description: "Test desc",
		pubDate: "2026-03-08T08:00:00Z",
		source: "HN",
		category: "tech",
	};

	const item: ScoredItem = {
		feed,
		score: 1.0,
		matchedTopics: ["AI & LLM"],
	};

	const validDraft: Draft = {
		id: "x-test-article",
		channel: "x",
		content: "Check out this article about AI!",
		item,
		createdAt: "2026-03-08T09:00:00Z",
	};

	it("should parse a valid Draft", () => {
		const result = DraftSchema.parse(validDraft);
		expect(result).toEqual(validDraft);
	});

	it("should reject empty content", () => {
		expect(() => DraftSchema.parse({ ...validDraft, content: "" })).toThrow();
	});

	it("should reject empty id", () => {
		expect(() => DraftSchema.parse({ ...validDraft, id: "" })).toThrow();
	});
});
