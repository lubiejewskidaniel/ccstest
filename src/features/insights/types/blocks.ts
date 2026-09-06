import { z } from "zod";
import { slugify } from "@/lib/slugify";

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

/**
 * Assigns a stable, unique anchor id to every heading block from its
 * text — the one rule both authoring paths (the AI editorial pipeline
 * and the human visual block editor) must follow identically, so it
 * lives here rather than being reimplemented by each caller:
 *
 * - The id is derived from the heading's current text via `slugify()`.
 * - Collisions within the same article get a numeric suffix (`-1`,
 *   `-2`, ...) rather than silently overwriting an earlier heading's id.
 * - Non-heading blocks pass through unchanged.
 *
 * Callers that need "don't overwrite a manually-stabilised id" (the
 * visual editor, where an id already exists and shouldn't drift every
 * time the editor tweaks the wording) should only call this for a
 * heading that doesn't have an id yet — see `BlockEditor.tsx`'s
 * `addBlock`, which only ever creates a heading without one.
 */
export function assignHeadingIds(blocks: ContentBlock[]): ContentBlock[] {
  const seen = new Map<string, number>();
  return blocks.map((block) => {
    if (block.type !== "heading") return block;
    const base = slugify(block.text) || "section";
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count}`;
    return { ...block, id };
  });
}

/**
 * Generates one new, unique heading id for a single freshly-created
 * heading block — used by the visual block editor when a heading is
 * added, so an existing heading's id is never touched by this call (it
 * only ever looks at `existingIds` to avoid a collision, never mutates
 * another block). This is the piece that actually satisfies "do not
 * continuously overwrite a manually stabilised id on every edit" for a
 * long-lived editing session: `assignHeadingIds()` above recomputes
 * every heading's id from scratch (right for a one-shot AI generation
 * pass), this recomputes exactly one.
 */
export function generateUniqueHeadingId(text: string, existingIds: Iterable<string>): string {
  const taken = new Set(existingIds);
  const base = slugify(text) || "section";
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
