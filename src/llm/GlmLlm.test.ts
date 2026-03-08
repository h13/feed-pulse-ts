import { describe, expect, it, vi } from "vitest";
import { GlmLlm } from "./GlmLlm.js";

describe("GlmLlm", () => {
	it("should generate content via GLM API", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () =>
				Promise.resolve({
					choices: [{ message: { content: "GLM generated content" } }],
				}),
		});

		const llm = new GlmLlm(
			"test-api-key",
			"https://api.z.ai/api/coding/paas/v4/chat/completions",
			mockFetch,
		);
		const result = await llm.generate("System prompt", "User prompt");
		expect(result).toBe("GLM generated content");
	});

	it("should throw on API error response", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			statusText: "Internal Server Error",
		});

		const llm = new GlmLlm("test-api-key", "https://api.z.ai/api/coding/paas/v4/chat/completions", mockFetch);
		await expect(llm.generate("System", "User")).rejects.toThrow("GLM API error");
	});

	it("should throw on empty choices", async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ choices: [] }),
		});

		const llm = new GlmLlm("test-api-key", "https://api.z.ai/api/coding/paas/v4/chat/completions", mockFetch);
		await expect(llm.generate("System", "User")).rejects.toThrow("Empty response");
	});
});
