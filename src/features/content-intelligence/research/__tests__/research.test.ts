import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4C.2 — instrumentation coverage for `runResearch`. Same
 * mocking convention as the Phase 3C.4C.1 event-layer tests: every
 * collaborator is mocked at the module boundary, and structural source
 * assertions read files via `process.cwd()` + `resolve` (never
 * `import.meta.url`/`fileURLToPath`, which fails under Windows Vitest).
 */

function readProjectFile(relativePath: string): string {
	return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

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

const { runResearch } = await import("../research");
const { createAiOperationRunId } = await import("../../events/aiOperationEventWriter");

const BRIEF_ID = "11111111-1111-4111-8111-111111111111";
const EDITOR_SESSION = { userId: "u1", email: "editor@example.com", roles: ["editor"], isAdmin: false, isEditor: true };
const BRIEF = { id: BRIEF_ID, topic: "Edge caching", keyPoints: null, primaryLocale: "en", researchNotes: null, generated: null };

beforeEach(() => {
	mockGetAdminSession.mockReset().mockResolvedValue(EDITOR_SESSION);
	mockGetBrief.mockReset().mockResolvedValue(BRIEF);
	mockUpdateBriefRow.mockReset().mockResolvedValue({ ok: true });
	mockComplete.mockReset();
	mockCheckBudget.mockReset().mockResolvedValue({ allowed: true, spentUsd: 0, budgetUsd: 50 });
	mockLogUsage.mockReset().mockResolvedValue(undefined);
	mockRecordAiOperationEvent.mockReset().mockResolvedValue({ ok: true, id: "event-1" });
});

describe("1. successful research", () => {
	it("records exactly one success event with the real provider-reported tokens and cost", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 120, outputTokens: 300 });

		const result = await runResearch(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(true);
		expect(mockRecordAiOperationEvent).toHaveBeenCalledTimes(1);
		const event = mockRecordAiOperationEvent.mock.calls[0]?.[0];
		expect(event).toMatchObject({
			briefId: BRIEF_ID,
			stage: "research",
			operationType: "research",
			provider: "anthropic",
			model: "claude-sonnet-4-6",
			executionMode: "manual",
			runId: null,
			inputTokens: 120,
			outputTokens: 300,
			cost: 0.42,
			costBasis: "estimated",
			outcome: "success",
			errorKind: null,
		});
		expect(typeof event.durationMs).toBe("number");
		expect(event.durationMs).toBeGreaterThanOrEqual(0);
	});
});

describe("2. failed research", () => {
	it("attempts to record a safe failure event and still returns the original provider error", async () => {
		mockComplete.mockRejectedValue(new Error("anthropic request failed"));

		const result = await runResearch(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.kind).toBe("provider_error");
			expect(result.message).toBe("anthropic request failed");
		}
		expect(mockLogUsage).not.toHaveBeenCalled();
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

describe("9. execution mode", () => {
	it("records 'manual' by default when no options are supplied", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 10, outputTokens: 10 });

		await runResearch(BRIEF_ID, "Engineering");

		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({ executionMode: "manual" });
	});
});

describe("12. executionMode propagation", () => {
	it("records 'automated' when a caller explicitly supplies it, without implementing any automation", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 10, outputTokens: 10 });

		await runResearch(BRIEF_ID, "Engineering", { executionMode: "automated" });

		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({ executionMode: "automated" });
	});
});

describe("10. runId propagation", () => {
	it("preserves a caller-supplied runId", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 10, outputTokens: 10 });
		const runId = "22222222-2222-4222-8222-222222222222";

		await runResearch(BRIEF_ID, "Engineering", { runId });

		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({ runId });
	});
});

describe("11. isolated operation obtaining a runId", () => {
	it("an isolated caller can create a runId with createAiOperationRunId and pass it through, with no parent run required", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 10, outputTokens: 10 });
		const runId = createAiOperationRunId();

		const result = await runResearch(BRIEF_ID, "Engineering", { runId });

		expect(result.ok).toBe(true);
		expect(mockRecordAiOperationEvent.mock.calls[0]?.[0]).toMatchObject({ runId });
	});
});

