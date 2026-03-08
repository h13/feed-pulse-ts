import type { Draft } from "../entities/Draft.js";
import type { NotifierInterface } from "../contracts/NotifierInterface.js";
import pino from "pino";

const logger = pino({ name: "SlackNotifier" });

type FetchFn = typeof globalThis.fetch;

export class SlackNotifier implements NotifierInterface {
	private readonly webhookUrl: string;
	private readonly fetchFn: FetchFn;

	constructor(webhookUrl: string, fetchFn?: FetchFn) {
		this.webhookUrl = webhookUrl;
		this.fetchFn = fetchFn ?? globalThis.fetch;
	}

	async notify(drafts: readonly Draft[]): Promise<void> {
		if (drafts.length === 0) {
			return;
		}

		const blocks = [
			{
				type: "header",
				text: { type: "plain_text", text: `Feed Pulse: ${drafts.length} new drafts` },
			},
			...drafts.map((draft) => ({
				type: "section",
				text: {
					type: "mrkdwn",
					text: `*${draft.item.feed.title}*\nChannel: ${draft.channel} | Topics: ${draft.item.matchedTopics.join(", ")}\n>${draft.content.slice(0, 100)}...`,
				},
			})),
		];

		try {
			const response = await this.fetchFn(this.webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ blocks }),
			});

			if (!response.ok) {
				logger.warn({ status: response.status }, "Slack webhook failed");
			}
		} catch (error) {
			logger.error({ error }, "Failed to send Slack notification");
		}
	}
}
