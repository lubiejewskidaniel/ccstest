import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4C.2 — instrumentation coverage for `checkAiVisibility`. Same
 * mocking convention as `research.test.ts`/`generate.test.ts`/`localise.test.ts`.
 */

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/supabase/adminAuth", () => ({
	getAdminSession: () => mockGetAdminSession(),
}));

const mockFrom = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

vi.mock("@/lib/seo/metadata", () => ({
	siteName: "Example Studio",
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

const { checkAiVisibility } = await import("../aiVisibility");

const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockComplete.mockReset();
	mockCheckBudget.mockReset().mockResolvedValue({ allowed: true, spentUsd: 0, budgetUsd: 50 });
	mockLogUsage.mockReset().mockResolvedValue(undefined);
	mockRecordAiOperationEvent.mockReset().mockResolvedValue({ ok: true, id: "event-1" });
	mockFrom.mockReset().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });
	mockCreateSupabaseServerClient.mockReset().mockResolvedValue({ from: mockFrom });
});

describe("7. AI visibility provider calls are instrumented", () => {
	it("records exactly one success event for a genuinely billable provider call", async () => {
		mockComplete.mockResolvedValue({ text: "Example Studio is a great choice.", inputTokens: 50, outputTokens: 80 });

		const result = await checkAiVisibility("who builds software in this space", "en");

		expect(result.ok).toBe(true);
		expect(mockRecordAiOperationEvent).toHaveBeenCalledTimes(1);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			briefId: null,
			stage: "ai_visibility",
			operationType: "ai_visibility",
			executionMode: "manual",
			runId: null,
			inputTokens: 50,
			outputTokens: 80,
			cost: 0.13,
			costBasis: "estimated",
			outcome: "success",
			errorKind: null,
		});
	});

	it("attempts to record a safe failure event and preserves the original provider error", async () => {
		mockComplete.mockRejectedValue(new Error("anthropic unavailable"));

		const result = await checkAiVisibility("who builds software in this space", "en");

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
		mockComplete.mockResolvedValue({ text: "no mention here", inputTokens: 10, outputTokens: 10 });

		await checkAiVisibility("query", null, { executionMode: "automated", runId: "33333333-3333-4333-8333-333333333333" });

		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({
			executionMode: "automated",
			runId: "33333333-3333-4333-8333-333333333333",
		});
	});
});

describe("event-writer failure isolation", () => {
	it("a successful visibility check still succeeds even if recordAiOperationEvent rejects", async () => {
		mockComplete.mockResolvedValue({ text: "no mention here", inputTokens: 10, outputTokens: 10 });
		mockRecordAiOperationEvent.mockRejectedValue(new Error("event writer down"));

		const result = await checkAiVisibility("query", null);

		expect(result.ok).toBe(true);
	});
});
