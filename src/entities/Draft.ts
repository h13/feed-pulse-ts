import { z } from "zod/v4";
import { ScoredItemSchema } from "./ScoredItem.js";

export const DraftSchema = z.object({
	id: z.string().min(1),
	channel: z.string().min(1),
	content: z.string().min(1),
	item: ScoredItemSchema,
	createdAt: z.string(),
});

export type Draft = z.infer<typeof DraftSchema>;
