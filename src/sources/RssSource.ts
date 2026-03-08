import RssParser from "rss-parser";
import type { FeedItem } from "../entities/FeedItem.js";
import type { SourceInterface } from "../contracts/SourceInterface.js";

interface SourceEntry {
	readonly name: string;
	readonly url: string;
	readonly category: string;
}

export class RssSource implements SourceInterface {
	private readonly parser: RssParser;
	private readonly entry: SourceEntry;

	constructor(entry: SourceEntry, parser?: RssParser) {
		this.entry = entry;
		this.parser = parser ?? new RssParser();
	}

	async fetch(): Promise<FeedItem[]> {
		try {
			const feed = await this.parser.parseURL(this.entry.url);
			return feed.items
				.filter((item) => item.link)
				.map((item) => ({
					title: item.title ?? "",
					link: item.link!,
					description: item.contentSnippet ?? "",
					pubDate: item.isoDate ?? new Date().toISOString(),
					source: this.entry.name,
					category: this.entry.category,
				}));
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new Error(`Failed to fetch feed "${this.entry.name}": ${message}`);
		}
	}
}
