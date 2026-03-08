import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
	type ChannelConfig,
	loadAllEnabledChannels,
	loadInterestsConfig,
	loadSourcesConfig,
} from "../config/AppConfig.js";
import type { LlmInterface } from "../contracts/LlmInterface.js";
import type { MatcherInterface } from "../contracts/MatcherInterface.js";
import type { NotifierInterface } from "../contracts/NotifierInterface.js";
import type { PublisherInterface } from "../contracts/PublisherInterface.js";
import type { SourceInterface } from "../contracts/SourceInterface.js";
import { ClaudeLlm } from "../llm/ClaudeLlm.js";
import { GlmLlm } from "../llm/GlmLlm.js";
import { PromptBuilder } from "../llm/PromptBuilder.js";
import { Matcher } from "../matchers/Matcher.js";
import { NullNotifier } from "../notifiers/NullNotifier.js";
import { SlackNotifier } from "../notifiers/SlackNotifier.js";
import { PublisherPool } from "../publishers/PublisherPool.js";
import { WordPressPublisher } from "../publishers/WordPressPublisher.js";
import { XPublisher } from "../publishers/XPublisher.js";
import { RssSource } from "../sources/RssSource.js";
import { DraftStore } from "../stores/DraftStore.js";
import { HistoryStore } from "../stores/HistoryStore.js";
import { StateStore } from "../stores/StateStore.js";

interface ContainerOptions {
	readonly configDir: string;
	readonly stateDir: string;
	readonly promptsDir: string;
	readonly env: Record<string, string | undefined>;
}

export class Container {
	readonly sources: readonly SourceInterface[];
	readonly matcher: MatcherInterface;
	readonly llm: LlmInterface;
	readonly promptBuilder: PromptBuilder;
	readonly stateStore: StateStore;
	readonly draftStore: DraftStore;
	readonly historyStore: HistoryStore;
	readonly publisherPool: PublisherPool;
	readonly notifier: NotifierInterface;
	readonly channels: readonly ChannelConfig[];

	private constructor(deps: {
		sources: readonly SourceInterface[];
		matcher: MatcherInterface;
		llm: LlmInterface;
		promptBuilder: PromptBuilder;
		stateStore: StateStore;
		draftStore: DraftStore;
		historyStore: HistoryStore;
		publisherPool: PublisherPool;
		notifier: NotifierInterface;
		channels: readonly ChannelConfig[];
	}) {
		this.sources = deps.sources;
		this.matcher = deps.matcher;
		this.llm = deps.llm;
		this.promptBuilder = deps.promptBuilder;
		this.stateStore = deps.stateStore;
		this.draftStore = deps.draftStore;
		this.historyStore = deps.historyStore;
		this.publisherPool = deps.publisherPool;
		this.notifier = deps.notifier;
		this.channels = deps.channels;
	}

	static async create(options: ContainerOptions): Promise<Container> {
		const { configDir, stateDir, promptsDir, env } = options;

		const [sourcesConfig, interestsConfig, channels] = await Promise.all([
			loadSourcesConfig(join(configDir, "sources.yaml")),
			loadInterestsConfig(join(configDir, "interests.yaml")),
			loadAllEnabledChannels(join(configDir, "channels")),
		]);

		const sources = sourcesConfig.sources.map((s) => new RssSource(s));
		const matcher = new Matcher(interestsConfig.interests);
		const llm = createLlm(env);
		const promptBuilder = new PromptBuilder(promptsDir);
		const stateStore = new StateStore(join(stateDir, "processed.json"));
		const draftStore = new DraftStore(join(stateDir, "drafts"));
		const historyStore = new HistoryStore(join(stateDir, "history"));
		const publisherPool = createPublisherPool(env, channels);
		const notifier = createNotifier(env);

		return new Container({
			sources,
			matcher,
			llm,
			promptBuilder,
			stateStore,
			draftStore,
			historyStore,
			publisherPool,
			notifier,
			channels,
		});
	}
}

function createLlm(env: Record<string, string | undefined>): LlmInterface {
	if (env.ANTHROPIC_API_KEY) {
		const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
		return new ClaudeLlm(client);
	}
	if (env.GLM_API_KEY) {
		return new GlmLlm(env.GLM_API_KEY, env.GLM_API_URL);
	}
	throw new Error("Either ANTHROPIC_API_KEY or GLM_API_KEY must be set");
}

function createPublisherPool(
	env: Record<string, string | undefined>,
	channels: readonly ChannelConfig[],
): PublisherPool {
	const publishers = new Map<string, PublisherInterface>();

	for (const ch of channels) {
		if (ch.channel.type === "x") {
			const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = env;
			if (X_API_KEY && X_API_SECRET && X_ACCESS_TOKEN && X_ACCESS_SECRET) {
				publishers.set(
					ch.channel.name,
					new XPublisher({
						apiKey: X_API_KEY,
						apiSecret: X_API_SECRET,
						accessToken: X_ACCESS_TOKEN,
						accessSecret: X_ACCESS_SECRET,
					}),
				);
			}
		}
		if (ch.channel.type === "wordpress") {
			const { WORDPRESS_API_URL, WORDPRESS_USER, WORDPRESS_APP_PASSWORD } = env;
			if (WORDPRESS_API_URL && WORDPRESS_USER && WORDPRESS_APP_PASSWORD) {
				publishers.set(
					ch.channel.name,
					new WordPressPublisher({
						apiUrl: WORDPRESS_API_URL,
						user: WORDPRESS_USER,
						appPassword: WORDPRESS_APP_PASSWORD,
						status: ch.channel.publish.status,
					}),
				);
			}
		}
	}

	return new PublisherPool(publishers);
}

function createNotifier(env: Record<string, string | undefined>): NotifierInterface {
	if (env.SLACK_WEBHOOK_URL) {
		return new SlackNotifier(env.SLACK_WEBHOOK_URL);
	}
	return new NullNotifier();
}
