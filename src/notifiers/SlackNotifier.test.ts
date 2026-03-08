import { describe, expect, it, vi } from "vitest";
import type { Draft } from "../entities/Draft.js";
import { SlackNotifier } from "./SlackNotifier.js";

const makeDraft = (id: string, channel: string): Draft => ({
	id,
	channel,
	content: "Generated content here",
	item: {
		feed: {
			title: "Test Article",
			link: "https://example.com/test",
			description: "Test description",
			pubDate: "2026-03-08T08:00:00Z",
			source: "HN",
			category: "tech",
		},
		score: 1.0,
		matchedTopics: ["AI & LLM"],
	},
	createdAt: "2026-03-08T09:00:00Z",
});

describe("SlackNotifier", () => {
	it("should send notification with draft summary", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true });

		const notifier = new SlackNotifier("https://hooks.slack.com/test", mockFetch);
		await notifier.notify([makeDraft("x-test-1", "x"), makeDraft("blog-test-1", "blog")]);

		expect(mockFetch).toHaveBeenCalledTimes(1);
		const [url, options] = mockFetch.mock.calls[0]!;
		expect(url).toBe("https://hooks.slack.com/test");
		const body = JSON.parse(options.body as string);
		expect(body.blocks).toBeDefined();
	});

	it("should not throw on webhook failure", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
		const notifier = new SlackNotifier("https://hooks.slack.com/test", mockFetch);
		await expect(notifier.notify([makeDraft("x-test", "x")])).resolves.toBeUndefined();
	});

	it("should not call webhook when no drafts", async () => {
		const mockFetch = vi.fn();
		const notifier = new SlackNotifier("https://hooks.slack.com/test", mockFetch);
		await notifier.notify([]);
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
