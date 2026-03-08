import { describe, expect, it, vi } from "vitest";
import type { Draft } from "../entities/Draft.js";
import { WordPressPublisher } from "./WordPressPublisher.js";

const makeDraft = (): Draft => ({
	id: "blog-test",
	channel: "blog",
	content: "<h1>Test Article</h1><p>Content here</p>",
	item: {
		feed: {
			title: "Test Article",
			link: "https://example.com/test",
			description: "Test",
			pubDate: "2026-03-08T08:00:00Z",
			source: "HN",
			category: "tech",
		},
		score: 1.0,
		matchedTopics: ["AI"],
	},
	createdAt: "2026-03-08T09:00:00Z",
});

describe("WordPressPublisher", () => {
	it("should publish a post successfully", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ link: "https://blog.example.com/test-article" }),
		});

		const publisher = new WordPressPublisher(
			{
				apiUrl: "https://blog.example.com/wp-json/wp/v2",
				user: "admin",
				appPassword: "xxxx-xxxx",
				status: "draft",
			},
			mockFetch,
		);

		const result = await publisher.publish(makeDraft());
		expect(result.url).toBe("https://blog.example.com/test-article");
		expect(result.error).toBeNull();
	});

	it("should return error on API failure", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
		});

		const publisher = new WordPressPublisher(
			{
				apiUrl: "https://blog.example.com/wp-json/wp/v2",
				user: "admin",
				appPassword: "xxxx-xxxx",
				status: "draft",
			},
			mockFetch,
		);

		const result = await publisher.publish(makeDraft());
		expect(result.url).toBeNull();
		expect(result.error).toContain("401");
	});
});
