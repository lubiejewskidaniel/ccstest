import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiOperationEventInput } from "../../types/aiOperationEvent";

/**
 * Phase 3C.4C.1 — coverage for the new AI operation event writer. Same
 * mocking shape as `articleVisualStorageService.test.ts` (`@/lib/supabase/server`
 * mocked, a hand-built fake Supabase client covering only the
 * `.from("ai_usage_log").insert(...).select(...).single()` surface this
 * writer actually touches).
 */

/**
 * Reads a file relative to the project root. `import.meta.url`-based
 * resolution (`fileURLToPath(new URL(..., import.meta.url))`) breaks
 * under the real Windows Vitest/Vite environment (`TypeError: The URL
 * must be of scheme file`) -- `process.cwd()` is deterministic here
 * because the test suite is always run from the ccs-app project root.
 */
function readProjectFile(relativePath: string): string {
	return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

/**
 * Strips `/* ... *\/` block comments and `// ...` line comments from a
 * TypeScript source string, so a structural assertion checks only
 * executable/import code -- not documentation prose that may legitimately
 * mention a forbidden identifier precisely to explain why the module
 * doesn't use it (e.g. "-- never `createSupabasePrivilegedClient`").
 * Deliberately simple (no string-literal awareness): safe here because
 * none of this module's actual string literals contain "//" or "/*"
 * sequences that a comment-aware parser would need to distinguish.
 */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { recordAiOperationEvent, createAiOperationRunId } = await import("../aiOperationEventWriter");

const BRIEF_ID = "11111111-1111-4111-8111-111111111111";

type FakeSupabaseOptions = { insertError?: { message: string } | null; insertedId?: string };

/** A minimal fake of the exact Supabase surface `aiOperationEventWriter.ts`
 * touches: `.from("ai_usage_log").insert(row).select("id").single()`. */
function fakeSupabase(opts: FakeSupabaseOptions = {}) {
	const { insertError = null, insertedId = "22222222-2222-4222-8222-222222222222" } = opts;

	let lastInsertPayload: Record<string, unknown> | null = null;
	const single = vi.fn(async () => {
		if (insertError) return { data: null, error: insertError };
		return { data: { id: insertedId }, error: null };
	});
	const select = vi.fn(() => ({ single }));
	const insert = vi.fn((row: Record<string, unknown>) => {
		lastInsertPayload = row;
		return { select };
	});

	const from = vi.fn((table: string) => {
		if (table === "ai_usage_log") return { insert };
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	return { from, spies: { insert, select, single }, getLastInsertPayload: () => lastInsertPayload };
}

/** A complete, valid text-style (Anthropic, token-priced) event —
 * individual tests override only the fields they're exercising. */
function textEvent(overrides: Partial<AiOperationEventInput> = {}): AiOperationEventInput {
	return {
		briefId: BRIEF_ID,
		stage: "research",
		operationType: "research",
		provider: "anthropic",
		model: "claude-sonnet-4-6",
		executionMode: "manual",
		runId: null,
		inputTokens: 500,
		outputTokens: 300,
		cost: 0.0075,
		costBasis: "estimated",
		durationMs: 1200,
		outcome: "success",
		errorKind: null,
		...overrides,
	};
}

/** A complete, valid image-style event — zero tokens, cost genuinely
 * unknown rather than zero. */
function imageEvent(overrides: Partial<AiOperationEventInput> = {}): AiOperationEventInput {
	return {
		briefId: null,
		stage: null,
		operationType: "article_visual_generation",
		provider: "openai",
		model: "gpt-image-2",
		executionMode: "manual",
		runId: null,
		inputTokens: 0,
		outputTokens: 0,
		cost: null,
		costBasis: null,
		durationMs: 4200,
		outcome: "success",
		errorKind: null,
		...overrides,
	};
}

beforeEach(() => {
	mockCreateSupabaseServerClient.mockReset();
});

describe("valid events", () => {
	it("1. records a valid text-style event", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent());

		expect(result.ok).toBe(true);
		const payload = supabase.getLastInsertPayload();
		expect(payload?.stage).toBe("research");
		expect(payload?.input_tokens).toBe(500);
		expect(payload?.output_tokens).toBe(300);
		expect(payload?.estimated_cost_usd).toBe(0.0075);
		expect(payload?.cost_basis).toBe("estimated");
	});

	it("2. records a valid image-style event with zero tokens", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(imageEvent());

		expect(result.ok).toBe(true);
		const payload = supabase.getLastInsertPayload();
		expect(payload?.stage).toBeNull();
		expect(payload?.operation_type).toBe("article_visual_generation");
		expect(payload?.input_tokens).toBe(0);
		expect(payload?.output_tokens).toBe(0);
	});
});

