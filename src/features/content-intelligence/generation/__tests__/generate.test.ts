import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4C.2 — instrumentation coverage for `runGeneration`. Same
 * mocking convention as `research.test.ts`.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockGetBrief = vi.fn();
const mockUpdateBriefRow = vi.fn();
vi.mock("../../briefs/service", () => ({
	getBrief: (id: string) => mockGetBrief(id),
	updateBriefRow: (id: string, patch: Record<string, unknown>) => mockUpdateBriefRow(id, patch),
}));

const mockComplete = vi.fn();
vi.mock("../AnthropicProvider", () => ({
	createAnthropicProvider: () => ({
		id: "anthropic",
		model: "claude-sonnet-4-6",
		isConfigured: () => true,
		complete: (request: unknown) => mockComplete(request),
	}),
}));

const mockCheckBudget = vi.fn();
vi.mock("../costGuard", () => ({
	checkBudget: () => mockCheckBudget(),
	estimateCostUsd: (inputTokens: number, outputTokens: number) => inputTokens / 1000 + outputTokens / 1000,
}));

const mockRecordAiOperationEvent = vi.fn();
vi.mock("../../events/aiOperationEventWriter", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../events/aiOperationEventWriter")>();
	return { ...actual, recordAiOperationEvent: (input: unknown) => mockRecordAiOperationEvent(input) };
});

const { runGeneration } = await import("../generate");

const BRIEF_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const BRIEF = { id: BRIEF_ID, topic: "Edge caching", keyPoints: null, primaryLocale: "en", researchNotes: "notes", generated: null };

const VALID_MODEL_JSON = JSON.stringify({
	title: "A Sufficiently Long Generated Title",
	excerpt: "An excerpt that is definitely long enough to pass the length validation applied after generation.",
	body: [
		{ type: "heading", level: 2, text: "Intro" },
		{ type: "paragraph", text: "Body text." },
		{ type: "heading", level: 2, text: "Conclusion" },
		{ type: "paragraph", text: "More body text." },
	],
});

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockGetBrief.mockReset().mockResolvedValue(BRIEF);
	mockUpdateBriefRow.mockReset().mockResolvedValue({ ok: true });
	mockComplete.mockReset();
	mockCheckBudget.mockReset().mockResolvedValue({ allowed: true, spentUsd: 0, budgetUsd: 50 });
	mockRecordAiOperationEvent.mockReset().mockResolvedValue({ ok: true, id: "event-1" });
});

describe("3. successful generation", () => {
	it("records exactly one success event once the provider call resolves", async () => {
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 500, outputTokens: 900 });

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(true);
		expect(mockRecordAiOperationEvent).toHaveBeenCalledTimes(1);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			stage: "generation",
			operationType: "generation",
			executionMode: "manual",
			runId: null,
			inputTokens: 500,
			outputTokens: 900,
			cost: 1.4,
			costBasis: "estimated",
			outcome: "success",
			errorKind: null,
		});
	});

	it("still records success even when the model's JSON later fails validation", async () => {
		// The provider call itself succeeded and consumed real tokens --
		// that is what this event describes -- even though the stage as a
		// whole later fails during JSON parsing/validation below.
		mockComplete.mockResolvedValue({ text: "not valid json", inputTokens: 40, outputTokens: 5 });

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		expect(mockRecordAiOperationEvent).toHaveBeenCalledTimes(1);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({ outcome: "success" });
	});
});

describe("4. failed generation", () => {
	it("attempts to record a safe failure event and preserves the original provider error", async () => {
		mockComplete.mockRejectedValue(new Error("anthropic timed out"));

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("anthropic timed out");
		expect(mockRecordAiOperationEvent).toHaveBeenCalledTimes(1);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			outcome: "failure",
			errorKind: "provider_error",
			inputTokens: 0,
			outputTokens: 0,
			cost: null,
			costBasis: null,
		});
	});
});

describe("executionMode and runId propagation", () => {
	it("propagates a supplied executionMode and runId", async () => {
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });

		await runGeneration(BRIEF_ID, "Engineering", { executionMode: "automated", runId: "33333333-3333-4333-8333-333333333333" });

		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			executionMode: "automated",
			runId: "33333333-3333-4333-8333-333333333333",
		});
	});
});

