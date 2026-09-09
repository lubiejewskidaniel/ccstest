import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4C.2 — instrumentation coverage for `runLocalisation`. Same
 * mocking convention as `research.test.ts`/`generate.test.ts`.
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
vi.mock("../../generation/AnthropicProvider", () => ({
	createAnthropicProvider: () => ({
		id: "anthropic",
		model: "claude-sonnet-4-6",
		isConfigured: () => true,
		complete: (request: unknown) => mockComplete(request),
	}),
}));

const mockCheckBudget = vi.fn();
const mockLogUsage = vi.fn();
vi.mock("../../generation/costGuard", () => ({
	checkBudget: () => mockCheckBudget(),
	logUsage: (params: unknown) => mockLogUsage(params),
	estimateCostUsd: (inputTokens: number, outputTokens: number) => inputTokens / 1000 + outputTokens / 1000,
}));

const mockRecordAiOperationEvent = vi.fn();
vi.mock("../../events/aiOperationEventWriter", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../events/aiOperationEventWriter")>();
	return { ...actual, recordAiOperationEvent: (input: unknown) => mockRecordAiOperationEvent(input) };
});

const { runLocalisation } = await import("../localise");

const BRIEF_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const BRIEF = {
	id: BRIEF_ID,
	primaryLocale: "en",
	generated: { title: "English Title", excerpt: "English excerpt long enough to pass validation checks here.", body: [{ type: "paragraph", text: "Hello." }] },
};

const VALID_TRANSLATION_JSON = JSON.stringify({
	title: "Tytul po polsku wystarczajaco dlugi",
	excerpt: "Polski opis ktory jest wystarczajaco dlugi aby przejsc walidacje dlugosci.",
	body: [{ type: "paragraph", text: "Czesc." }],
});

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockGetBrief.mockReset().mockResolvedValue(BRIEF);
	mockUpdateBriefRow.mockReset().mockResolvedValue({ ok: true });
	mockComplete.mockReset();
	mockCheckBudget.mockReset().mockResolvedValue({ allowed: true, spentUsd: 0, budgetUsd: 50 });
	mockLogUsage.mockReset().mockResolvedValue(undefined);
	mockRecordAiOperationEvent.mockReset().mockResolvedValue({ ok: true, id: "event-1" });
});

describe("5. successful localisation", () => {
	it("records exactly one success event once the provider call resolves", async () => {
		mockComplete.mockResolvedValue({ text: VALID_TRANSLATION_JSON, inputTokens: 300, outputTokens: 400, stopReason: "end_turn" });

		const result = await runLocalisation(BRIEF_ID);

		expect(result.ok).toBe(true);
		expect(mockRecordAiOperationEvent).toHaveBeenCalledTimes(1);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			stage: "localisation",
			operationType: "localisation",
			executionMode: "manual",
			runId: null,
			inputTokens: 300,
			outputTokens: 400,
			cost: 0.7,
			costBasis: "estimated",
			outcome: "success",
			errorKind: null,
		});
	});

	it("still records success when the response is truncated (max_tokens), since real tokens were spent", async () => {
		mockComplete.mockResolvedValue({ text: VALID_TRANSLATION_JSON, inputTokens: 100, outputTokens: 6000, stopReason: "max_tokens" });

		const result = await runLocalisation(BRIEF_ID);

		expect(result.ok).toBe(false);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({ outcome: "success" });
	});
});

describe("6. failed localisation", () => {
	it("attempts to record a safe failure event and preserves the original provider error", async () => {
		mockComplete.mockRejectedValue(new Error("anthropic unavailable"));

		const result = await runLocalisation(BRIEF_ID);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("anthropic unavailable");
		expect(mockLogUsage).not.toHaveBeenCalled();
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
		mockComplete.mockResolvedValue({ text: VALID_TRANSLATION_JSON, inputTokens: 10, outputTokens: 10, stopReason: "end_turn" });

		await runLocalisation(BRIEF_ID, { executionMode: "automated", runId: "33333333-3333-4333-8333-333333333333" });

		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			executionMode: "automated",
			runId: "33333333-3333-4333-8333-333333333333",
		});
	});
});

describe("event-writer failure isolation", () => {
	it("a successful localisation still succeeds even if recordAiOperationEvent rejects", async () => {
		mockComplete.mockResolvedValue({ text: VALID_TRANSLATION_JSON, inputTokens: 10, outputTokens: 10, stopReason: "end_turn" });
		mockRecordAiOperationEvent.mockRejectedValue(new Error("event writer down"));

		const result = await runLocalisation(BRIEF_ID);

		expect(result.ok).toBe(true);
	});
});