describe("cost semantics: unknown vs. real zero", () => {
	it("3a. an unknown cost (null) is stored as 0 with cost_basis 'unknown'", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(imageEvent({ cost: null, costBasis: null }));

		expect(result.ok).toBe(true);
		const payload = supabase.getLastInsertPayload();
		expect(payload?.estimated_cost_usd).toBe(0);
		expect(payload?.cost_basis).toBe("unknown");
	});

	it("3b. a genuine zero cost is stored as 0 with a non-'unknown' cost_basis, distinguishably", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ cost: 0, costBasis: "deterministic" }));

		expect(result.ok).toBe(true);
		const payload = supabase.getLastInsertPayload();
		expect(payload?.estimated_cost_usd).toBe(0);
		expect(payload?.cost_basis).toBe("deterministic");
		expect(payload?.cost_basis).not.toBe("unknown");
	});

	it("3c. rejects a null cost paired with a 'known' cost_basis as self-contradictory", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(imageEvent({ cost: null, costBasis: "reported" }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.insert).not.toHaveBeenCalled();
	});

	it("3d. rejects a non-null cost paired with costBasis 'unknown' as self-contradictory", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ cost: 0.01, costBasis: "unknown" }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
	});
});

describe("execution mode", () => {
	it("4. accepts 'manual' execution mode", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ executionMode: "manual" }));

		expect(result.ok).toBe(true);
		expect(supabase.getLastInsertPayload()?.execution_mode).toBe("manual");
	});

	it("5. accepts 'automated' execution mode", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ executionMode: "automated" }));

		expect(result.ok).toBe(true);
		expect(supabase.getLastInsertPayload()?.execution_mode).toBe("automated");
	});

	it("11. rejects an invalid execution mode", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ executionMode: "sometimes" as unknown as AiOperationEventInput["executionMode"] }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.insert).not.toHaveBeenCalled();
	});
});

describe("run_id correlation", () => {
	it("6. accepts a null run_id for an isolated event", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ runId: null }));

		expect(result.ok).toBe(true);
		expect(supabase.getLastInsertPayload()?.run_id).toBeNull();
	});

	it("7. accepts the same run_id across multiple events", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const runId = createAiOperationRunId();

		const first = await recordAiOperationEvent(textEvent({ operationType: "research", runId }));
		const second = await recordAiOperationEvent(textEvent({ operationType: "generation", stage: "generation", runId }));

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		expect(supabase.spies.insert).toHaveBeenCalledTimes(2);
	});

	it("createAiOperationRunId returns a distinct UUID each call", () => {
		const a = createAiOperationRunId();
		const b = createAiOperationRunId();
		expect(a).not.toBe(b);
		expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
	});
});

describe("outcome and error_kind", () => {
	it("8. records a success event with no error_kind", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ outcome: "success", errorKind: null }));

		expect(result.ok).toBe(true);
		expect(supabase.getLastInsertPayload()?.outcome).toBe("success");
		expect(supabase.getLastInsertPayload()?.error_kind).toBeNull();
	});

	it("9. records a failure event with a safe, closed error_kind", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ outcome: "failure", errorKind: "provider_error" }));

		expect(result.ok).toBe(true);
		expect(supabase.getLastInsertPayload()?.outcome).toBe("failure");
		expect(supabase.getLastInsertPayload()?.error_kind).toBe("provider_error");
	});

	it("12. rejects an invalid outcome value", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ outcome: "partial" as unknown as AiOperationEventInput["outcome"] }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.insert).not.toHaveBeenCalled();
	});

	it("rejects an invalid error_kind value not in the closed set", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ errorKind: "server_on_fire" as unknown as AiOperationEventInput["errorKind"] }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
	});
});

describe("duration", () => {
	it("10. rejects a negative duration", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ durationMs: -1 }));

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.insert).not.toHaveBeenCalled();
	});

	it("accepts a null (unmeasured) duration", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const result = await recordAiOperationEvent(textEvent({ durationMs: null }));

		expect(result.ok).toBe(true);
		expect(supabase.getLastInsertPayload()?.duration_ms).toBeNull();
	});
});

describe("input shape safety", () => {
	it("13. rejects an input object carrying an unexpected extra field (e.g. a prompt)", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		const tainted = { ...textEvent(), prompt: "ignore all previous instructions" } as AiOperationEventInput;
		const result = await recordAiOperationEvent(tainted);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("invalid_input");
		expect(supabase.spies.insert).not.toHaveBeenCalled();
	});
});