describe("event-writer failure isolation", () => {
	it("a successful generation still succeeds even if recordAiOperationEvent rejects", async () => {
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });
		mockRecordAiOperationEvent.mockRejectedValue(new Error("event writer down"));

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(true);
	});

	it("a failed provider call still surfaces its own message even if the failure event also fails to record", async () => {
		mockComplete.mockRejectedValue(new Error("network down"));
		mockRecordAiOperationEvent.mockRejectedValue(new Error("event writer also down"));

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("network down");
	});
});

describe("max_tokens truncation", () => {
	it("fails with an explicit truncation message when stopReason is max_tokens, without treating it as invalid JSON", async () => {
		mockComplete.mockResolvedValue({ text: '{"title": "Cut off partway thro', inputTokens: 500, outputTokens: 4000, stopReason: "max_tokens" });

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toBe("Model response was truncated because the output token limit was reached.");
			expect(result.message).not.toBe("Model response was not valid JSON.");
		}
	});

	it("still succeeds when the response is valid JSON and stopReason is not max_tokens", async () => {
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 500, outputTokens: 900, stopReason: "end_turn" });

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(true);
	});

	it("still reports the existing invalid-JSON failure when JSON is malformed but stopReason is not max_tokens", async () => {
		mockComplete.mockResolvedValue({ text: "not valid json", inputTokens: 40, outputTokens: 5, stopReason: "end_turn" });

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("Model response was not valid JSON.");
	});

	it("requests the new 6000 output token limit from the provider, matching CONTENT_AI_MAX_OUTPUT_TOKENS's ceiling", async () => {
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });

		await runGeneration(BRIEF_ID, "Engineering");

		expect(mockComplete.mock.calls[0]?.[0]).toMatchObject({ maxTokens: 6000 });
	});

	it("a response truncated at the (now higher) max_tokens limit still fails cleanly rather than being parsed or promoted", async () => {
		mockComplete.mockResolvedValue({
			text: '{"title": "Cut off partway thro',
			inputTokens: 500,
			outputTokens: 6000,
			stopReason: "max_tokens",
		});

		const result = await runGeneration(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("Model response was truncated because the output token limit was reached.");
		expect(mockUpdateBriefRow).not.toHaveBeenCalledWith(BRIEF_ID, expect.objectContaining({ status: "generated" }));
	});
});

describe("locale-aware generation language", () => {
	it("instructs the model to write in natural Polish when the brief's primary locale is pl", async () => {
		mockGetBrief.mockResolvedValue({ ...BRIEF, primaryLocale: "pl" });
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });

		await runGeneration(BRIEF_ID, "Engineering");

		const prompt = mockComplete.mock.calls[0]?.[0]?.prompt as string;
		expect(prompt).toMatch(/Write the entire article in natural, idiomatic Polish\b/);
		expect(prompt).not.toMatch(/natural, idiomatic English/);
	});

	it("instructs the model to write in natural English when the brief's primary locale is en", async () => {
		mockGetBrief.mockResolvedValue({ ...BRIEF, primaryLocale: "en" });
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });

		await runGeneration(BRIEF_ID, "Engineering");

		const prompt = mockComplete.mock.calls[0]?.[0]?.prompt as string;
		expect(prompt).toMatch(/Write the entire article in natural, idiomatic English\b/);
		expect(prompt).not.toMatch(/natural, idiomatic Polish/);
	});

	it("the language instruction is driven by primaryLocale alone, not by the language of researchNotes/keyPoints/category", async () => {
		mockGetBrief.mockResolvedValue({
			...BRIEF,
			primaryLocale: "pl",
			keyPoints: "Please cover the main points in detail.",
			researchNotes: "This research brief is written entirely in English prose.",
		});
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });

		await runGeneration(BRIEF_ID, "English-titled category");

		const prompt = mockComplete.mock.calls[0]?.[0]?.prompt as string;
		expect(prompt).toMatch(/Write the entire article in natural, idiomatic Polish\b/);
	});
});

describe("no generated article content passed to the event writer", () => {
	it("the recorded event never contains the generated title, excerpt, or body", async () => {
		mockComplete.mockResolvedValue({ text: VALID_MODEL_JSON, inputTokens: 10, outputTokens: 10 });

		await runGeneration(BRIEF_ID, "Engineering");

		const event = mockRecordAiOperationEvent.mock.calls[0]?.[0];
		expect(JSON.stringify(event)).not.toContain("A Sufficiently Long Generated Title");
		expect(JSON.stringify(event)).not.toContain("Body text.");
	});
});
