import { z } from "zod/v4";
import { FeedItemSchema } from "./FeedItem.js";

export const ScoredItemSchema = z.object({
	feed: FeedItemSchema,
	score: z.number().min(0),
	matchedTopics: z.array(z.string()).min(1),
});

export type ScoredItem = z.infer<typeof ScoredItemSchema>;
