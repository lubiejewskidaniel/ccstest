import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Structural checks on the translation cover sync migration - there is
// no live Postgres in this test environment, so the actual propagation
// behaviour cannot be executed here. This mirrors the technique already
// used for architectural boundaries elsewhere in this codebase (see
// publicCoverRendering.test.ts) and proves the properties that matter
// most for this phase: no mirrored article_visuals row, no Storage
// call, both rows locked, approve_article_visual actually wired up, and
// the two distinct ambiguity rules (which translation, and which side
// wins) behave as documented.

const MIGRATION_PATH = resolve(process.cwd(), "supabase/migrations/015_translation_cover_sync.sql");
const sql = readFileSync(MIGRATION_PATH, "utf8");

function functionBody(name: string): string {
	const start = sql.indexOf(`create or replace function public.${name}`);
	expect(start).toBeGreaterThan(-1);
	const end = sql.indexOf("\n$$;", start);
	expect(end).toBeGreaterThan(start);
	return sql.slice(start, end);
}

describe("sync_linked_translation_cover", () => {
	const body = functionBody("sync_linked_translation_cover");

	it("never inserts into article_visuals", () => {
		expect(body.toLowerCase()).not.toMatch(/insert\s+into\s+public\.article_visuals/);
	});

	it("never touches Supabase Storage", () => {
		expect(body.toLowerCase()).not.toMatch(/storage\./);
	});

	it("locks both linked rows before reading or writing them", () => {
		expect(body).toMatch(/where id in \(p_article_id, v_translation_id\)\s*\n\s*order by id\s*\n\s*for update/);
	});

	it("only ever updates insights_articles", () => {
		const updateStatements = body.match(/update public\.\w+/g) ?? [];
		expect(updateStatements.every((statement) => statement === "update public.insights_articles")).toBe(true);
	});
});

describe("sync_linked_translation_cover - authoritative versus non-authoritative", () => {
	const body = functionBody("sync_linked_translation_cover");
	const authoritativeSplit = body.indexOf("if p_source_is_authoritative then");
	const authoritativeBranch = body.slice(authoritativeSplit, body.indexOf("-- Direction unknown"));
	const nonAuthoritativeBranch = body.slice(body.indexOf("-- Direction unknown"));

	it("authoritative sync overwrites the translation based only on ownership, not on the translation's existing valid status", () => {
		expect(authoritativeBranch).toMatch(/if v_a_valid and not v_b_owns then/);
		expect(authoritativeBranch).not.toMatch(/v_b_valid/);
	});

	it("non authoritative sync fails safe and writes nothing when both sides already show a valid approved cover", () => {
		expect(nonAuthoritativeBranch).toMatch(/if v_a_valid and v_b_valid then\s*\n\s*return;/);
	});

	it("non authoritative sync only fills a genuine gap on the side that is not yet valid", () => {
		const updateCount = (nonAuthoritativeBranch.match(/update public\.insights_articles/g) ?? []).length;
		expect(updateCount).toBe(2);
	});
});

