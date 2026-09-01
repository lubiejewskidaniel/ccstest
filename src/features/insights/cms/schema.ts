import { z } from "zod";
import { articleBodySchema } from "../types/blocks";

/**
 * Server-boundary validation for the CMS article form (same "client
 * validation is a courtesy, this is the real boundary" philosophy as
 * `src/lib/validation/schemas.ts` for lead forms). Every Server Action
 * in `src/lib/actions/insightsCms.ts` parses raw `FormData` through this
 * before `src/features/insights/cms/service.ts` ever touches Supabase.
 */

const slugSchema = z
	.string()
	.trim()
	.min(3, "Slug must be at least 3 characters.")
	.max(160, "Slug is too long (160 characters max).")
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only (e.g. my-article-title).");

const uuidSchema = z.string().uuid("Invalid id.");

export const articleInputSchema = z.object({
	locale: z.enum(["en", "pl"]),
	slug: slugSchema,
	translationOf: z.union([uuidSchema, z.literal("")]).optional().transform((v) => (v ? v : null)),
	categoryId: uuidSchema,
	tagIds: z.array(uuidSchema).default([]),

	title: z.string().trim().min(3, "Title must be at least 3 characters.").max(200, "Title is too long."),
	excerpt: z
		.string()
		.trim()
		.min(20, "Excerpt must be at least 20 characters.")
		.max(400, "Excerpt is too long (400 characters max)."),

	coverImageUrl: z.union([z.string().trim().url("Enter a valid URL."), z.literal("")]).optional().transform((v) => v || null),
	coverImageAlt: z.string().trim().max(300).optional().transform((v) => v || null),

	// Raw JSON text from the textarea — parsed to a JS value by the
	// caller (src/features/insights/cms/service.ts) before this schema
	// validates it, since Zod can't parse a JSON *string* into structure
	// on its own without a `.transform` that could throw outside a
	// try/catch the caller controls.
	body: articleBodySchema,

	readingMinutes: z
		.union([z.coerce.number().int().positive(), z.literal("")])
		.optional()
		.transform((v) => (v === "" || v === undefined ? null : v)),

	authorName: z.string().trim().min(2, "Author name must be at least 2 characters.").max(100),

	status: z.enum(["draft", "in_review", "scheduled", "published", "archived"]),
	scheduledAt: z.union([z.string().datetime({ offset: true }), z.literal("")]).optional().transform((v) => v || null),

	seoTitle: z.string().trim().max(200).optional().transform((v) => v || null),
	seoDescription: z.string().trim().max(300).optional().transform((v) => v || null),

	featured: z.boolean().default(false),

	// Never submitted by the human CMS form (ArticleEditorForm has no
	// field for it) — defaults to "human" so existing behavior is
	// unchanged. Checkpoint 7's promotion step
	// (content-intelligence/briefs/promote.ts) is the only caller that
	// ever passes "ai_generated"/"ai_assisted" explicitly, going through
	// this exact same validated schema rather than a separate write path
	// (docs/INSIGHTS_ARCHITECTURE.md §7's architectural boundary).
	source: z.enum(["human", "ai_assisted", "ai_generated"]).default("human"),
});

export type ArticleInput = z.infer<typeof articleInputSchema>;

export const statusTransitionSchema = z.object({
	id: uuidSchema,
	status: z.enum(["draft", "in_review", "scheduled", "published", "archived"]),
	scheduledAt: z.union([z.string().datetime({ offset: true }), z.literal("")]).optional().transform((v) => v || null),
});
