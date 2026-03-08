import type { FeedItem } from "../entities/FeedItem.js";
import type { ScoredItem } from "../entities/ScoredItem.js";

export interface MatcherInterface {
	match(items: readonly FeedItem[]): ScoredItem[];
}
