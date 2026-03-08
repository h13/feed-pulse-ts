import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod/v4";

const SourceEntrySchema = z.object({
	name: z.string().min(1),
	url: z.url(),
	category: z.string().min(1),
});

const SourcesConfigSchema = z.object({
	sources: z.array(SourceEntrySchema).min(1),
});

export type SourceConfig = z.infer<typeof SourcesConfigSchema>;

const InterestEntrySchema = z.object({
	topic: z.string().min(1),
	keywords: z.array(z.string().min(1)).min(1),
	weight: z.number().positive(),
});

const InterestsConfigSchema = z.object({
	interests: z.array(InterestEntrySchema).min(1),
});

export type InterestsConfig = z.infer<typeof InterestsConfigSchema>;

const PersonaSchema = z.object({
	tone: z.string().min(1),
	style: z.string().min(1),
	language: z.string().min(1),
	max_length: z.number().int().positive(),
});

const PublishSettingsSchema = z.object({
	max_per_day: z.number().int().positive(),
	status: z.string().min(1),
});

const ChannelEntrySchema = z.object({
	name: z.string().min(1),
	enabled: z.boolean(),
	type: z.enum(["x", "wordpress"]),
	persona: PersonaSchema,
	publish: PublishSettingsSchema,
});

const ChannelConfigSchema = z.object({
	channel: ChannelEntrySchema,
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

async function loadYaml(filePath: string): Promise<unknown> {
	const content = await readFile(filePath, "utf-8");
	return parseYaml(content);
}

export async function loadSourcesConfig(filePath: string): Promise<SourceConfig> {
	const raw = await loadYaml(filePath);
	return SourcesConfigSchema.parse(raw);
}

export async function loadInterestsConfig(filePath: string): Promise<InterestsConfig> {
	const raw = await loadYaml(filePath);
	return InterestsConfigSchema.parse(raw);
}

export async function loadChannelConfig(filePath: string): Promise<ChannelConfig> {
	const raw = await loadYaml(filePath);
	return ChannelConfigSchema.parse(raw);
}

export async function loadAllEnabledChannels(channelsDir: string): Promise<ChannelConfig[]> {
	const files = await readdir(channelsDir);
	const yamlFiles = files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

	const configs = await Promise.all(yamlFiles.map((f) => loadChannelConfig(join(channelsDir, f))));

	return configs.filter((c) => c.channel.enabled);
}
