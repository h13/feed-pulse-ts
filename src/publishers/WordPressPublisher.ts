import type { Draft } from "../entities/Draft.js";
import type { PublishResult } from "../entities/PublishResult.js";
import type { PublisherInterface } from "../contracts/PublisherInterface.js";

interface WordPressConfig {
	readonly apiUrl: string;
	readonly user: string;
	readonly appPassword: string;
	readonly status: string;
}

type FetchFn = typeof globalThis.fetch;

export class WordPressPublisher implements PublisherInterface {
	private readonly config: WordPressConfig;
	private readonly fetchFn: FetchFn;

	constructor(config: WordPressConfig, fetchFn?: FetchFn) {
		this.config = config;
		this.fetchFn = fetchFn ?? globalThis.fetch;
	}

	async publish(draft: Draft): Promise<PublishResult> {
		const now = new Date().toISOString();
		try {
			const auth = Buffer.from(`${this.config.user}:${this.config.appPassword}`).toString(
				"base64",
			);

			const response = await this.fetchFn(`${this.config.apiUrl}/posts`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${auth}`,
				},
				body: JSON.stringify({
					title: draft.item.feed.title,
					content: draft.content,
					status: this.config.status,
				}),
			});

			if (!response.ok) {
				return {
					channel: draft.channel,
					title: draft.item.feed.title,
					url: null,
					error: `WordPress API error: ${response.status} ${response.statusText}`,
					publishedAt: now,
				};
			}

			const data = (await response.json()) as { link: string };
			return {
				channel: draft.channel,
				title: draft.item.feed.title,
				url: data.link,
				error: null,
				publishedAt: now,
			};
		} catch (error) {
			return {
				channel: draft.channel,
				title: draft.item.feed.title,
				url: null,
				error: error instanceof Error ? error.message : "Unknown error",
				publishedAt: now,
			};
		}
	}
}
