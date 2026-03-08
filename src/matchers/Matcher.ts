import type { MatcherInterface } from "../contracts/MatcherInterface.js";
import type { FeedItem } from "../entities/FeedItem.js";
import type { ScoredItem } from "../entities/ScoredItem.js";

interface InterestEntry {
	readonly topic: string;
	readonly keywords: readonly string[];
	readonly weight: number;
}

export class Matcher implements MatcherInterface {
	constructor(
		private readonly interests: readonly InterestEntry[],
		private readonly threshold: number = 0.5,
	) {}

	match(items: readonly FeedItem[]): ScoredItem[] {
		const scored: ScoredItem[] = [];

		for (const feed of items) {
			const text = `${feed.title} ${feed.description}`.toLowerCase();
			let score = 0;
			const matchedTopics: string[] = [];

			for (const interest of this.interests) {
				const hasMatch = interest.keywords.some((kw) => text.includes(kw.toLowerCase()));
				if (hasMatch) {
					score += interest.weight;
					matchedTopics.push(interest.topic);
				}
			}

			if (score >= this.threshold && matchedTopics.length > 0) {
				scored.push({ feed, score, matchedTopics });
			}
		}

		return scored.sort((a, b) => b.score - a.score);
	}
}
