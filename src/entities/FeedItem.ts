import { z } from "zod/v4";

export const FeedItemSchema = z.object({
	title: z.string().min(1),
	link: z.url(),
	description: z.string(),
	pubDate: z.string(),
	source: z.string().min(1),
	category: z.string().min(1),
});

export type FeedItem = z.infer<typeof FeedItemSchema>;
