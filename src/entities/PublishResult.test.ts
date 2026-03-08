import { describe, expect, it } from "vitest";
import { PublishResultSchema, type PublishResult } from "./PublishResult.js";

describe("PublishResultSchema", () => {
	it("should parse a successful result", () => {
		const result: PublishResult = {
			channel: "x",
			title: "Test Article",
			url: "https://x.com/i/status/123",
			error: null,
			publishedAt: "2026-03-08T10:00:00Z",
		};
		expect(PublishResultSchema.parse(result)).toEqual(result);
	});

	it("should parse a failed result", () => {
		const result: PublishResult = {
			channel: "x",
			title: "Test Article",
			url: null,
			error: "Rate limited",
			publishedAt: "2026-03-08T10:00:00Z",
		};
		expect(PublishResultSchema.parse(result)).toEqual(result);
	});

	it("should reject empty channel", () => {
		expect(() =>
			PublishResultSchema.parse({
				channel: "",
				title: "Test",
				url: null,
				error: null,
				publishedAt: "2026-03-08T10:00:00Z",
			}),
		).toThrow();
	});
});
