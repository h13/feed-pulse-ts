import { describe, expect, it, vi } from "vitest";
import type { PublisherInterface } from "../contracts/PublisherInterface.js";
import type { Draft } from "../entities/Draft.js";
import { PublisherPool } from "./PublisherPool.js";

const makeDraft = (channel: string): Draft => ({
	id: `${channel}-test`,
	channel,
	content: "Content",
	item: {
		feed: {
			title: "Test",
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

describe("PublisherPool", () => {
	it("should dispatch to the correct publisher", async () => {
		const xPublisher: PublisherInterface = {
			publish: vi.fn().mockResolvedValue({
				channel: "x",
				title: "Test",
				url: "https://x.com/i/status/123",
				error: null,
				publishedAt: "2026-03-08T10:00:00Z",
			}),
		};

		const pool = new PublisherPool(new Map([["x", xPublisher]]));
		const result = await pool.publish(makeDraft("x"));
		expect(result.url).toBe("https://x.com/i/status/123");
		expect(xPublisher.publish).toHaveBeenCalled();
	});

	it("should return error for unknown channel", async () => {
		const pool = new PublisherPool(new Map());
		const result = await pool.publish(makeDraft("unknown"));
		expect(result.error).toContain("No publisher");
		expect(result.url).toBeNull();
	});
});
