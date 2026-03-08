import CryptoJS from "crypto-js";
import OAuth from "oauth-1.0a";
import type { PublisherInterface } from "../contracts/PublisherInterface.js";
import type { Draft } from "../entities/Draft.js";
import type { PublishResult } from "../entities/PublishResult.js";

interface XCredentials {
	readonly apiKey: string;
	readonly apiSecret: string;
	readonly accessToken: string;
	readonly accessSecret: string;
}

const TWEET_URL = "https://api.x.com/2/tweets";

type FetchFn = typeof globalThis.fetch;

export class XPublisher implements PublisherInterface {
	private readonly credentials: XCredentials;
	private readonly fetchFn: FetchFn;

	constructor(credentials: XCredentials, fetchFn?: FetchFn) {
		this.credentials = credentials;
		this.fetchFn = fetchFn ?? globalThis.fetch;
	}

	async publish(draft: Draft): Promise<PublishResult> {
		const now = new Date().toISOString();
		try {
			const oauth = new OAuth({
				consumer: { key: this.credentials.apiKey, secret: this.credentials.apiSecret },
				signature_method: "HMAC-SHA1",
				hash_function(baseString, key) {
					return CryptoJS.HmacSHA1(baseString, key).toString(CryptoJS.enc.Base64);
				},
			});

			const requestData = { url: TWEET_URL, method: "POST" };
			const token = {
				key: this.credentials.accessToken,
				secret: this.credentials.accessSecret,
			};
			const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

			const response = await this.fetchFn(TWEET_URL, {
				method: "POST",
				signal: AbortSignal.timeout(30_000),
				headers: {
					...authHeader,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ text: draft.content }),
			});

			if (!response.ok) {
				return {
					channel: "x",
					title: draft.item.feed.title,
					url: null,
					error: `X API error: ${response.status} ${response.statusText}`,
					publishedAt: now,
				};
			}

			const data = (await response.json()) as { data: { id: string } };
			return {
				channel: "x",
				title: draft.item.feed.title,
				url: `https://x.com/i/status/${data.data.id}`,
				error: null,
				publishedAt: now,
			};
		} catch (error) {
			return {
				channel: "x",
				title: draft.item.feed.title,
				url: null,
				error: error instanceof Error ? error.message : "Unknown error",
				publishedAt: now,
			};
		}
	}
}
