import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

	it("should use SlackNotifier when SLACK_WEBHOOK_URL is set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: { ANTHROPIC_API_KEY: "test-key", SLACK_WEBHOOK_URL: "https://hooks.slack.com/test" },
		});

		expect(container.notifier).toBeDefined();
	});

	it("should register X publisher when X credentials are set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: {
				ANTHROPIC_API_KEY: "test-key",
				X_API_KEY: "key",
				X_API_SECRET: "secret",
				X_ACCESS_TOKEN: "token",
				X_ACCESS_SECRET: "access-secret",
			},
		});

		expect(container.publisherPool).toBeDefined();
	});

	it("should skip X publisher when partial credentials are set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: {
				ANTHROPIC_API_KEY: "test-key",
				X_API_KEY: "key",
			},
		});

		expect(container.publisherPool).toBeDefined();
	});

	it("should skip WordPress publisher when partial credentials are set", async () => {
		await writeFile(
			join(tmpDir, "config/channels/blog.yaml"),
			`channel:
  name: "blog"
  enabled: true
  type: "wordpress"
  persona:
    tone: "formal"
    style: "detailed"
    language: "ja"
    max_length: 5000
  publish:
    max_per_day: 2
    status: "draft"
`,
		);

		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: {
				ANTHROPIC_API_KEY: "test-key",
				WORDPRESS_API_URL: "https://blog.example.com/wp-json/wp/v2",
			},
		});

		expect(container.publisherPool).toBeDefined();
		expect(container.channels).toHaveLength(2);
	});

	it("should pass custom model to ClaudeLlm when CLAUDE_MODEL is set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: { ANTHROPIC_API_KEY: "test-key", CLAUDE_MODEL: "claude-sonnet-4-5-20250514" },
		});

		expect(container.llm).toBeDefined();
	});

	it("should pass custom model to GlmLlm when GLM_MODEL is set", async () => {
		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: { GLM_API_KEY: "test-key", GLM_MODEL: "glm-4-plus" },
		});

		expect(container.llm).toBeDefined();
	});

	it("should register WordPress publisher when WP credentials are set", async () => {
		await writeFile(
			join(tmpDir, "config/channels/blog.yaml"),
			`channel:
  name: "blog"
  enabled: true
  type: "wordpress"
  persona:
    tone: "formal"
    style: "detailed"
    language: "ja"
    max_length: 5000
  publish:
    max_per_day: 2
    status: "draft"
`,
		);

		const container = await Container.create({
			configDir: join(tmpDir, "config"),
			stateDir: join(tmpDir, "state"),
			promptsDir: join(tmpDir, "prompts"),
			env: {
				ANTHROPIC_API_KEY: "test-key",
				WORDPRESS_API_URL: "https://blog.example.com/wp-json/wp/v2",
				WORDPRESS_USER: "admin",
				WORDPRESS_APP_PASSWORD: "xxxx",
			},
		});

		expect(container.publisherPool).toBeDefined();
		expect(container.channels).toHaveLength(2);
	});
});
