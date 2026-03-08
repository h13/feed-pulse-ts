import { describe, expect, it, vi } from "vitest";
import { XPublisher } from "./XPublisher.js";
import type { Draft } from "../entities/Draft.js";

const makeDraft = (): Draft => ({
	id: "x-test",
	channel: "x",
	content: "Check out this article!",
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

describe("XPublisher", () => {
	it("should publish a tweet successfully", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ data: { id: "12345" } }),
		});

		const publisher = new XPublisher(
			{
				apiKey: "key",
				apiSecret: "secret",
				accessToken: "token",
				accessSecret: "access-secret",
			},
			mockFetch,
		);

		const result = await publisher.publish(makeDraft());
		expect(result.url).toBe("https://x.com/i/status/12345");
		expect(result.error).toBeNull();
		expect(result.channel).toBe("x");
	});

	it("should return error on API failure", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 403,
			statusText: "Forbidden",
		});

		const publisher = new XPublisher(
			{
				apiKey: "key",
				apiSecret: "secret",
				accessToken: "token",
				accessSecret: "access-secret",
			},
			mockFetch,
		);

		const result = await publisher.publish(makeDraft());
		expect(result.url).toBeNull();
		expect(result.error).toContain("403");
	});
});
