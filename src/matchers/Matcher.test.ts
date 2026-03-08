import { describe, expect, it } from "vitest";
import type { FeedItem } from "../entities/FeedItem.js";
import { Matcher } from "./Matcher.js";

const interests = [
	{ topic: "AI & LLM", keywords: ["artificial intelligence", "claude", "gpt"], weight: 1.0 },
	{ topic: "Software Engineering", keywords: ["typescript", "rust", "devops"], weight: 0.8 },
];

const makeItem = (title: string, description: string): FeedItem => ({
	title,
	link: `https://example.com/${title.toLowerCase().replace(/\s/g, "-")}`,
	description,
	pubDate: "2026-03-08T08:00:00Z",
	source: "HN",
	category: "tech",
});

describe("Matcher", () => {
	const matcher = new Matcher(interests, 0.5);

	it("should match items containing keywords", () => {
		const items = [makeItem("Claude 4 Released", "New artificial intelligence model")];
		const results = matcher.match(items);
		expect(results).toHaveLength(1);
		expect(results[0]?.matchedTopics).toContain("AI & LLM");
	});

	it("should accumulate weights from multiple topics", () => {
		const items = [makeItem("AI TypeScript SDK", "New Claude SDK for TypeScript developers")];
		const results = matcher.match(items);
		expect(results).toHaveLength(1);
		expect(results[0]?.score).toBe(1.8);
		expect(results[0]?.matchedTopics).toContain("AI & LLM");
		expect(results[0]?.matchedTopics).toContain("Software Engineering");
	});

	it("should filter out items below threshold", () => {
		const items = [makeItem("Cooking Recipe", "How to make pasta at home")];
		const results = matcher.match(items);
		expect(results).toHaveLength(0);
	});

	it("should sort by score descending", () => {
		const items = [
			makeItem("Rust Update", "New rust compiler improvements"),
			makeItem("Claude AI TypeScript", "New Claude SDK for TypeScript"),
		];
		const results = matcher.match(items);
		expect(results).toHaveLength(2);
		expect(results[0]?.score).toBeGreaterThanOrEqual(results[1]?.score ?? 0);
	});

	it("should count each topic only once per item", () => {
		const items = [
			makeItem("Claude GPT Comparison", "Claude vs GPT artificial intelligence comparison"),
		];
		const results = matcher.match(items);
		expect(results).toHaveLength(1);
		expect(results[0]?.score).toBe(1.0);
	});

	it("should be case-insensitive", () => {
		const items = [makeItem("TYPESCRIPT Is Great", "DEVOPS best practices")];
		const results = matcher.match(items);
		expect(results).toHaveLength(1);
	});
});
