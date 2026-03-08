import { describe, expect, it, vi } from "vitest";
import { ClaudeLlm } from "./ClaudeLlm.js";

describe("ClaudeLlm", () => {
	it("should generate content via Anthropic API", async () => {
		const mockClient = {
			messages: {
				create: vi.fn().mockResolvedValue({
					content: [{ type: "text", text: "Generated AI content" }],
				}),
			},
		};

		const llm = new ClaudeLlm(mockClient as never);
		const result = await llm.generate("System prompt", "User prompt");
		expect(result).toBe("Generated AI content");
		expect(mockClient.messages.create).toHaveBeenCalledWith({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 1024,
			system: "System prompt",
			messages: [{ role: "user", content: "User prompt" }],
		});
	});

	it("should throw on empty response", async () => {
		const mockClient = {
			messages: {
				create: vi.fn().mockResolvedValue({ content: [] }),
			},
		};

		const llm = new ClaudeLlm(mockClient as never);
		await expect(llm.generate("System", "User")).rejects.toThrow("Empty response");
	});

	it("should use custom model when specified", async () => {
		const mockClient = {
			messages: {
				create: vi.fn().mockResolvedValue({
					content: [{ type: "text", text: "response" }],
				}),
			},
		};

		const llm = new ClaudeLlm(mockClient as never, "claude-sonnet-4-5-20250514");
		await llm.generate("System", "User");
		expect(mockClient.messages.create).toHaveBeenCalledWith(
			expect.objectContaining({ model: "claude-sonnet-4-5-20250514" }),
		);
	});

	it("should use default model when not specified", async () => {
		const mockClient = {
			messages: {
				create: vi.fn().mockResolvedValue({
					content: [{ type: "text", text: "response" }],
				}),
			},
		};

		const llm = new ClaudeLlm(mockClient as never);
		await llm.generate("System", "User");
		expect(mockClient.messages.create).toHaveBeenCalledWith(
			expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
		);
	});
});
