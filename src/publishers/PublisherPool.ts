import type { Draft } from "../entities/Draft.js";
import type { PublishResult } from "../entities/PublishResult.js";
import type { PublisherInterface } from "../contracts/PublisherInterface.js";

export class PublisherPool {
	constructor(private readonly publishers: Map<string, PublisherInterface>) {}

	async publish(draft: Draft): Promise<PublishResult> {
		const publisher = this.publishers.get(draft.channel);
		if (!publisher) {
			return {
				channel: draft.channel,
				title: draft.item.feed.title,
				url: null,
				error: `No publisher registered for channel "${draft.channel}"`,
				publishedAt: new Date().toISOString(),
			};
		}
		return publisher.publish(draft);
	}

	async publishAll(drafts: readonly Draft[]): Promise<PublishResult[]> {
		return Promise.all(drafts.map((draft) => this.publish(draft)));
	}
}