describe("13. event-writer failure does not fail the operation", () => {
	it("a successful research call still succeeds even if recordAiOperationEvent rejects", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 10, outputTokens: 10 });
		mockRecordAiOperationEvent.mockRejectedValue(new Error("event writer down"));

		const result = await runResearch(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(true);
		expect(mockUpdateBriefRow).toHaveBeenCalledWith(BRIEF_ID, expect.objectContaining({ status: "researched" }));
	});
});

describe("14. event-writer failure does not replace the original provider error", () => {
	it("a failed provider call still surfaces its own message even if the failure event also fails to record", async () => {
		mockComplete.mockRejectedValue(new Error("network down"));
		mockRecordAiOperationEvent.mockRejectedValue(new Error("event writer also down"));

		const result = await runResearch(BRIEF_ID, "Engineering");

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.message).toBe("network down");
	});
});

describe("15. no sensitive content passed to the event writer", () => {
	it("the recorded event carries only the documented metadata fields", async () => {
		mockComplete.mockResolvedValue({ text: "some research notes that must never be logged", inputTokens: 10, outputTokens: 10 });

		await runResearch(BRIEF_ID, "Engineering");

		const event = mockRecordAiOperationEvent.mock.calls[0]?.[0];
		expect(Object.keys(event).sort()).toEqual(
			["briefId", "costBasis", "cost", "durationMs", "errorKind", "executionMode", "inputTokens", "model", "operationType", "outcome", "outputTokens", "provider", "runId", "stage"].sort(),
		);
		expect(JSON.stringify(event)).not.toContain("research notes");
	});
});

describe("17. existing costGuard/logUsage behaviour is preserved", () => {
	it("logUsage is still called with the same shape as before this phase", async () => {
		mockComplete.mockResolvedValue({ text: "notes", inputTokens: 55, outputTokens: 66 });

		await runResearch(BRIEF_ID, "Engineering");

		expect(mockLogUsage).toHaveBeenCalledWith({
			briefId: BRIEF_ID,
			stage: "research",
			provider: "anthropic",
			model: "claude-sonnet-4-6",
			inputTokens: 55,
			outputTokens: 66,
		});
	});

	it("costGuard.ts itself was not modified by this phase", () => {
		const source = readProjectFile("src/features/content-intelligence/generation/costGuard.ts");
		expect(source).not.toMatch(/aiOperationEventWriter/);
		expect(source).toMatch(/export function estimateCostUsd/);
		expect(source).toMatch(/export async function checkBudget/);
		expect(source).toMatch(/export async function logUsage/);
	});
});

describe("16/19/20. no pricing, automation, or privileged client introduced", () => {
	const instrumentedFiles = [
		"src/features/content-intelligence/research/research.ts",
		"src/features/content-intelligence/generation/generate.ts",
		"src/features/content-intelligence/localisation/localise.ts",
		"src/features/content-intelligence/monitoring/aiVisibility.ts",
	];

	it("no new provider pricing constants are introduced", () => {
		for (const file of instrumentedFiles) {
			const code = stripComments(readProjectFile(file));
			expect(code).not.toMatch(/COST_PER_1K/);
			expect(code).not.toMatch(/0\.003|0\.015/);
		}
	});

	it("no scheduler/cron/background automation is introduced", () => {
		for (const file of instrumentedFiles) {
			const code = stripComments(readProjectFile(file));
			expect(code).not.toMatch(/from\s*["'][^"']*(cron|scheduler)[^"']*["']/i);
			expect(code).not.toMatch(/setInterval\s*\(/);
			expect(code).not.toMatch(/\bcron\s*\(/i);
			expect(code).not.toMatch(/cron/i);
			expect(code).not.toMatch(/scheduler/i);
		}
	});

	it("no privileged/service-role Supabase client is introduced", () => {
		for (const file of instrumentedFiles) {
			const code = stripComments(readProjectFile(file));
			expect(code).not.toMatch(/createSupabasePrivilegedClient/);
			expect(code).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
		}
	});
});

describe("18. no visual-generation file is modified", () => {
	it("visual generation files do not reference the text-pipeline event options or writer", () => {
		const visualFiles = [
			"src/features/content-intelligence/visuals/OpenAiArticleVisualProvider.ts",
			"src/features/content-intelligence/visuals/articleVisualGenerationService.ts",
		];
		for (const file of visualFiles) {
			const source = readProjectFile(file);
			expect(source).not.toMatch(/TextAiOperationOptions/);
			expect(source).not.toMatch(/recordAiOperationEvent/);
		}
	});
});
