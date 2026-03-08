import type { FeedItem } from "../entities/FeedItem.js";

export interface SourceInterface {
	fetch(): Promise<FeedItem[]>;
}
