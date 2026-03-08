import type { NotifierInterface } from "../contracts/NotifierInterface.js";
import type { Draft } from "../entities/Draft.js";

export class NullNotifier implements NotifierInterface {
	async notify(_drafts: readonly Draft[]): Promise<void> {
		// No-op notifier for when Slack is not configured
	}
}