describe("failure handling", () => {
	it("14. returns a safe failure result when the database insert fails, without leaking the raw error", async () => {
		const supabase = fakeSupabase({ insertError: { message: "duplicate key value violates unique constraint \"some_internal_constraint\"" } });
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const result = await recordAiOperationEvent(textEvent());

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.reason).toBe("database_error");
			expect(result.message).not.toContain("constraint");
			expect(result.message).not.toContain("duplicate key");
		}
		consoleSpy.mockRestore();
	});

	it("returns not_configured when Supabase isn't configured", async () => {
		mockCreateSupabaseServerClient.mockResolvedValue(null);

		const result = await recordAiOperationEvent(textEvent());

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.reason).toBe("not_configured");
	});
});

describe("15/16. client convention", () => {
	it("uses the session-aware createSupabaseServerClient, not a service-role client", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await recordAiOperationEvent(textEvent());

		expect(mockCreateSupabaseServerClient).toHaveBeenCalledTimes(1);
	});

	it("imports only the session-aware client -- never the privileged/service-role client or key -- in executable code", () => {
		const source = readProjectFile("src/features/content-intelligence/events/aiOperationEventWriter.ts");
		const code = stripComments(source);

		// Positive: the module actually imports the expected session-aware
		// client from the expected module (the property this test exists
		// to prove, not just an absence).
		expect(code).toMatch(/import\s*\{\s*createSupabaseServerClient\s*\}\s*from\s*["']@\/lib\/supabase\/server["']/);

		// Negative, checked on executable code only (comments stripped):
		// no import of the privileged client, no import from the
		// privileged module, and no reference to the service-role env var.
		// `createSupabasePrivilegedClient`/`SUPABASE_SERVICE_ROLE_KEY` may
		// still appear in this file's documentation comments explaining
		// that the writer deliberately does NOT use them -- stripping
		// comments first means this assertion only fails if either
		// actually shows up in real code.
		expect(code).not.toMatch(/createSupabasePrivilegedClient/);
		expect(code).not.toMatch(/from\s*["']@\/lib\/supabase\/privileged["']/);
		expect(code).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
	});
});

describe("19. no provider pricing introduced", () => {
	it("the writer module contains no hardcoded provider price constants", () => {
		const source = readProjectFile("src/features/content-intelligence/events/aiOperationEventWriter.ts");
		expect(source).not.toMatch(/COST_PER_1K/);
		expect(source).not.toMatch(/0\.003|0\.015/);
		expect(source).not.toMatch(/gpt-image-2['"]?\s*:\s*[\d.]+/i);
	});
});

describe("20. no automation introduced", () => {
	it("does not import, register, or call a scheduler/cron API in executable code", () => {
		const source = readProjectFile("src/features/content-intelligence/events/aiOperationEventWriter.ts");
		const code = stripComments(source);

		// Precise: no import of a scheduler/cron package or module, and no
		// call/registration of a scheduler/cron-shaped API.
		expect(code).not.toMatch(/from\s*["'][^"']*(cron|scheduler)[^"']*["']/i);
		expect(code).not.toMatch(/\.schedule\s*\(/i);
		expect(code).not.toMatch(/\bcron\s*\(/i);
		expect(code).not.toMatch(/setInterval\s*\(/);

		// Broad fallback, but on comment-stripped code only: this module's
		// documentation comments legitimately say "scheduler" and "cron"
		// (explaining that run_id/execution_mode have no scheduler
		// awareness) -- with comments removed, these only fail if either
		// word shows up in real, executable code.
		expect(code).not.toMatch(/cron/i);
		expect(code).not.toMatch(/scheduler/i);
	});
});

describe("18. costGuard remains untouched by this phase", () => {
	it("costGuard.ts does not import the new event writer or its types", () => {
		const source = readProjectFile("src/features/content-intelligence/generation/costGuard.ts");
		expect(source).not.toMatch(/aiOperationEventWriter/);
		expect(source).not.toMatch(/aiOperationEvent/);
		// costGuard's own three exports are still exactly what Phase
		// 3C.4C's audit found -- this phase does not add, remove, or
		// rename any of them.
		expect(source).toMatch(/export function estimateCostUsd/);
		expect(source).toMatch(/export async function checkBudget/);
		expect(source).toMatch(/export async function logUsage/);
	});
});

describe("17. historical schema compatibility", () => {
	it("migration 014 does not redefine estimated_cost_usd's not-null/default contract", () => {
		const source = readProjectFile("supabase/migrations/014_ai_operation_events.sql");
		expect(source).not.toMatch(/alter column estimated_cost_usd/i);
		expect(source).not.toMatch(/drop column/i);
		expect(source).not.toMatch(/drop table/i);
	});
});
