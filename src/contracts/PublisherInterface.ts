import type { Draft } from "../entities/Draft.js";
import type { PublishResult } from "../entities/PublishResult.js";

export interface PublisherInterface {
	publish(draft: Draft): Promise<PublishResult>;
}
