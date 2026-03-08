import { describe, expect, it } from "vitest";
import { NullNotifier } from "./NullNotifier.js";

describe("NullNotifier", () => {
	it("should do nothing", async () => {
		const notifier = new NullNotifier();
		await expect(notifier.notify([])).resolves.toBeUndefined();
	});
});
