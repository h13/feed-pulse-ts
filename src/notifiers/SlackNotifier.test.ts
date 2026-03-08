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
		const call = mockFetch.mock.calls[0];
		expect(call).toBeDefined();
		const [url, options] = call ?? [];
		expect(url).toBe("https://hooks.slack.com/test");
		const body = JSON.parse((options as RequestInit).body as string);
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

	it("should not throw on network error", async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error("DNS resolution failed"));
		const notifier = new SlackNotifier("https://hooks.slack.com/test", mockFetch);
		await expect(notifier.notify([makeDraft("x-test", "x")])).resolves.toBeUndefined();
	});

	it("should escape mrkdwn special characters in content", async () => {
		const mockFetch = vi.fn().mockResolvedValue({ ok: true });
		const notifier = new SlackNotifier("https://hooks.slack.com/test", mockFetch);

		const draft: Draft = {
			id: "x-inject",
			channel: "x",
			content: "<script>alert('xss')</script> & *bold* attack",
			item: {
				feed: {
					title: "Test <b>HTML</b> & *mrkdwn*",
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
		};

		await notifier.notify([draft]);

		const body = JSON.parse(mockFetch.mock.calls[0]?.[1]?.body as string);
		const sectionText = body.blocks[1].text.text;
		expect(sectionText).toContain("&lt;b&gt;HTML&lt;/b&gt;");
		expect(sectionText).toContain("&amp;");
		expect(sectionText).not.toContain("<b>");
		expect(sectionText).not.toContain("<script>");
	});
});
