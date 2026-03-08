import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { Container } from "./Container.js";

const tmpDir = join(import.meta.dirname, "../../tmp-test-di");

beforeEach(async () => {
	await mkdir(join(tmpDir, "config/channels"), { recursive: true });
	await mkdir(join(tmpDir, "state/drafts"), { recursive: true });
	await mkdir(join(tmpDir, "state/history"), { recursive: true });
	await mkdir(join(tmpDir, "prompts"), { recursive: true });

	await writeFile(
		join(tmpDir, "config/sources.yaml"),
		`sources:
  - name: "Test"
    url: "https://example.com/feed"
    category: "tech"
`,
	);
	await writeFile(
		join(tmpDir, "config/interests.yaml"),
		`interests:
  - topic: "AI"
    keywords: ["ai"]
    weight: 1.0
`,
	);
	await writeFile(
		join(tmpDir, "config/channels/x.yaml"),
		`channel:
  name: "x"
  enabled: true
  type: "x"
  persona:
    tone: "casual"
    style: "concise"
    language: "ja"
    max_length: 280
  publish:
    max_per_day: 5
    status: "draft"
`,
	);
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("Container", () => {
	it("should create container with required components", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: { ANTHROPIC_API_KEY: "test-key" },
		});

		expect(container.sources).toHaveLength(1);
		expect(container.matcher).toBeDefined();
		expect(container.llm).toBeDefined();
		expect(container.promptBuilder).toBeDefined();
		expect(container.stateStore).toBeDefined();
		expect(container.draftStore).toBeDefined();
		expect(container.historyStore).toBeDefined();
		expect(container.publisherPool).toBeDefined();
		expect(container.notifier).toBeDefined();
		expect(container.channels).toHaveLength(1);
	});

	it("should use GLM when only GLM_API_KEY is set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: { GLM_API_KEY: "test-glm-key" },
		});

		expect(container.llm).toBeDefined();
	});

	it("should throw when no LLM API key is set", async () => {
		await expect(
			Container.create({
				configDir: join(tmpDir, "config"),
				stateDir: join(tmpDir, "state"),
				promptsDir: join(tmpDir, "prompts"),
				env: {},
			}),
		).rejects.toThrow("Either ANTHROPIC_API_KEY or GLM_API_KEY must be set");
	});

	it("should use NullNotifier when SLACK_WEBHOOK_URL is not set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: { ANTHROPIC_API_KEY: "test-key" },
		});

		expect(container.notifier).toBeDefined();
	});
});
