import { describe, it, expect } from "vitest";
import { createBriefSchema } from "../schema";

const VALID = {
	opportunityId: "",
	primaryLocale: "en" as const,
	categoryId: "11111111-1111-4111-8111-111111111111",
	topic: "Edge caching strategies",
	keyPoints: "",
};

describe("createBriefSchema keyPoints (Starting notes)", () => {
	it("accepts exactly 4000 characters -- the limit itself is unchanged", () => {
		const result = createBriefSchema.safeParse({ ...VALID, keyPoints: "a".repeat(4000) });
		expect(result.success).toBe(true);
	});

	it("rejects 4001 characters with exactly the human-readable message, not raw Zod wording", () => {
		const result = createBriefSchema.safeParse({ ...VALID, keyPoints: "a".repeat(4001) });
		expect(result.success).toBe(false);
		if (!result.success) {
			const issue = result.error.issues.find((i) => i.path.join(".") === "keyPoints");
			expect(issue?.message).toBe("Starting notes must be 4000 characters or fewer.");
			expect(issue?.message).not.toMatch(/expected string/i);
		}
	});

	it("still treats keyPoints as optional -- an absent value is not an error", () => {
		const withoutKeyPoints = {
			opportunityId: VALID.opportunityId,
			primaryLocale: VALID.primaryLocale,
			categoryId: VALID.categoryId,
			topic: VALID.topic,
		};
		const result = createBriefSchema.safeParse(withoutKeyPoints);
		expect(result.success).toBe(true);
	});

	it("still transforms a blank keyPoints string to null, as before", () => {
		const result = createBriefSchema.safeParse({ ...VALID, keyPoints: "   " });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.keyPoints).toBeNull();
	});
});
