import { z } from "zod/v4";

export const PublishResultSchema = z.object({
	channel: z.string().min(1),
	title: z.string().min(1),
	url: z.string().nullable(),
	error: z.string().nullable(),
	publishedAt: z.string(),
});

export type PublishResult = z.infer<typeof PublishResultSchema>;
