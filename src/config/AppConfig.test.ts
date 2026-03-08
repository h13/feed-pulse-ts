import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import {
	loadSourcesConfig,
	loadInterestsConfig,
	loadChannelConfig,
	loadAllEnabledChannels,
	type SourceConfig,
	type InterestsConfig,
	type ChannelConfig,
} from "./AppConfig.js";

const tmpDir = join(import.meta.dirname, "../../tmp-test-config");

beforeEach(async () => {
	await mkdir(join(tmpDir, "channels"), { recursive: true });
});

afterEach(async () => {
	await rm(tmpDir, { recursive: true, force: true });
});

describe("loadSourcesConfig", () => {
	it("should load valid sources config", async () => {
		const yaml = `sources:
  - name: "Hacker News"
    url: "https://hnrss.org/best"
    category: "tech"
`;
		await writeFile(join(tmpDir, "sources.yaml"), yaml);
		const config = await loadSourcesConfig(join(tmpDir, "sources.yaml"));
		expect(config.sources).toHaveLength(1);
		expect(config.sources[0]?.name).toBe("Hacker News");
	});

	it("should reject sources with empty name", async () => {
		const yaml = `sources:
  - name: ""
    url: "https://example.com"
    category: "tech"
`;
		await writeFile(join(tmpDir, "sources.yaml"), yaml);
		await expect(loadSourcesConfig(join(tmpDir, "sources.yaml"))).rejects.toThrow();
	});
});

describe("loadInterestsConfig", () => {
	it("should load valid interests config", async () => {
		const yaml = `interests:
  - topic: "AI & LLM"
    keywords:
      - "artificial intelligence"
      - "Claude"
    weight: 1.0
`;
		await writeFile(join(tmpDir, "interests.yaml"), yaml);
		const config = await loadInterestsConfig(join(tmpDir, "interests.yaml"));
		expect(config.interests).toHaveLength(1);
		expect(config.interests[0]?.keywords).toHaveLength(2);
	});

	it("should reject interests with zero weight", async () => {
		const yaml = `interests:
  - topic: "Test"
    keywords: ["test"]
    weight: 0
`;
		await writeFile(join(tmpDir, "interests.yaml"), yaml);
		await expect(loadInterestsConfig(join(tmpDir, "interests.yaml"))).rejects.toThrow();
	});
});

describe("loadChannelConfig", () => {
	it("should load valid channel config", async () => {
		const yaml = `channel:
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
`;
		await writeFile(join(tmpDir, "channels/x.yaml"), yaml);
		const config = await loadChannelConfig(join(tmpDir, "channels/x.yaml"));
		expect(config.channel.name).toBe("x");
		expect(config.channel.type).toBe("x");
	});
});

describe("loadAllEnabledChannels", () => {
	it("should load only enabled channels", async () => {
		const enabledYaml = `channel:
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
`;
		const disabledYaml = `channel:
  name: "blog"
  enabled: false
  type: "wordpress"
  persona:
    tone: "formal"
    style: "detailed"
    language: "ja"
    max_length: 5000
  publish:
    max_per_day: 2
    status: "draft"
`;
		await writeFile(join(tmpDir, "channels/x.yaml"), enabledYaml);
		await writeFile(join(tmpDir, "channels/blog.yaml"), disabledYaml);

		const channels = await loadAllEnabledChannels(join(tmpDir, "channels"));
		expect(channels).toHaveLength(1);
		expect(channels[0]?.channel.name).toBe("x");
	});
});