describe("find_linked_translation_id - structure", () => {
	const body = functionBody("find_linked_translation_id");

	it("builds the candidate set from the forward link and every reverse claimant together, before deciding anything", () => {
		expect(body).toMatch(/select v_forward as candidate_id\s*\n\s*where v_forward is not null/);
		expect(body).toMatch(/union/);
		expect(body).toMatch(/where translation_of = p_article_id/);
	});

	it("only returns a candidate once the array length is proven to be exactly one", () => {
		expect(body).toMatch(/array_agg\(candidate_id\)/);
		expect(body).toMatch(/if coalesce\(array_length\(v_candidates, 1\), 0\) = 1 then/);
	});

	it("reads the array element only after uniqueness is already known, never to pick between real candidates", () => {
		const lengthCheckLine = body.indexOf("array_length(v_candidates, 1)");
		const elementReadLine = body.indexOf("v_candidates[1]");
		expect(lengthCheckLine).toBeGreaterThan(-1);
		expect(elementReadLine).toBeGreaterThan(lengthCheckLine);
	});

	it("never calls min or max on a uuid, which is not available in every Postgres environment", () => {
		expect(body.toLowerCase()).not.toMatch(/\bmin\s*\(/);
		expect(body.toLowerCase()).not.toMatch(/\bmax\s*\(/);
	});

	it("never orders candidates or casts a uuid to text to pick one", () => {
		expect(body.toLowerCase()).not.toMatch(/order by/);
		expect(body.toLowerCase()).not.toMatch(/::text/);
	});

	it("never uses DISTINCT to dedupe candidates, relying only on the union above", () => {
		expect(body.toLowerCase()).not.toMatch(/distinct candidate_id/);
	});
});

// Scenario coverage for find_linked_translation_id. There is no live
// Postgres in this environment (see the top of this file), so this
// reimplements the exact same union-of-candidates, distinct-count-of-one
// rule in plain TypeScript purely to exercise the required scenarios -
// it is not application code and is not used anywhere outside this test.
type Row = { id: string; translationOf: string | null };

function resolveLinkedTranslation(articleId: string, rows: Row[]): string | null {
	const article = rows.find((row) => row.id === articleId);
	const forward = article?.translationOf ?? null;

	const candidates = new Set<string>();
	if (forward !== null) candidates.add(forward);
	for (const row of rows) {
		if (row.translationOf === articleId) candidates.add(row.id);
	}

	if (candidates.size === 1) return [...candidates][0] ?? null;
	return null;
}

describe("find_linked_translation_id - scenarios", () => {
	it("forward-only link resolves to the forward target", () => {
		const rows: Row[] = [
			{ id: "A", translationOf: "B" },
			{ id: "B", translationOf: null },
		];

		expect(resolveLinkedTranslation("A", rows)).toBe("B");
	});

	it("reverse-only link resolves to the single reverse claimant", () => {
		const rows: Row[] = [
			{ id: "A", translationOf: null },
			{ id: "B", translationOf: "A" },
		];

		expect(resolveLinkedTranslation("A", rows)).toBe("B");
	});

	it("a forward link plus a different reverse claimant is ambiguous", () => {
		const rows: Row[] = [
			{ id: "A", translationOf: "B" },
			{ id: "B", translationOf: null },
			{ id: "C", translationOf: "A" },
		];

		expect(resolveLinkedTranslation("A", rows)).toBeNull();
	});

	it("two reverse claimants are ambiguous", () => {
		const rows: Row[] = [
			{ id: "A", translationOf: null },
			{ id: "B", translationOf: "A" },
			{ id: "C", translationOf: "A" },
		];

		expect(resolveLinkedTranslation("A", rows)).toBeNull();
	});

	it("a reciprocal pair resolves to the other article, since both directions name the same single article", () => {
		const rows: Row[] = [
			{ id: "A", translationOf: "B" },
			{ id: "B", translationOf: "A" },
		];

		expect(resolveLinkedTranslation("A", rows)).toBe("B");
		expect(resolveLinkedTranslation("B", rows)).toBe("A");
	});

	it("no link in either direction resolves to null", () => {
		const rows: Row[] = [
			{ id: "A", translationOf: null },
			{ id: "B", translationOf: null },
		];

		expect(resolveLinkedTranslation("A", rows)).toBeNull();
	});
});

describe("approve_article_visual", () => {
	const body = functionBody("approve_article_visual");

	it("calls sync_linked_translation_cover after writing its own cover fields", () => {
		const coverUpdateIndex = body.indexOf("cover_image_status = 'approved'");
		const syncCallIndex = body.indexOf("perform public.sync_linked_translation_cover(p_article_id, true)");
		expect(coverUpdateIndex).toBeGreaterThan(-1);
		expect(syncCallIndex).toBeGreaterThan(coverUpdateIndex);
	});
});
