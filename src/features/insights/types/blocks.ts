import { z } from "zod";

/**
 * Structured content block schema (docs/INSIGHTS_ARCHITECTURE.md §4 —
 * master instruction Decision 7: "AI output uses controlled structured
 * content blocks"). An article's `body` column is an ordered array of
 * these blocks, never a raw HTML/Markdown string — this is the one
 * validation boundary every block passes through regardless of whether a
 * human wrote it in the CMS editor or the future Content Engine
 * generated it (same "server boundary is the real boundary" philosophy
 * as `src/lib/validation/schemas.ts`).
 *
 * Grow this union deliberately — add a block type only when a real
 * article needs it, not speculatively.
 */

const localizedTextLike = z.string().trim().min(1);

export const paragraphBlockSchema = z.object({
  type: z.literal("paragraph"),
  text: localizedTextLike.max(4000),
});

export const headingBlockSchema = z.object({
  type: z.literal("heading"),
  level: z.union([z.literal(2), z.literal(3)]),
  text: localizedTextLike.max(200),
  /** Stable anchor id, generated at write time so the table of contents
   * and in-body `id` attributes never drift apart. */
  id: z.string().trim().min(1).max(120),
});

export const imageBlockSchema = z.object({
  type: z.literal("image"),
  src: z.string().trim().min(1).max(500),
  alt: z.string().trim().min(1).max(300),
  caption: z.string().trim().max(300).optional(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const codeBlockSchema = z.object({
  type: z.literal("code"),
  code: z.string().min(1).max(20000),
  language: z.string().trim().max(40).optional(),
  filename: z.string().trim().max(120).optional(),
});

export const calloutBlockSchema = z.object({
  type: z.literal("callout"),
  variant: z.enum(["info", "warning", "tip"]),
  text: localizedTextLike.max(1000),
});

export const quoteBlockSchema = z.object({
  type: z.literal("quote"),
  text: localizedTextLike.max(1000),
  attribution: z.string().trim().max(200).optional(),
});

export const listBlockSchema = z.object({
  type: z.literal("list"),
  style: z.enum(["ordered", "unordered"]),
  items: z.array(localizedTextLike.max(500)).min(1).max(50),
});

export const contentBlockSchema = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  imageBlockSchema,
  codeBlockSchema,
  calloutBlockSchema,
  quoteBlockSchema,
  listBlockSchema,
]);

export const articleBodySchema = z.array(contentBlockSchema).max(300);

export type ParagraphBlock = z.infer<typeof paragraphBlockSchema>;
export type HeadingBlock = z.infer<typeof headingBlockSchema>;
export type ImageBlock = z.infer<typeof imageBlockSchema>;
export type CodeBlock = z.infer<typeof codeBlockSchema>;
export type CalloutBlock = z.infer<typeof calloutBlockSchema>;
export type QuoteBlock = z.infer<typeof quoteBlockSchema>;
export type ListBlock = z.infer<typeof listBlockSchema>;
export type ContentBlock = z.infer<typeof contentBlockSchema>;

/** Parses and validates a raw `body` JSON value from the database. Returns
 * an empty array (never throws) on malformed data, so a single bad row
 * degrades to "no content rendered" instead of crashing the page — same
 * safe-degradation philosophy as the rest of the app's Supabase reads. */
export function parseArticleBody(raw: unknown): ContentBlock[] {
  const result = articleBodySchema.safeParse(raw);
  return result.success ? result.data : [];
}

/** Extracts the heading blocks from a parsed body, in order — the single
 * source the table of contents renders from, so headings and TOC entries
 * can never drift apart. */
export function extractHeadings(blocks: ContentBlock[]): HeadingBlock[] {
  return blocks.filter((block): block is HeadingBlock => block.type === "heading");
}
