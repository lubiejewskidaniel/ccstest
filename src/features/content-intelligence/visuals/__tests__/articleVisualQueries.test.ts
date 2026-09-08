import { describe, expect, it, vi } from "vitest";

/**
 * Phase 3C.4B.4A correction — the smallest focused test for
 * `listArticleVisuals`'s query shape: it must order candidates by
 * `created_at` descending with `id` descending as a deterministic
 * tie-break, so two candidates sharing a timestamp still return in a
 * stable, repeatable order.
 */

const mockCreateSupabaseServerClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
	createSupabaseServerClient: () => mockCreateSupabaseServerClient(),
}));

const { listArticleVisuals } = await import("../articleVisualQueries");

const ARTICLE_ID = "11111111-1111-4111-8111-111111111111";

/** A minimal fake of the exact Supabase surface `listArticleVisuals`
 * touches: `.from("article_visuals").select(...).eq(...).order(...).order(...)`
 * and `.storage.from(...).getPublicUrl(...)`. */
function fakeSupabase() {
	const order2 = vi.fn(async () => ({ data: [], error: null }));
	const order1 = vi.fn(() => ({ order: order2 }));
	const eq = vi.fn(() => ({ order: order1 }));
	const select = vi.fn(() => ({ eq }));

	const from = vi.fn((table: string) => {
		if (table === "article_visuals") return { select };
		throw new Error(`fakeSupabase: unexpected table "${table}"`);
	});

	const getPublicUrl = vi.fn((path: string) => ({ data: { publicUrl: `https://project.supabase.co/storage/v1/object/public/article-visuals/${path}` } }));
	const storageFrom = vi.fn((_bucket: string) => ({ getPublicUrl }));

	return {
		from,
		storage: { from: storageFrom },
		spies: { select, eq, order1, order2 },
	};
}

describe("listArticleVisuals query order", () => {
	it("orders by created_at descending, then by id descending as a deterministic tie-break", async () => {
		const supabase = fakeSupabase();
		mockCreateSupabaseServerClient.mockResolvedValue(supabase);

		await listArticleVisuals(ARTICLE_ID);

		expect(supabase.spies.order1).toHaveBeenCalledWith("created_at", { ascending: false });
		expect(supabase.spies.order2).toHaveBeenCalledWith("id", { ascending: false });
	});
});
