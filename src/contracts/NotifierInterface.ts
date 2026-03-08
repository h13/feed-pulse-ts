import type { Draft } from "../entities/Draft.js";

export interface NotifierInterface {
	notify(drafts: readonly Draft[]): Promise<void>;
}
